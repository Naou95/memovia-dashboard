import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'
import { ImapFlow } from 'npm:imapflow'
import { simpleParser } from 'npm:mailparser'
import { Buffer } from 'node:buffer'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// ── Constants ──────────────────────────────────────────────────────────────────

const INTERNAL_EMAILS = ['bassou.naoufel@gmail.com', 'boutaleb.emir99@gmail.com']
const INTERNAL_DOMAIN = /@memovia\.io$/i

const GENERIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.fr', 'yahoo.com', 'hotmail.com',
  'hotmail.fr', 'outlook.com', 'outlook.fr', 'orange.fr', 'wanadoo.fr',
  'free.fr', 'sfr.fr', 'laposte.net', 'live.fr', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'protonmail.com', 'proton.me',
])

const NEWSLETTER_KEYWORDS = [
  'unsubscribe', 'list-unsubscribe', 'noreply', 'no-reply',
  'notification', 'newsletter', 'donotreply',
]

const KNOWN_SENT_FOLDERS = ['Sent', 'Sent Items', 'INBOX.Sent', 'Sent Messages']

const DAYS_BACK = 3
const MAX_PER_FOLDER = 5
const MAX_CONVERSATIONS = 5
const MAX_BODY_CHARS = 1000
const CLAUDE_DELAY_MS = 100
const GLOBAL_TIMEOUT_MS = 45_000

// ── Types ──────────────────────────────────────────────────────────────────────

interface RawEmail {
  uid: number
  messageId: string | null
  fromAddress: string
  fromName: string
  toAddresses: string[]
  subject: string
  date: string
  bodyText: string
  direction: 'envoyé' | 'reçu'
}

