/**
 * campaign-tick : cron quotidien (00054) ou bouton manuel.
 * Pour chaque inscription active : arrêt si réponse reçue (IMAP), arrêt si le lead n'est plus un
 * prospect, sinon création du brouillon de l'étape due (mail via Gemini, appel = tâche).
 * Corps optionnel : { campaign_id?: string, enrollment_ids?: string[] }.
 * Sans campaign_id, seules les campagnes 'live' sont traitées ; avec, la campagne est
 * traitée quel que soit son statut (permet de préparer les brouillons d'un brouillon de campagne).
 */

import { corsHeaders, errorResponse, validateAuth } from '../_shared/auth.ts'
import { isAuthenticatedCronCall } from '../_shared/cronAuth.ts'
import { leadFacts } from '../_shared/campaignText.ts'
import {
  LEAD_COLUMNS,
  adminClient,
  advanceEnrollment,
  detectReplies,
  generateEmailDraft,
  imapClient,
  isProspect,
  recordReply,
  stopEnrollment,
  type CampaignRow,
  type EnrollmentRow,
  type LeadRow,
  type MessageRow,
  type Reply,
  type StepRow,
} from '../_shared/campaign.ts'

// Sous les ~150 s de la passerelle (coupure constatée sur email-lead-detector) : le run s'arrête
// proprement et rend ses stats, le reste passe au tick suivant.
const GLOBAL_TIMEOUT_MS = 120_000

interface TickBody {
  campaign_id?: string
  enrollment_ids?: string[]
}

interface Stats {
  processed: number
  replies_detected: number
  drafts_created: number
  stopped: number
  errors: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('method_not_allowed', 405)

  if (!(await isAuthenticatedCronCall(req))) {
    const auth = await validateAuth(req)
    if (auth instanceof Response) return auth
  }

  let body: TickBody = {}
  try {
    const text = await req.text()
    if (text.trim()) body = JSON.parse(text) as TickBody
  } catch {
    return errorResponse('invalid_json', 400)
  }

  const startedAt = Date.now()
  const now = new Date()
  const stats: Stats = { processed: 0, replies_detected: 0, drafts_created: 0, stopped: 0, errors: [] }
  const admin = adminClient()

  // ── Campagnes concernées ──
  let campaignQuery = admin.from('campaigns').select('id, name, status, sender_email')
  campaignQuery = body.campaign_id ? campaignQuery.eq('id', body.campaign_id) : campaignQuery.eq('status', 'live')
  const { data: campaignsData, error: campErr } = await campaignQuery
  if (campErr) return errorResponse(`campaigns_read_failed: ${campErr.message}`, 500)
  const campaigns = new Map((campaignsData as CampaignRow[]).map((c) => [c.id, c]))
  if (campaigns.size === 0) return Response.json(stats, { headers: corsHeaders })
  const campaignIds = [...campaigns.keys()]

  // ── Étapes, inscriptions actives, leads, messages ──
  const { data: stepsData, error: stepsErr } = await admin
    .from('campaign_steps')
    .select('id, campaign_id, position, kind, wait_days, name, subject_template, body_template, ai_brief')
    .in('campaign_id', campaignIds)
    .order('position')
  if (stepsErr) return errorResponse(`steps_read_failed: ${stepsErr.message}`, 500)
  const steps = stepsData as StepRow[]

  let enrollQuery = admin
    .from('campaign_enrollments')
    .select('id, campaign_id, lead_id, status, current_position, next_due_at, stop_reason, thread_message_id, thread_subject, started_at')
    .eq('status', 'active')
    .in('campaign_id', campaignIds)
    .order('next_due_at')
  if (body.enrollment_ids?.length) enrollQuery = enrollQuery.in('id', body.enrollment_ids)
  const { data: enrollData, error: enrollErr } = await enrollQuery
  if (enrollErr) return errorResponse(`enrollments_read_failed: ${enrollErr.message}`, 500)
  const enrollments = enrollData as EnrollmentRow[]
  if (enrollments.length === 0) return Response.json(stats, { headers: corsHeaders })

  const leadIds = [...new Set(enrollments.map((e) => e.lead_id))]
  const { data: leadsData, error: leadsErr } = await admin.from('leads').select(LEAD_COLUMNS).in('id', leadIds)
  if (leadsErr) return errorResponse(`leads_read_failed: ${leadsErr.message}`, 500)
  const leads = new Map((leadsData as unknown as LeadRow[]).map((l) => [l.id, l]))

