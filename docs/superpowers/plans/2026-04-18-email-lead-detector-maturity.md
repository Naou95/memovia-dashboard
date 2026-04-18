# Email Lead Detector — Analyse Maturité Conversationnelle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre `email-lead-detector` pour analyser des fils de conversation complets (INBOX + Sent) groupés par interlocuteur, évaluer la maturité prospect (froid/tiède/chaud), et UPSERT les leads plutôt que créer des doublons. Afficher les nouvelles métriques (maturité, relances, dernier contact) dans la vue Prospection.

**Architecture:** Deux passes IMAP séquentielles (INBOX puis Sent détecté dynamiquement via `client.list()`), emails groupés par clé domaine/adresse, triés chronologiquement, analysés par Claude en tant que conversation complète. UPSERT par `contact_email` avec SELECT + INSERT/UPDATE manuel.

**Tech Stack:** Deno/TypeScript (Edge Function), ImapFlow, mailparser, Claude Haiku API, Supabase JS v2, React + Tailwind CSS.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/00017_leads_maturity_fields.sql` | Create | Nouvelles colonnes DB : contact_role, maturity, relance_count, last_contact_date, timeline |
| `supabase/functions/email-lead-detector/index.ts` | Rewrite | Groupement conversations, prompt Claude conversationnel, UPSERT |
| `src/types/leads.ts` | Modify | LeadMaturity, TimelineEntry, nouvelles colonnes sur Lead, LEAD_MATURITY_LABELS |
| `src/modules/prospection/components/LeadMaturityBadge.tsx` | Create | Pill colorée froid/tiède/chaud |
| `src/modules/prospection/components/LeadKanban.tsx` | Modify | Badges maturité + relances + dernier contact dans les cards |
| `src/modules/prospection/components/LeadTable.tsx` | Modify | Colonnes Maturité + Dernier contact + Relances |

---

## Task 1 : Migration DB — nouvelles colonnes

**Files:**
- Create: `supabase/migrations/00017_leads_maturity_fields.sql`

- [ ] **Step 1 : Créer la migration**

```sql
-- supabase/migrations/00017_leads_maturity_fields.sql
-- Ajout des colonnes de maturité conversationnelle sur leads

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS contact_role      TEXT,
  ADD COLUMN IF NOT EXISTS maturity          TEXT DEFAULT 'froid'
    CHECK (maturity IN ('froid', 'tiede', 'chaud')),
  ADD COLUMN IF NOT EXISTS relance_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contact_date DATE,
  ADD COLUMN IF NOT EXISTS timeline          JSONB;
```

Note : `tiede` sans accent dans la contrainte SQL ; le label affiché "Tiède" est défini côté TypeScript. Le statut 'relance' retourné par Claude est mappé vers 'contacte' dans l'Edge Function avant insertion (relance_count capture le nombre de relances).

- [ ] **Step 2 : Appliquer la migration via Supabase MCP**

Utilise l'outil MCP Supabase `apply_migration` avec le contenu SQL ci-dessus sur le projet `mzjzwffpqubpruyaaxew`.

Si MCP indisponible, exécute :
```bash
npx supabase db push --project-ref mzjzwffpqubpruyaaxew
```

- [ ] **Step 3 : Vérifier les colonnes**

Exécute via MCP `execute_sql` :
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name IN ('contact_role','maturity','relance_count','last_contact_date','timeline')
ORDER BY column_name;
```

Résultat attendu : 5 lignes, `maturity` DEFAULT 'froid', `relance_count` DEFAULT 0.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/00017_leads_maturity_fields.sql
git commit -m "feat(db): ajouter colonnes maturité conversationnelle sur leads"
```

---

## Task 2 : Types TypeScript — Lead + maturité

**Files:**
- Modify: `src/types/leads.ts`

- [ ] **Step 1 : Remplacer le contenu de `src/types/leads.ts`**

```typescript
export type LeadStatus =
  | 'nouveau'
  | 'contacte'
  | 'en_discussion'
  | 'proposition'
  | 'gagne'
  | 'perdu'