interface ClaudeAnalysis {
  is_lead: boolean
  org_name: string | null
  contact_name: string | null
  contact_email: string | null
  contact_role: string | null
  lead_type: 'ecole' | 'cfa' | 'entreprise' | 'autre' | null
  status: 'nouveau' | 'contacte' | 'en_discussion' | 'proposition' | 'relance' | null
  maturity: 'froid' | 'tiede' | 'chaud' | null
  last_contact_date: string | null
  next_action: string | null
  relance_count: number
  notes: string | null
  timeline: Array<{
    date: string
    direction: 'envoyé' | 'reçu'
    sujet: string
    résumé: string
  }> | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isInternalAddress(addr?: string): boolean {
  if (!addr) return false
  const lower = addr.toLowerCase().trim()
  return INTERNAL_EMAILS.includes(lower) || INTERNAL_DOMAIN.test(lower)
}

// Returns the conversation grouping key for an email.
// - Sent by us (from = internal) → key based on first external recipient
// - Received (from = external)   → key based on sender
// - Generic domain (gmail.com…)  → use full address as key
// - Proper domain                → use @domain as key
function getConversationKey(fromAddress: string, toAddresses: string[]): string | null {
  let externalAddress: string

  if (isInternalAddress(fromAddress)) {
    const ext = toAddresses.find((a) => !isInternalAddress(a))
    if (!ext) return null
    externalAddress = ext
  } else {
    externalAddress = fromAddress
  }

  const domain = externalAddress.split('@')[1]?.toLowerCase()
  if (!domain) return null
  return GENERIC_DOMAINS.has(domain) ? externalAddress : `@${domain}`
}

function isNewsletter(subject: string, bodyText: string): boolean {
  const haystack = (subject + ' ' + bodyText.slice(0, 500)).toLowerCase()
  return NEWSLETTER_KEYWORDS.some((kw) => haystack.includes(kw))
}

async function detectSentFolder(client: ImapFlow): Promise<string | null> {
  try {
    const list = await client.list()
    const bySpecial = list.find((m: { specialUse?: string; path: string; name: string }) =>
      m.specialUse === '\\Sent'
    )
    if (bySpecial) return bySpecial.path
    for (const known of KNOWN_SENT_FOLDERS) {
      const found = list.find((m: { path: string; name: string }) =>
        m.path === known || m.name === known
      )
      if (found) return found.path
    }
  } catch (err) {
    console.error('detectSentFolder error:', err)
  }
  return null
}

async function fetchFolderEmails(
  client: ImapFlow,
  folder: string,
  since: Date,
  isSent: boolean,
): Promise<RawEmail[]> {
  const results: RawEmail[] = []
  let lock: { release: () => void } | undefined

  try {
    lock = await client.getMailboxLock(folder)
  } catch (err) {
    console.error(`Failed to lock folder ${folder}:`, err)
    return results
  }

  try {
    const searchResult = await client.search({ since }, { uid: true })
    const uids = (searchResult || []).slice(-MAX_PER_FOLDER)
    if (uids.length === 0) return results

    // Fetch envelopes in batch
    const envelopes: Array<{
      uid: number
      messageId: string | null
      fromAddress: string
      fromName: string
      toAddresses: string[]
      subject: string
      date: string
    }> = []

    for await (const msg of client.fetch(
      uids,
      { envelope: true, uid: true, internalDate: true },
      { uid: true },
    )) {
      const from = msg.envelope.from?.[0]
      const toList = (msg.envelope.to || []) as Array<{ name?: string; address?: string }>
      envelopes.push({
        uid: Number(msg.uid),
        messageId: msg.envelope.messageId || null,
        fromAddress: (from?.address || '').toLowerCase(),
        fromName: from?.name || '',
        toAddresses: toList.map((a) => (a.address || '').toLowerCase()).filter(Boolean),
        subject: msg.envelope.subject || '(Sans objet)',
        date: msg.internalDate?.toISOString() || new Date().toISOString(),
      })
    }

    // Download bodies
    for (const env of envelopes) {
      // Skip purely internal emails
      const allAddresses = [env.fromAddress, ...env.toAddresses].filter(Boolean)
      const allInternal =
        allAddresses.length > 0 && allAddresses.every((a) => isInternalAddress(a))
      if (allInternal) continue

      const direction: 'envoyé' | 'reçu' =
        isSent || isInternalAddress(env.fromAddress) ? 'envoyé' : 'reçu'

      let bodyText = ''
      try {
        const download = await client.download(String(env.uid), undefined, { uid: true })
        if (download) {
          const chunks: Uint8Array[] = []
          for await (const chunk of download.content) {
            chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk)
          }
          const totalLen = chunks.reduce((n, c) => n + c.length, 0)
          const buffer = new Uint8Array(totalLen)
          let off = 0
          for (const chunk of chunks) {
            buffer.set(chunk, off)
            off += chunk.length
          }
          const parsed = await simpleParser(Buffer.from(buffer))
          bodyText = parsed.text || ''
        }
      } catch (err) {
        console.error(`Download failed uid=${env.uid} folder=${folder}:`, err)
      }

      if (isNewsletter(env.subject, bodyText)) continue

      results.push({
        uid: env.uid,
        messageId: env.messageId,
        fromAddress: env.fromAddress,
        fromName: env.fromName,
        toAddresses: env.toAddresses,
        subject: env.subject,
        date: env.date,
        bodyText,
        direction,
      })
    }
  } finally {
    try { lock?.release() } catch { /* ignore */ }
  }

  return results
}

const CLAUDE_SYSTEM_PROMPT =
  'Tu es un assistant CRM expert pour MEMOVIA AI, plateforme EdTech B2B pour CFAs et écoles ' +
  "(12€/licence/mois). Analyse ce fil de conversation et détermine s'il s'agit d'un prospect.\n\n" +
  'Réponds UNIQUEMENT en JSON valide :\n' +
  '{\n' +
  '  "is_lead": true,\n' +
  '  "org_name": "nom de l\'organisation ou null",\n' +
  '  "contact_name": "prénom nom ou null",\n' +
  '  "contact_email": "email principal ou null",\n' +
  '  "contact_role": "poste/fonction si détecté ou null",\n' +
  '  "lead_type": "ecole|cfa|entreprise|autre ou null",\n' +
  '  "status": "nouveau|contacte|en_discussion|proposition|relance",\n' +
  '  "maturity": "froid|tiede|chaud",\n' +
  '  "last_contact_date": "YYYY-MM-DD ou null",\n' +
  '  "next_action": "prochaine action recommandée ou null",\n' +
  '  "relance_count": 0,\n' +
  '  "notes": "résumé complet de la conversation ou null",\n' +
  '  "timeline": [{"date": "YYYY-MM-DD", "direction": "envoyé|reçu", "sujet": "...", "résumé": "..."}]\n' +
  '}\n\n' +
  'Statut : nouveau=aucun échange, contacte=envoyé sans réponse, en_discussion=échanges dans les deux sens, proposition=offre/démo/tarif envoyée, relance=on a relancé sans réponse.\n' +
  'Maturité : froid=contact initial ou sans réponse depuis +14 jours, tiede=échanges actifs sans décision, chaud=intérêt explicite ou demande de devis/démo imminente.'

