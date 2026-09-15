/**
 * Helpers partagés des campagnes (campaign-tick, campaign-send) : client service_role,
 * génération d'un brouillon par Gemini, timeline du lead, avancée / arrêt d'une inscription.
 * La logique pure (assemblage, contrôles, interdits) reste dans campaignText.ts.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { ImapFlow } from 'npm:imapflow'
import {
  assembleBody,
  assembleSubject,
  extractAiZones,
  leadFacts,
  runChecks,
  wordCount,
  type Check,
  type LeadLike,
} from './campaignText.ts'

// ── Lignes des tables (sous-ensemble utile aux edge functions) ─────────────────

export interface CampaignRow {
  id: string
  name: string
  status: 'draft' | 'live' | 'paused' | 'archived'
  sender_email: string
}

export interface StepRow {
  id: string
  campaign_id: string
  position: number
  kind: 'email' | 'call' | 'stop'
  wait_days: number
  name: string
  subject_template: string | null
  body_template: string | null
  ai_brief: string | null
}

export interface EnrollmentRow {
  id: string
  campaign_id: string
  lead_id: string
  status: 'active' | 'stopped' | 'done'
  current_position: number
  next_due_at: string
  stop_reason: string | null
  thread_message_id: string | null
  thread_subject: string | null
  started_at: string
}

export interface LeadRow extends LeadLike {
  id: string
  status: string
  archived: boolean | null
  maturity: string | null
  relance_count: number
  timeline: TimelineEntry[] | null
}

export interface MessageRow {
  id: string
  enrollment_id: string
  step_id: string
  kind: 'email' | 'call'
  status: 'draft' | 'sent' | 'done' | 'skipped'
  subject: string | null
  body: string | null
  sent_at: string | null
}

export interface TimelineEntry {
  date: string
  direction: 'envoyé' | 'reçu'
  sujet: string
  résumé: string
}

export interface DraftContext {
  why: string
  facts: [string, string][]
  previous_subject: string | null
  previous_body: string | null
  generated_by: 'gemini-2.5-flash' | 'fallback'
}

export interface EmailDraft {
  subject: string
  body: string
  checks: Check[]
  context: DraftContext
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

/** Colonnes de leads lues par tick et send : une seule liste, pas deux qui divergent. */
export const LEAD_COLUMNS =
  'id, name, status, archived, maturity, relance_count, timeline, contact_name, contact_role, contact_email, notes, why, pitch, source'

/** Seuls les leads « nouveau » ou « contacté », non archivés, reçoivent un mail de campagne. */
export function isProspect(lead: { status: string; archived?: boolean | null }): boolean {
  return (lead.status === 'nouveau' || lead.status === 'contacte') && !lead.archived
}

/** Date locale Paris au format YYYY-MM-DD (les leads stockent un DATE). */
export function todayISO(now = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
}

// ── Génération Gemini ──────────────────────────────────────────────────────────

const GEMINI_TIMEOUT_MS = 40_000

// Rappelés dans le prompt ; la garde dure reste BANNED_PHRASES via runChecks.
const PROMPT_BANS = [
  '« 100 % financé par l\'OPCO » ou toute promesse de prise en charge totale',
  '« gratuit »',
  '« partenaire Agefiph »',
  '« labellisée French Tech »',
  '« soutenue par TBSeeds »',
  '« sous 48 h »',
  '« 15 minutes » ou toute demande de créneau',
  '« je me permets de vous relancer »',
  '« envoyez-moi un support »',
  'tout chiffre qui ne figure pas dans la fiche du contact',
  'le mot « stagiaires »',
]

interface GeminiJson {
  subject: string
  zones: string[]
  why: string
}