export type LeadType = 'ecole' | 'cfa' | 'entreprise' | 'autre'
export type LeadCanal = 'linkedin' | 'email' | 'referral' | 'appel' | 'autre'
export type LeadAssignee = 'naoufel' | 'emir'
export type LeadMaturity = 'froid' | 'tiede' | 'chaud'

export interface TimelineEntry {
  date: string
  direction: 'envoyé' | 'reçu'
  sujet: string
  résumé: string
}

export interface Lead {
  id: string
  name: string
  type: LeadType
  canal: LeadCanal
  status: LeadStatus
  next_action: string | null
  follow_up_date: string | null
  assigned_to: LeadAssignee | null
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  // Email auto fields
  contact_email: string | null
  contact_name: string | null
  contact_role: string | null
  source: string | null
  // Maturity fields
  maturity: LeadMaturity | null
  relance_count: number
  last_contact_date: string | null
  timeline: TimelineEntry[] | null
}

export type LeadInsert = Omit<Lead, 'id' | 'created_at' | 'updated_at'>
export type LeadUpdate = Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at'>>

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  en_discussion: 'En discussion',
  proposition: 'Proposition envoyée',
  gagne: 'Gagné',
  perdu: 'Perdu',
}

export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  ecole: 'École',
  cfa: 'CFA',
  entreprise: 'Entreprise',
  autre: 'Autre',
}

export const LEAD_CANAL_LABELS: Record<LeadCanal, string> = {
  linkedin: 'LinkedIn',
  email: 'Email',
  referral: 'Référence',
  appel: 'Appel',
  autre: 'Autre',
}

export const LEAD_ASSIGNEE_LABELS: Record<LeadAssignee, string> = {
  naoufel: 'Naoufel',
  emir: 'Emir',
}

export const LEAD_MATURITY_LABELS: Record<LeadMaturity, string> = {
  froid: 'Froid',
  tiede: 'Tiède',
  chaud: 'Chaud',
}

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  'nouveau',
  'contacte',
  'en_discussion',
  'proposition',
  'gagne',
  'perdu',
]
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
npx tsc --noEmit
```

Attendu : 0 erreur. Si erreurs sur `contact_email`/`contact_name`/`source` déjà absents de l'interface précédente, c'est normal — ces champs étaient en DB mais pas dans le type.

- [ ] **Step 3 : Commit**

```bash
git add src/types/leads.ts
git commit -m "feat(types): LeadMaturity, TimelineEntry, nouvelles colonnes Lead"
```

---

## Task 3 : Composant LeadMaturityBadge

**Files:**
- Create: `src/modules/prospection/components/LeadMaturityBadge.tsx`

- [ ] **Step 1 : Créer le composant**

```typescript
// src/modules/prospection/components/LeadMaturityBadge.tsx
import type { LeadMaturity } from '@/types/leads'
import { LEAD_MATURITY_LABELS } from '@/types/leads'

interface LeadMaturityBadgeProps {
  maturity: LeadMaturity
}

const MATURITY_STYLES: Record<LeadMaturity, React.CSSProperties> = {
  froid: {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-label)',
    border: '1px solid var(--border-color)',
  },
  tiede: {
    backgroundColor: '#fef3c7',
    color: '#d97706',
    border: '1px solid #fde68a',
  },
  chaud: {
    backgroundColor: 'color-mix(in oklab, var(--success) 15%, white)',
    color: 'var(--success)',
    border: '1px solid color-mix(in oklab, var(--success) 30%, white)',
  },
}

export function LeadMaturityBadge({ maturity }: LeadMaturityBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={MATURITY_STYLES[maturity]}
    >
      {LEAD_MATURITY_LABELS[maturity]}
    </span>
  )
}
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
npx tsc --noEmit
```

Attendu : 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add src/modules/prospection/components/LeadMaturityBadge.tsx
git commit -m "feat(prospection): composant LeadMaturityBadge froid/tiède/chaud"
```

---

## Task 4 : Edge Function — réécriture complète

**Files:**
- Rewrite: `supabase/functions/email-lead-detector/index.ts`

- [ ] **Step 1 : Remplacer le contenu de `supabase/functions/email-lead-detector/index.ts`**

