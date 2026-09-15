/**
 * campaign-send : envoie un brouillon validé à la revue.
 * POST { message_id, subject, body } ; objet et corps reçus remplacent ceux du brouillon.
 * Revérifie les interdits (422 si bloquant), envoie par SMTP Hostinger dans le fil de
 * l'inscription, puis avance l'inscription et met à jour le lead.
 */

import nodemailer from 'npm:nodemailer'
import { ImapFlow } from 'npm:imapflow'
import { Buffer } from 'node:buffer'
import { corsHeaders, errorResponse, validateAuth } from '../_shared/auth.ts'
import { hasBlockingCheck, runChecks, stripAiMarks } from '../_shared/campaignText.ts'
import {
  adminClient,
  advanceEnrollment,
  appendTimeline,
  todayISO,
  type CampaignRow,
  type EnrollmentRow,
  type LeadRow,
  type MessageRow,
  type StepRow,
} from '../_shared/campaign.ts'

interface SendBody {
  message_id?: string
  subject?: string
  body?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('method_not_allowed', 405)

  const auth = await validateAuth(req)
  if (auth instanceof Response) return auth

  let payload: SendBody
  try {
    payload = (await req.json()) as SendBody
  } catch {
    return errorResponse('invalid_json', 400)
  }
  const { message_id, subject, body } = payload
  if (!message_id || typeof subject !== 'string' || typeof body !== 'string') {
    return errorResponse('missing_fields', 400)
  }

  const smtpUser = Deno.env.get('HOSTINGER_EMAIL')
  const smtpPassword = Deno.env.get('HOSTINGER_SMTP_PASSWORD')
  if (!smtpUser || !smtpPassword) return errorResponse('email_not_configured', 500)

  const admin = adminClient()

  // ── Message → inscription → lead, campagne, étapes ──
  const { data: msgData, error: msgErr } = await admin
    .from('campaign_messages')
    .select('id, enrollment_id, step_id, kind, status, subject, body, sent_at')
    .eq('id', message_id)
    .maybeSingle()
  if (msgErr) return errorResponse(`message_read_failed: ${msgErr.message}`, 500)
  const message = msgData as MessageRow | null
  if (!message) return errorResponse('message_not_found', 404)
  if (message.kind !== 'email' || message.status !== 'draft') return errorResponse('message_not_sendable', 409)

  const { data: enrData, error: enrErr } = await admin
    .from('campaign_enrollments')
    .select('id, campaign_id, lead_id, status, current_position, next_due_at, stop_reason, thread_message_id, thread_subject, started_at')
    .eq('id', message.enrollment_id)
    .maybeSingle()
  if (enrErr) return errorResponse(`enrollment_read_failed: ${enrErr.message}`, 500)
  const enrollment = enrData as EnrollmentRow | null
  if (!enrollment) return errorResponse('enrollment_not_found', 404)

  const [leadRes, campRes, stepsRes] = await Promise.all([
    admin
      .from('leads')
      .select('id, name, status, maturity, relance_count, timeline, contact_name, contact_role, contact_email, notes, why, pitch, source')
      .eq('id', enrollment.lead_id)
      .maybeSingle(),
    admin.from('campaigns').select('id, name, status, sender_email').eq('id', enrollment.campaign_id).maybeSingle(),
    admin
      .from('campaign_steps')
      .select('id, campaign_id, position, kind, wait_days, name, subject_template, body_template, ai_brief')
      .eq('campaign_id', enrollment.campaign_id)
      .order('position'),
  ])
  if (leadRes.error || campRes.error || stepsRes.error) {
    const m = (leadRes.error || campRes.error || stepsRes.error)?.message
    return errorResponse(`context_read_failed: ${m}`, 500)
  }
  const lead = leadRes.data as LeadRow | null
  const campaign = campRes.data as CampaignRow | null
  const steps = stepsRes.data as StepRow[]
  const step = steps.find((s) => s.id === message.step_id)
  if (!lead || !campaign || !step) return errorResponse('context_not_found', 404)

  const to = lead.contact_email?.trim()
  if (!to) return errorResponse('lead_without_email', 400)