function buildConversationMessage(conversation: RawEmail[]): string {
  const lines = [`Fil de conversation (${conversation.length} email(s)) :\n`]
  for (const email of conversation) {
    lines.push(
      `---\nDate: ${email.date}\nDirection: ${email.direction}\n` +
      `De: ${email.fromName} <${email.fromAddress}>\n` +
      `À: ${email.toAddresses.join(', ')}\n` +
      `Sujet: ${email.subject}\n\n` +
      `${email.bodyText.slice(0, MAX_BODY_CHARS)}\n`,
    )
  }
  return lines.join('\n')
}

function extractJson(text: string): ClaudeAnalysis | null {
  try { return JSON.parse(text) as ClaudeAnalysis } catch { /* try extract */ }
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) as ClaudeAnalysis } catch { return null }
}

async function analyzeConversation(
  apiKey: string,
  conversation: RawEmail[],
): Promise<ClaudeAnalysis | null> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: CLAUDE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildConversationMessage(conversation) }],
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`claude_api_${resp.status}: ${errText.slice(0, 200)}`)
  }

  const data = await resp.json() as { content?: Array<{ type: string; text?: string }> }
  const text = data.content?.find((c) => c.type === 'text')?.text || ''
  return extractJson(text)
}

// 'relance' from Claude maps to 'contacte' in DB; relance_count tracks the number
const STATUS_MAP: Record<string, string> = {
  nouveau: 'nouveau',
  contacte: 'contacte',
  en_discussion: 'en_discussion',
  proposition: 'proposition',
  relance: 'contacte',
}

async function upsertLead(
  supabaseAdmin: ReturnType<typeof createClient>,
  analysis: ClaudeAnalysis,
): Promise<'inserted' | 'updated' | 'skipped'> {
  const contactEmail = (analysis.contact_email || '').trim().toLowerCase() || null
  if (!contactEmail) return 'skipped'

  const leadType =
    analysis.lead_type && ['ecole', 'cfa', 'entreprise', 'autre'].includes(analysis.lead_type)
      ? analysis.lead_type
      : 'autre'
  const dbStatus = STATUS_MAP[analysis.status ?? 'nouveau'] ?? 'nouveau'
  const dbMaturity =
    analysis.maturity && ['froid', 'tiede', 'chaud'].includes(analysis.maturity)
      ? analysis.maturity
      : 'froid'

  const { data: existing } = await supabaseAdmin
    .from('leads')
    .select('id')
    .eq('contact_email', contactEmail)
    .maybeSingle()

  if (existing) {
    const { error: updateError } = await supabaseAdmin
      .from('leads')
      .update({
        name: analysis.org_name?.trim() || analysis.contact_name?.trim() || contactEmail,
        status: dbStatus,
        maturity: dbMaturity,
        notes: analysis.notes || null,
        next_action: analysis.next_action || null,
        relance_count: analysis.relance_count ?? 0,
        last_contact_date: analysis.last_contact_date || null,
        timeline: analysis.timeline || null,
        contact_role: analysis.contact_role || null,
      })
      .eq('id', existing.id)
    if (updateError) throw new Error(`update_failed: ${updateError.message}`)
    return 'updated'
  }

  const name =
    analysis.org_name?.trim() ||
    analysis.contact_name?.trim() ||
    contactEmail

  const { error: insertError } = await supabaseAdmin.from('leads').insert({
    name,
    type: leadType,
    canal: 'email',
    status: dbStatus,
    assigned_to: 'naoufel',
    notes: analysis.notes || null,
    contact_email: contactEmail,
    contact_name: analysis.contact_name?.trim() || null,
    contact_role: analysis.contact_role || null,
    maturity: dbMaturity,
    relance_count: analysis.relance_count ?? 0,
    last_contact_date: analysis.last_contact_date || null,
    next_action: analysis.next_action || null,
    timeline: analysis.timeline || null,
    source: 'email_auto',
  })
  if (insertError) throw new Error(`insert_failed: ${insertError.message}`)
  return 'inserted'
}