```typescript
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

const DAYS_BACK = 30
const MAX_CONVERSATIONS = 20
const MAX_BODY_CHARS = 2000
const CLAUDE_DELAY_MS = 200

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
    const uids = (searchResult || []).slice(-50)
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
    await supabaseAdmin
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
    return 'updated'
  }

  const name =
    analysis.org_name?.trim() ||
    analysis.contact_name?.trim() ||
    contactEmail

  await supabaseAdmin.from('leads').insert({
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
  return 'inserted'
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

  const client = new ImapFlow({
    host: 'imap.hostinger.com',
    port: 993,
    secure: true,
    auth: { user: imapUser, pass: imapPass },
    logger: false,
    socketTimeout: 30000,
    greetingTimeout: 15000,
    connectionTimeout: 15000,
  })

  const stats = { analyzed: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 }

  try {
    await client.connect()

    const since = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000)

    // Detect Sent folder
    const sentFolder = await detectSentFolder(client)

    // Fetch emails from INBOX and Sent
    const allEmails: RawEmail[] = []
    const inboxEmails = await fetchFolderEmails(client, 'INBOX', since, false)
    allEmails.push(...inboxEmails)

    if (sentFolder) {
      const sentEmails = await fetchFolderEmails(client, sentFolder, since, true)
      allEmails.push(...sentEmails)
    }

    // Group by conversation key
    const groups = new Map<string, RawEmail[]>()
    for (const email of allEmails) {
      const key = getConversationKey(email.fromAddress, email.toAddresses)
      if (!key) continue
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(email)
    }

    // Sort each group chronologically; keep top MAX_CONVERSATIONS by most recent activity
    const conversations = [...groups.values()]
      .map((emails) => emails.sort((a, b) => a.date.localeCompare(b.date)))
      .sort((a, b) => {
        const aLast = a[a.length - 1]?.date ?? ''
        const bLast = b[b.length - 1]?.date ?? ''
        return bLast.localeCompare(aLast)
      })
      .slice(0, MAX_CONVERSATIONS)

    // Analyze each conversation
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
})
```

- [ ] **Step 2 : Vérifier la compilation Deno**

```bash
cd supabase/functions/email-lead-detector
deno check index.ts
```

Attendu : pas d'erreurs de type. Si `deno` n'est pas disponible localement, passer directement au déploiement (Task 6).

- [ ] **Step 3 : Commit**

```bash
git add supabase/functions/email-lead-detector/index.ts
git commit -m "feat(email): analyse maturité conversationnelle — groupement fils + UPSERT"
```

---

## Task 5 : LeadKanban — badges maturité + relances

**Files:**
- Modify: `src/modules/prospection/components/LeadKanban.tsx`

- [ ] **Step 1 : Ajouter l'import de LeadMaturityBadge**

Dans `src/modules/prospection/components/LeadKanban.tsx`, ajouter après la ligne d'import de lucide-react :

```typescript
import { LeadMaturityBadge } from './LeadMaturityBadge'
```

- [ ] **Step 2 : Mettre à jour `CardContent` — ajouter maturité + relances + dernier contact**

Remplacer le bloc `<div className="mt-2 flex flex-wrap items-center gap-1.5">` et tout ce qui suit jusqu'à la fermeture `</div>` du card body par :

```typescript
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
              {LEAD_CANAL_LABELS[lead.canal]}
            </span>
            {lead.assigned_to && (
              <span className="rounded-full bg-[var(--accent-purple-bg)] px-2 py-0.5 text-[11px] text-[var(--memovia-violet)]">
                {LEAD_ASSIGNEE_LABELS[lead.assigned_to]}
              </span>
            )}
            {lead.maturity && <LeadMaturityBadge maturity={lead.maturity} />}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {lead.relance_count > 0 && (
              <span className="text-[11px] text-[var(--text-muted)]">
                {lead.relance_count} relance{lead.relance_count > 1 ? 's' : ''}
              </span>
            )}
            {lead.last_contact_date && (
              <span className="text-[11px] text-[var(--text-muted)]">
                Contact : {formatDate(lead.last_contact_date)}
              </span>
            )}
          </div>

          {lead.follow_up_date && (
            <div
              className="mt-2 flex items-center gap-1 text-[11px]"
              style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}
            >
              <CalendarClock className="h-3 w-3" />
              <span>{formatDate(lead.follow_up_date)}</span>
            </div>
          )}

          {lead.next_action && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
              {lead.next_action}
            </p>
          )}
```

