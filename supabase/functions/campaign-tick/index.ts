/**
 * campaign-tick : cron quotidien (00054) ou bouton manuel.
 * Pour chaque inscription active : arrêt si lead perdu, arrêt si réponse reçue (IMAP),
 * sinon création du brouillon de l'étape due (mail via Gemini, appel = tâche).
 * Corps optionnel : { campaign_id?: string, enrollment_ids?: string[] }.
 * Sans campaign_id, seules les campagnes 'live' sont traitées ; avec, la campagne est
 * traitée quel que soit son statut (permet de préparer les brouillons d'un brouillon de campagne).
 */

import { ImapFlow } from 'npm:imapflow'
import { corsHeaders, errorResponse, validateAuth } from '../_shared/auth.ts'
import { isAuthenticatedCronCall } from '../_shared/cronAuth.ts'
import { leadFacts } from '../_shared/campaignText.ts'
import {
  adminClient,
  appendTimeline,
  generateEmailDraft,
  stopEnrollment,
  todayISO,
  type CampaignRow,
  type EnrollmentRow,
  type LeadRow,
  type MessageRow,
  type StepRow,
} from '../_shared/campaign.ts'

// ponytail: budget porté par la réponse HTTP ; si la gateway coupe avant (150 s constatés sur
// email-lead-detector), passer en 202 + EdgeRuntime.waitUntil comme lui.
const GLOBAL_TIMEOUT_MS = 300_000
const REPLY_FOLDERS = ['INBOX', 'Prospects-BizDev']

interface TickBody {
  campaign_id?: string
  enrollment_ids?: string[]
}

interface Reply {
  subject: string
}

interface Stats {
  processed: number
  replies_detected: number
  drafts_created: number
  stopped: number
  errors: string[]
}

type ImapClient = InstanceType<typeof ImapFlow>

/** Cherche, dossier par dossier, un mail du contact reçu depuis le début de l'inscription. */
async function detectReplies(
  client: ImapClient,
  targets: { enrollment: EnrollmentRow; email: string }[],
  errors: string[],
): Promise<Map<string, Reply>> {
  const found = new Map<string, Reply>()
  for (const folder of REPLY_FOLDERS) {
    let lock: { release(): void } | null = null
    try {
      lock = await client.getMailboxLock(folder)
      for (const { enrollment, email } of targets) {
        if (found.has(enrollment.id)) continue
        const started = new Date(enrollment.started_at)
        const uids = await client.search({ from: email, since: started }, { uid: true })
        if (!Array.isArray(uids) || uids.length === 0) continue
        // SINCE IMAP ne compare que la date : un mail du contact reçu le matin même, avant
        // l'inscription, arrêterait la séquence. On revérifie l'heure, du plus récent au plus ancien.
        for (const uid of [...uids].reverse().slice(0, 5)) {
          const msg = await client.fetchOne(String(uid), { envelope: true, internalDate: true }, { uid: true })
          const at = msg ? new Date(msg.internalDate ?? msg.envelope?.date ?? 0) : null
          if (!msg || !at || at < started) continue
          found.set(enrollment.id, { subject: msg.envelope?.subject || '(Sans objet)' })
          break
        }
      }
    } catch (e) {
      // Prospects-BizDev peut manquer : on logue sans bloquer.
      const m = e instanceof Error ? e.message : String(e)
      console.error(`[campaign-tick] IMAP ${folder}:`, m)
      if (folder === 'INBOX') errors.push(`imap:${folder}:${m}`)
    } finally {
      lock?.release()
    }
  }
  return found
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
  const { data: leadsData, error: leadsErr } = await admin
    .from('leads')
    .select('id, name, status, maturity, relance_count, timeline, contact_name, contact_role, contact_email, notes, why, pitch, source')
    .in('id', leadIds)
  if (leadsErr) return errorResponse(`leads_read_failed: ${leadsErr.message}`, 500)
  const leads = new Map((leadsData as LeadRow[]).map((l) => [l.id, l]))

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
  const imapUser = Deno.env.get('HOSTINGER_EMAIL')
  const imapPass = Deno.env.get('HOSTINGER_IMAP_PASSWORD')
  if (targets.length > 0 && imapUser && imapPass) {
    const client = new ImapFlow({
      host: 'imap.hostinger.com',
      port: 993,
      secure: true,
      auth: { user: imapUser, pass: imapPass },
      logger: false,
    })
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

      // a. Lead perdu
      if (lead.status === 'perdu') {
        await stopEnrollment(admin, enrollment.id, 'lost')
        stats.stopped++
        continue
      }

      // b. Réponse reçue
      const reply = replies.get(enrollment.id)
      if (reply) {
        await stopEnrollment(admin, enrollment.id, 'replied')
        await appendTimeline(admin, lead.id, {
          date: todayISO(now),
          direction: 'reçu',
          sujet: reply.subject,
          résumé: `Réponse reçue, campagne « ${campaign.name} » arrêtée`,
        })
        const patch: Record<string, string> = { maturity: 'chaud' }
        if (lead.status === 'nouveau' || lead.status === 'contacte') patch.status = 'en_discussion'
        const { error } = await admin.from('leads').update(patch).eq('id', lead.id)
        if (error) throw new Error(`lead_update_failed: ${error.message}`)
        stats.replies_detected++
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

      if (step.kind === 'email') {
        const previous = own.find((m) => m.kind === 'email' && m.status === 'sent') ?? null
        const draft = await generateEmailDraft({ step, lead, previous, campaign, enrollment })
        const { error } = await admin.from('campaign_messages').insert({
          enrollment_id: enrollment.id,
          step_id: step.id,
          kind: 'email',
          status: 'draft',
          subject: draft.subject,
          body: draft.body,
          checks: draft.checks,
          context: draft.context,
          due_at: enrollment.next_due_at,
        })
        if (error) throw new Error(`draft_insert_failed: ${error.message}`)
      } else {
        const { error } = await admin.from('campaign_messages').insert({
          enrollment_id: enrollment.id,
          step_id: step.id,
          kind: 'call',
          status: 'draft',
          context: { script: step.ai_brief, facts: leadFacts(lead) },
          due_at: enrollment.next_due_at,
        })
        if (error) throw new Error(`call_insert_failed: ${error.message}`)
      }
      stats.drafts_created++
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      console.error(`[campaign-tick] ${enrollment.id}:`, m)
      stats.errors.push(`${enrollment.id}: ${m}`)
    }
  }

  return Response.json(stats, { headers: corsHeaders })
})