// ── Core logic (extracted for timeout wrapping) ────────────────────────────────

async function runDetector(
  supabaseAdmin: ReturnType<typeof createClient>,
  imapUser: string,
  imapPass: string,
  anthropicKey: string,
): Promise<Response> {
  const client = new ImapFlow({
    host: 'imap.hostinger.com',
    port: 993,
    secure: true,
    auth: { user: imapUser, pass: imapPass },
    logger: false,
    socketTimeout: 20000,
    greetingTimeout: 10000,
    connectionTimeout: 10000,
  })

  const stats = { analyzed: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 }

  try {
    await client.connect()

    const since = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000)

    const sentFolder = await detectSentFolder(client)

    const allEmails: RawEmail[] = []
    allEmails.push(...await fetchFolderEmails(client, 'INBOX', since, false))
    if (sentFolder) {
      allEmails.push(...await fetchFolderEmails(client, sentFolder, since, true))
    }

    const groups = new Map<string, RawEmail[]>()
    for (const email of allEmails) {
      const key = getConversationKey(email.fromAddress, email.toAddresses)
      if (!key) continue
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(email)
    }

    const conversations = [...groups.values()]
      .map((emails) => emails.sort((a, b) => a.date.localeCompare(b.date)))
      .sort((a, b) => {
        const aLast = a[a.length - 1]?.date ?? ''
        const bLast = b[b.length - 1]?.date ?? ''
        return bLast.localeCompare(aLast)
      })
      .slice(0, MAX_CONVERSATIONS)

    for (const conversation of conversations) {
      stats.analyzed++
      let analysis: ClaudeAnalysis | null = null
      try {
        analysis = await analyzeConversation(anthropicKey, conversation)
      } catch (err) {
        console.error('Claude error:', err)
        stats.errors++
        await new Promise((r) => setTimeout(r, CLAUDE_DELAY_MS))
        continue
      }

      await new Promise((r) => setTimeout(r, CLAUDE_DELAY_MS))

      if (!analysis) { stats.errors++; continue }
      if (!analysis.is_lead) { stats.skipped++; continue }

      try {
        const result = await upsertLead(supabaseAdmin, analysis)
        if (result === 'inserted') stats.inserted++
        else if (result === 'updated') stats.updated++
        else stats.skipped++
      } catch (err) {
        console.error('Upsert error:', err)
        stats.errors++
      }
    }

    await client.logout()
    return Response.json(stats, { headers: corsHeaders })
  } catch (err) {
    try { await client.logout() } catch { /* ignore */ }
    console.error('email-lead-detector error:', err)
    return errorResponse('imap_connection_failed', 503)
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const isCronCall = serviceRoleKey.length > 0 && authHeader === `Bearer ${serviceRoleKey}`
  if (!isCronCall) {
    const authResult = await validateAuth(req)
    if (authResult instanceof Response) return authResult
  }

  const imapUser = Deno.env.get('HOSTINGER_EMAIL')
  const imapPass = Deno.env.get('HOSTINGER_IMAP_PASSWORD')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!imapUser || !imapPass) return errorResponse('email_not_configured', 500)
  if (!anthropicKey) return errorResponse('anthropic_not_configured', 500)

  try { await req.json() } catch { /* ignore */ }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const timeout = new Promise<Response>((resolve) =>
    setTimeout(
      () => resolve(Response.json({ error: 'global_timeout', partial: true }, { status: 504, headers: corsHeaders })),
      GLOBAL_TIMEOUT_MS,
    )
  )

  return Promise.race([
    runDetector(supabaseAdmin, imapUser, imapPass, anthropicKey),
    timeout,
  ])
})