  const { data: msgData, error: msgErr } = await admin
    .from('campaign_messages')
    .select('id, enrollment_id, step_id, kind, status, subject, body, sent_at')
    .in('enrollment_id', enrollments.map((e) => e.id))
    .in('status', ['draft', 'sent'])
    .order('sent_at', { ascending: false, nullsFirst: false })
  if (msgErr) return errorResponse(`messages_read_failed: ${msgErr.message}`, 500)
  const messages = msgData as MessageRow[]

  // ── Réponses : une seule connexion IMAP pour tout le run ──
  const targets = enrollments.flatMap((enrollment) => {
    const email = leads.get(enrollment.lead_id)?.contact_email?.trim()
    return email ? [{ enrollment, email }] : []
  })
  let replies = new Map<string, Reply>()
  const client = targets.length > 0 ? imapClient() : null
  if (client) {
    try {
      await client.connect()
      replies = await detectReplies(client, targets, stats.errors)
      await client.logout()
    } catch (e) {
      try { await client.logout() } catch { /* ignore */ }
      const m = e instanceof Error ? e.message : String(e)
      console.error('[campaign-tick] IMAP indisponible:', m)
      stats.errors.push(`imap:${m}`)
    }
  } else if (targets.length > 0) {
    stats.errors.push('imap:not_configured')
  }

  // ── Boucle séquentielle ──
  for (const enrollment of enrollments) {
    if (Date.now() - startedAt > GLOBAL_TIMEOUT_MS) {
      stats.errors.push('timeout: run interrompu, reste traité au prochain tick')
      break
    }
    stats.processed++
    const lead = leads.get(enrollment.lead_id)
    const campaign = campaigns.get(enrollment.campaign_id)
    try {
      if (!lead || !campaign) {
        stats.errors.push(`${enrollment.id}: lead ou campagne introuvable`)
        continue
      }

      // a. Réponse reçue : d'abord, pour qu'elle entre dans la timeline même si le lead a bougé.
      const reply = replies.get(enrollment.id)
      if (reply) {
        await recordReply(admin, enrollment.id, lead, campaign.name, reply, now)
        stats.replies_detected++
        stats.stopped++
        continue
      }

      // b. Lead sorti de la prospection (perdu, en discussion, client, archivé) : plus aucun envoi.
      if (!isProspect(lead)) {
        await stopEnrollment(admin, enrollment.id, lead.status === 'perdu' ? 'lost' : 'lead_moved')
        stats.stopped++
        continue
      }

      // c. Étape due
      if (new Date(enrollment.next_due_at) > now) continue
      const step = steps.find((s) => s.campaign_id === enrollment.campaign_id && s.position === enrollment.current_position)
      if (!step || step.kind === 'stop') {
        await admin
          .from('campaign_enrollments')
          .update({ status: 'done', stop_reason: 'finished', updated_at: now.toISOString() })
          .eq('id', enrollment.id)
        continue
      }
      const own = messages.filter((m) => m.enrollment_id === enrollment.id)
      if (own.some((m) => m.step_id === step.id && m.status === 'draft')) continue
      // Mail parti mais inscription pas avancée (écriture perdue après l'envoi) : on avance, jamais
      // on ne régénère, sinon le même mail repartirait.
      if (own.some((m) => m.step_id === step.id && m.status === 'sent')) {
        await advanceEnrollment(admin, enrollment, steps, now)
        continue
      }

      const row = step.kind === 'email'
        ? await (async () => {
            const previous = own.find((m) => m.kind === 'email' && m.status === 'sent') ?? null
            const draft = await generateEmailDraft({ step, lead, previous, campaign, enrollment })
            return { kind: 'email', subject: draft.subject, body: draft.body, checks: draft.checks, context: draft.context }
          })()
        : { kind: 'call', context: { script: step.ai_brief, facts: leadFacts(lead) } }
      const { error } = await admin.from('campaign_messages').insert({
        enrollment_id: enrollment.id,
        step_id: step.id,
        status: 'draft',
        due_at: enrollment.next_due_at,
        ...row,
      })
      // 23505 : un autre run (cron et bouton en même temps) a créé ce brouillon juste avant (index 00055).
      if (error?.code === '23505') continue
      if (error) throw new Error(`draft_insert_failed: ${error.message}`)
      stats.drafts_created++
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      console.error(`[campaign-tick] ${enrollment.id}:`, m)
      stats.errors.push(`${enrollment.id}: ${m}`)
    }
  }

  return Response.json(stats, { headers: corsHeaders })
})