function buildPrompt(step: StepRow, lead: LeadRow, previous: MessageRow | null): string {
  const zones = extractAiZones(step.body_template || '')
  const subjectHasAi = /\{\{\s*IA\s*:/.test(step.subject_template || '')
  const facts = leadFacts(lead).map(([k, v]) => `- ${k} : ${v}`).join('\n')

  const lines: string[] = [
    'Tu rédiges, en français, pour Emir Boutaleb, co-fondateur de MEMOVIA (Toulouse), un mail de prospection adressé au référent handicap d\'un CFA.',
    'MEMOVIA adapte le contenu original des supports de cours aux profils neurodivergents, pour toute la classe, sans dossier et sans nommer personne.',
    'Tu n\'écris pas le mail entier : seulement les zones demandées ci-dessous, qui s\'insèrent dans un modèle déjà écrit. Chaque zone suit strictement sa consigne.',
    '',
    `Consigne de l'étape « ${step.name} » : ${step.ai_brief || '(aucune)'}`,
    '',
    'Fiche du contact :',
    `- Établissement : ${lead.name}`,
    lead.contact_name ? `- Contact : ${lead.contact_name}${lead.contact_role ? ', ' + lead.contact_role : ''}` : '',
    facts,
    lead.notes ? `Notes intégrales :\n${lead.notes}` : '',
    '',
  ]

  if (previous) {
    lines.push('Mail précédent du fil (ne pas le répéter, ne pas le résumer) :', `Objet : ${previous.subject || ''}`, previous.body || '', '')
  }

  // Le gabarit validé pèse déjà ~130 mots sur 170 : sans budget chiffré, Gemini rend 190 mots.
  const fixedWords = wordCount(assembleBody({ template: step.body_template || '', zones: [], lead, previousSubject: null }))
  const budget = Math.max(25, 170 - fixedWords)

  lines.push('Zones à écrire, dans cet ordre :')
  zones.forEach((z) => lines.push(`${z.index + 1}. ${z.brief}`))
  if (zones.length === 0) lines.push('(aucune zone dans le corps)')
  if (zones.length > 0) {
    lines.push(
      '',
      `Longueur : le modèle fait déjà ${fixedWords} mots, toutes les zones réunies tiennent en ${budget} mots au plus.`,
      'Les consignes sont des règles, jamais du texte : ne recopie aucune de leurs phrases (« Jamais une leçon sur son métier » est un interdit, pas une phrase du mail).',
      'Une zone qui demande trois mots en contient trois. Les exemples donnés valent pour d\'autres métiers : écris l\'équivalent pour les métiers de la fiche (coiffure : coupes et colorations), sans reprendre un exemple qui ne colle pas.',
      'La question tient en une ligne et se répond par un mot (oui, non, un nom).',
      'Orthographe et accords irréprochables.',
    )
  }
  lines.push(
    subjectHasAi
      ? `Objet (champ "subject") : ${(step.subject_template || '').replace(/\{\{\s*IA\s*:\s*([\s\S]*?)\}\}/, '$1').trim()}`
      : 'Objet (champ "subject") : laisser une chaîne vide, l\'objet est imposé par le modèle.',
    '',
    'Interdits absolus :',
    ...PROMPT_BANS.map((b) => `- ${b}`),
    '',
    'Réponds uniquement par un JSON : { "subject": string, "zones": string[], "why": string }.',
    '"zones" contient exactement ' + zones.length + ' texte(s) bruts, sans guillemets typographiques, sans crochets, sans balises.',
    '"why" : une phrase courte qui explique l\'angle choisi pour ce contact.',
  )
  return lines.filter((l) => l !== null).join('\n')
}

function parseGeminiJson(raw: string): GeminiJson | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const parsed = JSON.parse(cleaned) as Partial<GeminiJson>
    if (!Array.isArray(parsed.zones)) return null
    return {
      subject: typeof parsed.subject === 'string' ? parsed.subject : '',
      zones: parsed.zones.map((z) => (typeof z === 'string' ? z : '')),
      why: typeof parsed.why === 'string' ? parsed.why : '',
    }
  } catch {
    return null
  }
}