  // ── Contrôles : un « ko » bloque ──
  const checks = runChecks({
    subject,
    body,
    isReply: step.position > 1,
    hasThread: !!enrollment.thread_message_id,
    isFirst: step.position === 1,
  })
  if (hasBlockingCheck(checks)) {
    return new Response(JSON.stringify({ error: 'blocked', checks }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Envoi ──
  // Le message brut est construit une fois : le même part en SMTP et est déposé dans INBOX.Sent
  // (le SMTP n'archive rien : sans ce dépôt l'envoi manque au webmail, où seul Sent fait foi).
  const text = stripAiMarks(body)
  const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPassword },
  })

  let sentMessageId: string
  let raw: Buffer
  try {
    const built = await nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' }).sendMail({
      // Le nom est celui de la signature du gabarit (SIGNATURE_EMIR), sinon le contact voit une adresse nue.
      from: { name: 'Emir Boutaleb', address: campaign.sender_email },
      to,
      subject,
      text,
      inReplyTo: enrollment.thread_message_id || undefined,
      references: enrollment.thread_message_id ? [enrollment.thread_message_id] : undefined,
    })
    sentMessageId = String(built.messageId)
    raw = built.message as Buffer
    await transporter.sendMail({ envelope: { from: campaign.sender_email, to }, raw })
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err)
    console.error('[campaign-send] SMTP:', m)
    await admin.from('campaign_messages').update({ error: m, updated_at: new Date().toISOString() }).eq('id', message.id)
    return errorResponse('smtp_send_failed', 503)
  }

  // ── Après envoi : message, inscription, lead ──
  // Le mail est parti : chaque écriture qui suit est loguée mais ne fait plus échouer l'appel.
  const now = new Date()
  const errors: string[] = []
  const { error: updMsgErr } = await admin
    .from('campaign_messages')
    .update({
      status: 'sent',
      sent_at: now.toISOString(),
      message_id: sentMessageId,
      subject,
      body: text,
      checks,
      error: null,
      validated_by: auth.user.id,
      updated_at: now.toISOString(),
    })
    .eq('id', message.id)
  if (updMsgErr) errors.push(`message_update_failed: ${updMsgErr.message}`)

  const imap = new ImapFlow({
    host: 'imap.hostinger.com',
    port: 993,
    secure: true,
    auth: { user: smtpUser, pass: Deno.env.get('HOSTINGER_IMAP_PASSWORD') || smtpPassword },
    logger: false,
  })
  try {
    await imap.connect()
    await imap.append('INBOX.Sent', raw, ['\\Seen'], now)
    await imap.logout()
  } catch (e) {
    try { await imap.logout() } catch { /* ignore */ }
    errors.push(`sent_append_failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  let current = enrollment
  if (!enrollment.thread_message_id) {
    const { data, error } = await admin
      .from('campaign_enrollments')
      .update({ thread_message_id: sentMessageId, thread_subject: subject, updated_at: now.toISOString() })
      .eq('id', enrollment.id)
      .select()
      .single()
    if (error) errors.push(`thread_update_failed: ${error.message}`)
    else current = data as EnrollmentRow
  }
  try {
    current = await advanceEnrollment(admin, current, steps, now)
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e))
  }

  const leadPatch: Record<string, string | number> = {
    canal: 'email',
    last_contact_date: todayISO(now),
  }
  if (lead.status === 'nouveau') leadPatch.status = 'contacte'
  if (step.position > 1) leadPatch.relance_count = (lead.relance_count ?? 0) + 1
  const { error: leadErr } = await admin.from('leads').update(leadPatch).eq('id', lead.id)
  if (leadErr) errors.push(`lead_update_failed: ${leadErr.message}`)
  try {
    await appendTimeline(admin, lead.id, {
      date: todayISO(now),
      direction: 'envoyé',
      sujet: subject,
      résumé: `Campagne « ${campaign.name} », ${step.name}`,
    })
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e))
  }

  if (errors.length) console.error('[campaign-send] après envoi:', errors.join(' | '))
  return Response.json(
    { ok: true, message_id: sentMessageId, enrollment: current, ...(errors.length ? { warnings: errors } : {}) },
    { headers: corsHeaders },
  )
})