- [ ] **Step 3 : Vérifier la compilation**

```bash
npx tsc --noEmit
```

Attendu : 0 erreur.

- [ ] **Step 4 : Commit**

```bash
git add src/modules/prospection/components/LeadKanban.tsx
git commit -m "feat(kanban): badges maturité, relances et dernier contact dans les cards"
```

---

## Task 6 : LeadTable — colonnes Maturité + Dernier contact + Relances

**Files:**
- Modify: `src/modules/prospection/components/LeadTable.tsx`

- [ ] **Step 1 : Ajouter l'import de LeadMaturityBadge**

En haut de `src/modules/prospection/components/LeadTable.tsx`, ajouter après les imports existants :

```typescript
import { LeadMaturityBadge } from './LeadMaturityBadge'
```

- [ ] **Step 2 : Remplacer les headers du tableau**

Remplacer :
```typescript
{['Lead', 'Type', 'Canal', 'Statut', 'Assigné', 'Prochaine action', 'Relance', 'Actions'].map(
  (h, i) => (
    <th
      key={h}
      scope="col"
      className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)] ${
        i === 7 ? 'text-right' : 'text-left'
      }`}
    >
      {h}
    </th>
  )
)}
```

Par :
```typescript
{['Lead', 'Type', 'Canal', 'Statut', 'Maturité', 'Assigné', 'Prochaine action', 'Dernier contact', 'Relances', 'Actions'].map(
  (h, i) => (
    <th
      key={h}
      scope="col"
      className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)] ${
        i === 9 ? 'text-right' : 'text-left'
      }`}
    >
      {h}
    </th>
  )
)}
```

- [ ] **Step 3 : Mettre à jour SkeletonRow pour 10 colonnes**

Remplacer :
```typescript
function SkeletonRow() {
  return (
    <tr>
      {[...Array(8)].map((_, i) => (
```

Par :
```typescript
function SkeletonRow() {
  return (
    <tr>
      {[...Array(10)].map((_, i) => (
```

- [ ] **Step 4 : Mettre à jour le colSpan de la ligne vide**

Remplacer `colSpan={8}` par `colSpan={10}`.

- [ ] **Step 5 : Remplacer les cellules de données dans le `leads.map`**

Remplacer les cellules existantes (de `{/* Statut */}` jusqu'à `{/* Actions */}` inclus) par :

```typescript
                {/* Statut */}
                <td className="px-4 py-3">
                  <LeadStatusBadge status={lead.status} />
                </td>

                {/* Maturité */}
                <td className="px-4 py-3">
                  {lead.maturity ? (
                    <LeadMaturityBadge maturity={lead.maturity} />
                  ) : (
                    <span className="text-[var(--text-muted)]">—</span>
                  )}
                </td>

                {/* Assigné */}
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {lead.assigned_to ? LEAD_ASSIGNEE_LABELS[lead.assigned_to] : '—'}
                </td>

                {/* Prochaine action */}
                <td className="max-w-[200px] px-4 py-3 text-[var(--text-secondary)]">
                  <span className="line-clamp-1">{lead.next_action ?? '—'}</span>
                </td>

                {/* Dernier contact */}
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {formatDate(lead.last_contact_date)}
                </td>

                {/* Relances */}
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {lead.relance_count > 0 ? lead.relance_count : '—'}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(lead)}
                      className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-[var(--memovia-violet)]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">Modifier</span>
                    </Button>

                    {canDelete &&
                      (confirmingId === lead.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmingId(null)}
                            className="h-7 px-2 text-[12px] text-[var(--text-muted)]"
                          >
                            Annuler
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(lead.id)}
                            disabled={deletingId === lead.id}
                            className="h-7 px-2 text-[12px] text-[var(--danger)] hover:bg-[var(--trend-down-bg)]"
                          >
                            {deletingId === lead.id ? '...' : 'Confirmer'}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmingId(lead.id)}
                          className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-[var(--danger)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Supprimer</span>
                        </Button>
                      ))}
                  </div>
                </td>
```

- [ ] **Step 6 : Vérifier la compilation**

```bash
npx tsc --noEmit
```

Attendu : 0 erreur.

- [ ] **Step 7 : Commit**

```bash
git add src/modules/prospection/components/LeadTable.tsx
git commit -m "feat(table): colonnes maturité, dernier contact et relances"
```

---

## Task 7 : Déploiement Edge Function + validation

**Files:** aucun — déploiement uniquement

- [ ] **Step 1 : Déployer l'Edge Function**

```bash
npx supabase functions deploy email-lead-detector --project-ref mzjzwffpqubpruyaaxew
```

Attendu : `Deployed email-lead-detector`.

- [ ] **Step 2 : Tester manuellement**

```bash
curl -X POST \
  https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/email-lead-detector \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Attendu (JSON) : `{ "analyzed": N, "inserted": M, "updated": P, "skipped": Q, "errors": 0 }`

Si `errors > 0`, consulter les logs :
```bash
npx supabase functions logs email-lead-detector --project-ref mzjzwffpqubpruyaaxew
```

- [ ] **Step 3 : Vérifier les leads en DB**

Via MCP `execute_sql` ou Supabase Studio :
```sql
SELECT id, name, maturity, relance_count, last_contact_date, status, source
FROM public.leads
WHERE source = 'email_auto'
ORDER BY updated_at DESC
LIMIT 10;
```

Attendu : lignes avec `maturity` non null, `relance_count >= 0`, `source = 'email_auto'`.

- [ ] **Step 4 : Vérifier le frontend**

Lancer le dev server :
```bash
npm run dev
```

Aller sur `/prospection` → vérifier :
1. Vue tableau : colonnes "Maturité", "Dernier contact", "Relances" présentes
2. Vue kanban : badges maturité visibles sur les cards des leads `email_auto`
3. Les leads manuels (sans maturity) affichent `—` dans la colonne Maturité

- [ ] **Step 5 : Commit final**

```bash
git add -A
git commit -m "feat(prospection): refonte email-lead-detector maturité conversationnelle"
git push
```

---

## Self-Review

**Couverture spec :**
- ✅ Groupement par domaine + fallback adresse exacte pour domaines génériques → `getConversationKey()`
- ✅ Détection dynamique dossier Sent → `detectSentFolder()`
- ✅ INBOX + Sent 30 jours → `fetchFolderEmails()` × 2
- ✅ Filtrage newsletters → `isNewsletter()`
- ✅ Max 20 conversations → `.slice(0, MAX_CONVERSATIONS)`
- ✅ Prompt Claude conversationnel avec tous les champs → `CLAUDE_SYSTEM_PROMPT`
- ✅ UPSERT par `contact_email` → `upsertLead()`
- ✅ Skip si `contact_email` null → guard dans `upsertLead()`
- ✅ Mapping `status: 'relance'` → `'contacte'` + `relance_count` → `STATUS_MAP`
- ✅ Migration DB 5 colonnes → Task 1
- ✅ Types TS → Task 2
- ✅ `LeadMaturityBadge` → Task 3
- ✅ Kanban cards → Task 5
- ✅ LeadTable 10 colonnes → Task 6
- ✅ `useLeads` pas modifié (select `*` récupère automatiquement les nouvelles colonnes)
- ✅ `LeadForm` pas modifié
- ✅ Cron trigger pas modifié

**Cohérence des types :**
- `LeadMaturity` défini dans `leads.ts` Task 2 → utilisé dans `LeadMaturityBadge` Task 3 ✅
- `lead.relance_count` est `number` (not null, default 0) → comparaisons `> 0` sans null-check ✅
- `lead.last_contact_date` est `string | null` → `formatDate()` gère null → retourne `'—'` ✅
- `lead.maturity` est `LeadMaturity | null` → guard `{lead.maturity && ...}` dans kanban ✅