async function callGemini(prompt: string, apiKey: string): Promise<GeminiJson | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // thinkingBudget:0 : sans lui, 500 intermittents constatés sur le projet (rdv-transcribe).
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    )
    if (!res.ok) {
      console.error(`[campaign] gemini ${res.status}:`, (await res.text()).slice(0, 300))
      return null
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      console.error('[campaign] gemini réponse vide')
      return null
    }
    const parsed = parseGeminiJson(text)
    if (!parsed) console.error('[campaign] gemini JSON invalide:', text.slice(0, 300))
    return parsed
  } catch (e) {
    console.error('[campaign] gemini erreur:', e instanceof Error ? e.message : e)
    return null
  }
}

export interface GenerateInput {
  step: StepRow
  lead: LeadRow
  previous: MessageRow | null
  campaign: CampaignRow
  enrollment: EnrollmentRow
}

/** Brouillon d'un mail d'étape. N'échoue jamais : sans IA, zones vides + check warn. */
export async function generateEmailDraft({ step, lead, previous, enrollment }: GenerateInput): Promise<EmailDraft> {
  const apiKey = Deno.env.get('GOOGLE_API_KEY')
  const ai = apiKey ? await callGemini(buildPrompt(step, lead, previous), apiKey) : null
  if (!apiKey) console.error('[campaign] GOOGLE_API_KEY absent : brouillon sans IA')

  const previousSubject = previous?.subject ?? enrollment.thread_subject ?? null
  const body = assembleBody({ template: step.body_template || '', zones: ai?.zones ?? [], lead, previousSubject })
  const subject = assembleSubject(step.subject_template, ai?.subject ?? '', previousSubject)

  const checks = runChecks({
    subject,
    body,
    isReply: step.position > 1,
    hasThread: !!enrollment.thread_message_id,
    isFirst: step.position === 1,
  })
  if (!ai) checks.push({ status: 'warn', label: 'IA indisponible : zones à écrire à la main' })

  return {
    subject,
    body,
    checks,
    context: {
      why: ai?.why ?? '',
      facts: leadFacts(lead),
      previous_subject: previous?.subject ?? null,
      previous_body: previous?.body ? previous.body.slice(0, 600) : null,
      generated_by: ai ? 'gemini-2.5-flash' : 'fallback',
    },
  }
}

// ── Lead : timeline ────────────────────────────────────────────────────────────

export async function appendTimeline(admin: SupabaseClient, leadId: string, entry: TimelineEntry): Promise<void> {
  const { data, error } = await admin.from('leads').select('timeline').eq('id', leadId).maybeSingle()
  if (error) throw new Error(`timeline_read_failed: ${error.message}`)
  const current = (data as { timeline: TimelineEntry[] | null } | null)?.timeline
  const timeline = Array.isArray(current) ? [...current] : []
  timeline.push({ ...entry, résumé: entry.résumé.slice(0, 120) })
  const { error: upErr } = await admin.from('leads').update({ timeline }).eq('id', leadId)
  if (upErr) throw new Error(`timeline_write_failed: ${upErr.message}`)
}

// ── Inscription : avancer / arrêter ────────────────────────────────────────────

/** Passe à l'étape suivante ; sans suite (ou suite = stop) l'inscription est terminée. */
export async function advanceEnrollment(
  admin: SupabaseClient,
  enrollment: EnrollmentRow,
  steps: StepRow[],
  now: Date,
): Promise<EnrollmentRow> {
  const nextPos = enrollment.current_position + 1
  const next = steps.find((s) => s.campaign_id === enrollment.campaign_id && s.position === nextPos)
  const patch: Partial<EnrollmentRow> & { updated_at: string } = { updated_at: now.toISOString() }

  if (!next || next.kind === 'stop') {
    patch.status = 'done'
    patch.stop_reason = 'finished'
  } else {
    const due = new Date(now)
    due.setUTCDate(due.getUTCDate() + next.wait_days)
    patch.current_position = nextPos
    patch.next_due_at = due.toISOString()
  }

  const { data, error } = await admin.from('campaign_enrollments').update(patch).eq('id', enrollment.id).select().single()
  if (error) throw new Error(`enrollment_advance_failed: ${error.message}`)
  return data as EnrollmentRow
}

/** Arrêt : l'inscription passe stopped et ses brouillons en attente sont ignorés. */
export async function stopEnrollment(admin: SupabaseClient, enrollmentId: string, reason: string): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await admin
    .from('campaign_enrollments')
    .update({ status: 'stopped', stop_reason: reason, updated_at: now })
    .eq('id', enrollmentId)
  if (error) throw new Error(`enrollment_stop_failed: ${error.message}`)
  const { error: msgErr } = await admin
    .from('campaign_messages')
    .update({ status: 'skipped', updated_at: now })
    .eq('enrollment_id', enrollmentId)
    .eq('status', 'draft')
  if (msgErr) throw new Error(`messages_skip_failed: ${msgErr.message}`)
}

// ── Réponses : IMAP Hostinger ──────────────────────────────────────────────────

// Noms réels relevés par LIST le 15/09/2026 : séparateur « . », sous-dossiers de INBOX.
export const REPLY_FOLDERS = ['INBOX', 'INBOX.Prospects-BizDev']

export type ImapClient = InstanceType<typeof ImapFlow>

export interface Reply {
  subject: string
}

export function imapClient(): ImapClient | null {
  const user = Deno.env.get('HOSTINGER_EMAIL')
  const pass = Deno.env.get('HOSTINGER_IMAP_PASSWORD')
  if (!user || !pass) return null
  return new ImapFlow({ host: 'imap.hostinger.com', port: 993, secure: true, auth: { user, pass }, logger: false })
}

// Réponses automatiques (absence, congés, listes) : elles n'arrêtent pas la séquence.
const AUTO_HEADERS = /auto-submitted:\s*auto-(replied|generated)|x-autore(ply|spond):|precedence:\s*(auto_reply|bulk|junk|list)/i
const AUTO_SUBJECT = /(absence|absent|automatique|out of office|auto-?reply|cong[ée]s|vacances)/i

/** Cherche, dossier par dossier, un vrai mail du contact reçu depuis le début de l'inscription. */
export async function detectReplies(
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
          const msg = await client.fetchOne(
            String(uid),
            { envelope: true, internalDate: true, headers: ['auto-submitted', 'x-autoreply', 'x-autorespond', 'precedence'] },
            { uid: true },
          )
          const at = msg ? new Date(msg.internalDate ?? msg.envelope?.date ?? 0) : null
          if (!msg || !at || at < started) continue
          const subject = msg.envelope?.subject || ''
          if (AUTO_HEADERS.test(msg.headers?.toString() || '') || AUTO_SUBJECT.test(subject)) continue
          found.set(enrollment.id, { subject: subject || '(Sans objet)' })
          break
        }
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      console.error(`[campaign] IMAP ${folder}:`, m)
      errors.push(`imap:${folder}:${m}`)
    } finally {
      lock?.release()
    }
  }
  return found
}

/** Réponse reçue : séquence arrêtée, entrée « reçu » dans la timeline, lead réchauffé. */
export async function recordReply(
  admin: SupabaseClient,
  enrollmentId: string,
  lead: LeadRow,
  campaignName: string,
  reply: Reply,
  now: Date,
): Promise<void> {
  await stopEnrollment(admin, enrollmentId, 'replied')
  await appendTimeline(admin, lead.id, {
    date: todayISO(now),
    direction: 'reçu',
    sujet: reply.subject,
    résumé: `Réponse reçue, campagne « ${campaignName} » arrêtée`,
  })
  const patch: Record<string, string> = { maturity: 'chaud' }
  if (lead.status === 'nouveau' || lead.status === 'contacte') patch.status = 'en_discussion'
  const { error } = await admin.from('leads').update(patch).eq('id', lead.id)
  if (error) throw new Error(`lead_update_failed: ${error.message}`)
}
