# Copilote IA — Contexte enrichi + Tool Use Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir le copilote IA avec un contexte live complet de tous les modules (tâches, leads, contrats, calendrier, Stripe, Qonto) et lui donner la capacité d'exécuter des actions directes (créer tâche, changer statut lead, créer contrat) avec rendu de cartes structurées dans le chat.

**Architecture:** Approche A — Tool use natif Anthropic dans l'Edge Function. La fonction `copilot-chat` fait un appel non-streaming à Claude avec 3 outils définis. Si un outil est appelé, la DB op est exécutée via Supabase avec le JWT user, une carte JSON est émise en SSE (`event: tool_result`), puis un second appel streaming produit la réponse textuelle finale. Si aucun outil n'est appelé, le texte est émis comme un seul event SSE.

**Tech Stack:** TypeScript, React, Supabase (direct queries + Edge Functions), Anthropic API (tool use), Tailwind CSS + CSS custom vars MEMOVIA.

---

## Structure des fichiers

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `src/hooks/useCopilot.ts` | Modifier | Types enrichis, loadContext() étendu, parser SSE pour tool_result |
| `supabase/functions/copilot-chat/index.ts` | Réécrire | Tool definitions, appel non-streaming, exécution DB, SSE étendu |
| `src/components/copilot/TaskCard.tsx` | Créer | Carte tâche créée (statut, priorité, assigné, date) |
| `src/components/copilot/LeadCard.tsx` | Créer | Carte lead mis à jour (ancien → nouveau statut) |
| `src/components/copilot/ContractCard.tsx` | Créer | Carte contrat créé (org, MRR, licences, statut) |
| `src/components/copilot/CopilotBubble.tsx` | Modifier | Rendu des nouveaux types de messages + chips d'action |

---

## Task 1 : Étendre les types et `loadContext()` dans `useCopilot.ts`

**Files:**
- Modify: `src/hooks/useCopilot.ts`

- [ ] **Step 1.1 : Remplacer les interfaces en tête de fichier**

Remplacer les 3 interfaces existantes (`ChatMessage`, `DashboardContext`, `UseCopilotReturn`) par les nouvelles :

```typescript
// ── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface TaskSummary {
  id: string
  title: string
  status: 'todo' | 'en_cours'
  priority: 'haute' | 'normale' | 'basse'
  assigned_to: string | null
  due_date: string | null
}

interface LeadSummary {
  id: string
  name: string
  type: string
  status: string
  assigned_to: string | null
  next_action: string | null
}

interface ContractSummary {
  id: string
  organization_name: string
  status: string
  mrr_eur: number | null
  license_count: number
}

interface CalendarEventSummary {
  title: string
  start: string
  end: string
}

interface DashboardContext {
  mrr?: number
  arr?: number
  activeSubscriptions?: number
  qontoBalance?: number
  tasks?: TaskSummary[]
  leads?: LeadSummary[]
  contracts?: ContractSummary[]
  todayEvents?: CalendarEventSummary[]
}

export interface TaskCardData {
  id: string
  title: string
  assigned_to: string
  priority: 'haute' | 'normale' | 'basse'
  status: 'todo' | 'en_cours'
  due_date: string | null
}

export interface LeadCardData {
  id: string
  name: string
  old_status: string
  new_status: string
  type: string
}

export interface ContractCardData {
  id: string
  organization_name: string
  mrr_eur: number | null
  license_count: number
  status: string
}

export type ToolResultCard =
  | { kind: 'task'; data: TaskCardData }
  | { kind: 'lead'; data: LeadCardData }
  | { kind: 'contract'; data: ContractCardData }

export interface ToolResultMessage {
  id: string
  role: 'assistant'
  type: 'tool_result'
  tool: ToolResultCard
}

export type CopilotMessage = ChatMessage | ToolResultMessage

export interface UseCopilotReturn {
  messages: CopilotMessage[]
  isStreaming: boolean
  contextReady: boolean
  contextLoading: boolean
  sendMessage: (text: string) => Promise<void>
  clearHistory: () => void
}
```

- [ ] **Step 1.2 : Mettre à jour la déclaration du hook et les refs de type**

Remplacer :
```typescript
export function useCopilot(open: boolean): UseCopilotReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
```

Par :
```typescript
export function useCopilot(open: boolean): UseCopilotReturn {
  const [messages, setMessages] = useState<CopilotMessage[]>([])
```

Et remplacer :
```typescript
  const messagesRef = useRef<ChatMessage[]>([])
```
Par :
```typescript
  const messagesRef = useRef<CopilotMessage[]>([])
```

- [ ] **Step 1.3 : Remplacer la fonction `fetchContext` complète**

Remplacer tout le bloc `const fetchContext = async () => { ... }` (lignes ~61-118) par :

```typescript
    const fetchContext = async () => {
      try {
        const today = new Date()
        const todayStr = today.toISOString().slice(0, 10) // YYYY-MM-DD

        const [
          stripeResult,
          qontoResult,
          tasksResult,
          leadsResult,
          contractsResult,
          calendarResult,
        ] = await Promise.allSettled([
          supabase.functions.invoke('get-stripe-finance'),
          supabase.functions.invoke('get-qonto-balance'),
          supabase
            .from('tasks')
            .select('id, title, status, priority, assigned_to, due_date')
            .neq('status', 'done')
            .order('due_date', { ascending: true, nullsFirst: false }),
          supabase
            .from('leads')
            .select('id, name, type, status, assigned_to, next_action')
            .not('status', 'in', '("gagne","perdu")')
            .order('created_at', { ascending: false }),
          supabase
            .from('contracts')
            .select('id, organization_name, status, mrr_eur, license_count')
            .in('status', ['actif', 'signe', 'negotiation', 'prospect'])
            .order('created_at', { ascending: false }),
          supabase.functions.invoke('get-calendar-events'),
        ])

        const ctx: DashboardContext = {}

        if (stripeResult.status === 'fulfilled' && stripeResult.value.data) {
          const d = stripeResult.value.data as { mrr?: number; arr?: number; activeSubscriptions?: number }
          if (d.mrr !== undefined) ctx.mrr = d.mrr
          if (d.arr !== undefined) ctx.arr = d.arr
          if (ctx.mrr !== undefined && ctx.arr === undefined) {
            ctx.arr = Math.round(ctx.mrr * 12 * 100) / 100
          }
          if (d.activeSubscriptions !== undefined) ctx.activeSubscriptions = d.activeSubscriptions
        }

        if (qontoResult.status === 'fulfilled' && qontoResult.value.data) {
          const d = qontoResult.value.data as { balance?: number }
          if (d.balance !== undefined) ctx.qontoBalance = d.balance
        }

        if (tasksResult.status === 'fulfilled' && tasksResult.value.data) {
          ctx.tasks = (tasksResult.value.data as TaskSummary[]).slice(0, 30)
        }

        if (leadsResult.status === 'fulfilled' && leadsResult.value.data) {
          ctx.leads = (leadsResult.value.data as LeadSummary[]).slice(0, 30)
        }

        if (contractsResult.status === 'fulfilled' && contractsResult.value.data) {
          ctx.contracts = (contractsResult.value.data as ContractSummary[]).slice(0, 20)
        }

        if (calendarResult.status === 'fulfilled' && calendarResult.value.data) {
          const events = calendarResult.value.data as { events?: CalendarEventSummary[] }
          if (Array.isArray(events?.events)) {
            ctx.todayEvents = events.events
              .filter((e) => e.start.slice(0, 10) === todayStr)
              .map((e) => ({ title: e.title, start: e.start, end: e.end }))
              .slice(0, 10)
          }
        }

        contextRef.current = ctx
      } finally {
        setContextReady(true)
        setContextLoading(false)
        contextDoneResolveRef.current?.()
      }
    }
```

- [ ] **Step 1.4 : Mettre à jour le filtre history dans `sendMessage`**

Dans `sendMessage`, remplacer :
```typescript
            history: messagesRef.current
              .slice(-10)
              .map((m) => ({ role: m.role, content: m.content })),
```
Par :
```typescript
            history: messagesRef.current
              .filter((m): m is ChatMessage => !('type' in m && m.type === 'tool_result'))
              .slice(-10)
              .map((m) => ({ role: m.role, content: m.content })),
```

- [ ] **Step 1.5 : Mettre à jour le parser SSE dans `sendMessage`**

Remplacer tout le bloc `while (true) { ... }` (la boucle de lecture du stream) par :

```typescript
        let buffer = ''
        let currentEvent = 'message'

        while (true) {
          const { done, value } = await reader.read()
          if (done || abort.signal.aborted) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim()
              continue
            }
            if (line === '') {
              currentEvent = 'message'
              continue
            }
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') break

            if (currentEvent === 'tool_result') {
              try {
                const toolResult = JSON.parse(data) as { type: string; payload: Record<string, unknown> }
                const card = parseToolResultCard(toolResult)
                if (card) {
                  setMessages((prev) => {
                    const withoutStreaming = prev.slice(0, -1)
                    const toolMsg: ToolResultMessage = {
                      id: crypto.randomUUID(),
                      role: 'assistant',
                      type: 'tool_result',
                      tool: card,
                    }
                    const newStreaming: ChatMessage = {
                      id: crypto.randomUUID(),
                      role: 'assistant',
                      content: '',
                      streaming: true,
                    }
                    return [...withoutStreaming, toolMsg, newStreaming]
                  })
                }
              } catch { /* skip malformed */ }
              currentEvent = 'message'
              continue
            }

            try {
              const parsed = JSON.parse(data)
              if (
                parsed.type === 'content_block_delta' &&
                parsed.delta?.type === 'text_delta'
              ) {
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last && 'content' in last && last.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: (last as ChatMessage).content + parsed.delta.text,
                    }
                  }
                  return updated
                })
              }
            } catch { /* malformed SSE chunk — skip */ }
          }
        }
```

- [ ] **Step 1.6 : Ajouter la fonction helper `parseToolResultCard` avant le hook**

Ajouter après les imports, avant `export function useCopilot` :

```typescript
function parseToolResultCard(raw: { type: string; payload: Record<string, unknown> }): ToolResultCard | null {
  if (raw.type === 'create_task') {
    const p = raw.payload
    return {
      kind: 'task',
      data: {
        id: String(p.id ?? ''),
        title: String(p.title ?? ''),
        assigned_to: String(p.assigned_to ?? ''),
        priority: (p.priority as TaskCardData['priority']) ?? 'normale',
        status: (p.status as TaskCardData['status']) ?? 'todo',
        due_date: p.due_date ? String(p.due_date) : null,
      },
    }
  }
  if (raw.type === 'update_lead_status') {
    const p = raw.payload
    return {
      kind: 'lead',
      data: {
        id: String(p.id ?? ''),
        name: String(p.name ?? ''),
        old_status: String(p.old_status ?? ''),
        new_status: String(p.new_status ?? ''),
        type: String(p.type ?? ''),
      },
    }
  }
  if (raw.type === 'create_contract') {
    const p = raw.payload
    return {
      kind: 'contract',
      data: {
        id: String(p.id ?? ''),
        organization_name: String(p.organization_name ?? ''),
        mrr_eur: p.mrr_eur !== undefined ? Number(p.mrr_eur) : null,
        license_count: Number(p.license_count ?? 0),
        status: String(p.status ?? ''),
      },
    }
  }
  return null
}
```

- [ ] **Step 1.7 : Vérifier la compilation TypeScript**

```bash
cd /Users/naoufelbassou/memovia-dashboard
npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreur sur `src/hooks/useCopilot.ts`

- [ ] **Step 1.8 : Commit**

```bash
cd /Users/naoufelbassou/memovia-dashboard
git add src/hooks/useCopilot.ts
git commit -m "feat(copilot): étendre contexte live + types tool_result dans useCopilot"
```

---

## Task 2 : Réécrire `copilot-chat/index.ts` avec tool use

**Files:**
- Modify: `supabase/functions/copilot-chat/index.ts`

- [ ] **Step 2.1 : Remplacer tout le contenu du fichier**

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

interface AnthropicContentBlock {
  type: string
  [key: string]: unknown
}

interface TaskSummary { id: string; title: string; status: string; priority: string; assigned_to: string | null; due_date: string | null }
interface LeadSummary { id: string; name: string; type: string; status: string; assigned_to: string | null; next_action: string | null }
interface ContractSummary { id: string; organization_name: string; status: string; mrr_eur: number | null; license_count: number }
interface CalendarEventSummary { title: string; start: string; end: string }

interface DashboardContext {
  mrr?: number
  arr?: number
  activeSubscriptions?: number
  qontoBalance?: number
  tasks?: TaskSummary[]
  leads?: LeadSummary[]
  contracts?: ContractSummary[]
  todayEvents?: CalendarEventSummary[]
}

interface RequestBody {
  message: string
  history: ChatMessage[]
  context?: DashboardContext
}

// ── Tool definitions ────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'create_task',
    description: 'Crée une tâche dans le système de gestion des tâches MEMOVIA. Utilise cet outil quand l\'utilisateur demande d\'ajouter, créer ou noter une tâche.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titre de la tâche' },
        description: { type: 'string', description: 'Description optionnelle de la tâche' },
        priority: { type: 'string', enum: ['haute', 'normale', 'basse'], description: 'Priorité. Défaut: normale' },
        assigned_to: { type: 'string', enum: ['naoufel', 'emir'], description: 'Personne assignée à la tâche' },
        due_date: { type: 'string', description: 'Date d\'échéance au format YYYY-MM-DD (optionnel)' },
        status: { type: 'string', enum: ['todo', 'en_cours'], description: 'Statut initial. Défaut: todo' },
      },
      required: ['title', 'assigned_to'],
    },
  },
  {
    name: 'update_lead_status',
    description: 'Change le statut d\'un lead dans le CRM MEMOVIA. Utilise cet outil quand l\'utilisateur veut mettre à jour, faire avancer ou changer le statut d\'un lead.',
    input_schema: {
      type: 'object',
      properties: {
        lead_name: { type: 'string', description: 'Nom de l\'organisation ou du lead (recherche partielle acceptée)' },
        new_status: {
          type: 'string',
          enum: ['nouveau', 'contacte', 'en_discussion', 'proposition', 'gagne', 'perdu'],
          description: 'Nouveau statut du lead',
        },
      },
      required: ['lead_name', 'new_status'],
    },
  },
  {
    name: 'create_contract',
    description: 'Crée un nouveau contrat dans le système MEMOVIA. Utilise cet outil quand l\'utilisateur veut enregistrer, créer ou ajouter un contrat.',
    input_schema: {
      type: 'object',
      properties: {
        organization_name: { type: 'string', description: 'Nom de l\'organisation cliente' },
        contact_name: { type: 'string', description: 'Nom du contact principal (optionnel)' },
        mrr_eur: { type: 'number', description: 'Revenu mensuel récurrent en euros' },
        license_count: { type: 'number', description: 'Nombre de licences' },
        organization_type: { type: 'string', enum: ['ecole', 'cfa', 'entreprise', 'autre'], description: 'Type d\'organisation. Défaut: ecole' },
        status: { type: 'string', enum: ['prospect', 'negotiation', 'signe', 'actif'], description: 'Statut du contrat. Défaut: prospect' },
      },
      required: ['organization_name', 'mrr_eur', 'license_count'],
    },
  },
]

// ── System prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(context?: DashboardContext): string {
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const lines: string[] = [
    `Tu es le Copilote IA interne de MEMOVIA, une EdTech SaaS française (outils pédagogiques IA pour établissements scolaires).`,
    `Tu es l'assistant de confiance de l'équipe fondatrice : Naoufel et Emir.`,
    `Date du jour : ${today}.`,
    `Réponds toujours en français, de façon concise et directe.`,
    ``,
    `Tu peux exécuter des actions directement : créer une tâche, changer le statut d'un lead, créer un contrat.`,
    `Utilise les outils dès qu'une action est clairement demandée. Ne demande pas de confirmation sauf si les paramètres sont ambigus.`,
    ``,
  ]

  if (!context || Object.keys(context).length === 0) {
    lines.push('Données du dashboard : non disponibles.')
    return lines.join('\n')
  }

  // Stripe / Qonto
  if (context.mrr !== undefined || context.arr !== undefined || context.qontoBalance !== undefined) {
    lines.push('## FINANCES')
    if (context.mrr !== undefined) lines.push(`- MRR : ${context.mrr.toLocaleString('fr-FR')} €`)
    if (context.arr !== undefined) lines.push(`- ARR : ${context.arr.toLocaleString('fr-FR')} €`)
    if (context.activeSubscriptions !== undefined) lines.push(`- Abonnements actifs : ${context.activeSubscriptions}`)
    if (context.qontoBalance !== undefined) lines.push(`- Solde Qonto : ${context.qontoBalance.toLocaleString('fr-FR')} €`)
    lines.push('')
  }

  // Tasks
  if (context.tasks && context.tasks.length > 0) {
    lines.push('## TÂCHES EN COURS')
    for (const t of context.tasks) {
      const due = t.due_date ? ` — échéance ${t.due_date}` : ''
      lines.push(`- [${t.status}] ${t.title} — priorité ${t.priority} — ${t.assigned_to ?? 'non assigné'}${due} (id:${t.id})`)
    }
    lines.push('')
  } else {
    lines.push('## TÂCHES EN COURS\nAucune tâche active.\n')
  }

  // Leads
  if (context.leads && context.leads.length > 0) {
    lines.push('## LEADS ACTIFS (CRM)')
    for (const l of context.leads) {
      const action = l.next_action ? ` — next: ${l.next_action}` : ''
      lines.push(`- ${l.name} (${l.type}) — ${l.status} — ${l.assigned_to ?? 'non assigné'}${action} (id:${l.id})`)
    }
    lines.push('')
  } else {
    lines.push('## LEADS ACTIFS (CRM)\nAucun lead actif.\n')
  }

  // Contracts
  if (context.contracts && context.contracts.length > 0) {
    lines.push('## CONTRATS')
    for (const c of context.contracts) {
      const mrr = c.mrr_eur !== null ? `${c.mrr_eur.toLocaleString('fr-FR')} €/mois` : 'MRR inconnu'
      lines.push(`- ${c.organization_name} — ${c.status} — ${mrr} — ${c.license_count} licences (id:${c.id})`)
    }
    lines.push('')
  }

  // Calendar
  if (context.todayEvents && context.todayEvents.length > 0) {
    lines.push('## AGENDA DU JOUR')
    for (const e of context.todayEvents) {
      const start = new Date(e.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      lines.push(`- ${start} : ${e.title}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ── SSE helpers ────────────────────────────────────────────────────────────────

function sseText(text: string): string {
  return `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}\n\n`
}

function sseToolResult(type: string, payload: Record<string, unknown>): string {
  return `event: tool_result\ndata: ${JSON.stringify({ type, payload })}\n\n`
}

const SSE_DONE = 'data: [DONE]\n\n'

// ── Tool execution ─────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  token: string,
): Promise<{ sseEvent: string; toolResultContent: string }> {
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  if (name === 'create_task') {
    const { data, error } = await supabaseUser.from('tasks').insert({
      title: String(input.title),
      description: input.description ? String(input.description) : null,
      priority: (input.priority as string) ?? 'normale',
      assigned_to: String(input.assigned_to),
      due_date: input.due_date ? String(input.due_date) : null,
      status: (input.status as string) ?? 'todo',
      created_by: userId,
    }).select('id').single()

    if (error) throw new Error(`create_task failed: ${error.message}`)

    const payload = {
      id: data.id,
      title: String(input.title),
      assigned_to: String(input.assigned_to),
      priority: (input.priority as string) ?? 'normale',
      status: (input.status as string) ?? 'todo',
      due_date: input.due_date ? String(input.due_date) : null,
    }
    return {
      sseEvent: sseToolResult('create_task', payload),
      toolResultContent: `Tâche créée avec succès (id: ${data.id})`,
    }
  }

  if (name === 'update_lead_status') {
    const { data: leads, error: findError } = await supabaseUser
      .from('leads')
      .select('id, name, status, type')
      .ilike('name', `%${String(input.lead_name)}%`)
      .limit(1)

    if (findError || !leads?.[0]) {
      throw new Error(`Lead "${input.lead_name}" introuvable`)
    }

    const lead = leads[0] as { id: string; name: string; status: string; type: string }
    const { error: updateError } = await supabaseUser
      .from('leads')
      .update({ status: String(input.new_status) })
      .eq('id', lead.id)

    if (updateError) throw new Error(`update_lead_status failed: ${updateError.message}`)

    const payload = {
      id: lead.id,
      name: lead.name,
      old_status: lead.status,
      new_status: String(input.new_status),
      type: lead.type,
    }
    return {
      sseEvent: sseToolResult('update_lead_status', payload),
      toolResultContent: `Statut du lead "${lead.name}" mis à jour : ${lead.status} → ${input.new_status}`,
    }
  }

  if (name === 'create_contract') {
    const { data, error } = await supabaseUser.from('contracts').insert({
      organization_name: String(input.organization_name),
      contact_name: input.contact_name ? String(input.contact_name) : null,
      mrr_eur: Number(input.mrr_eur),
      license_count: Number(input.license_count),
      organization_type: (input.organization_type as string) ?? 'ecole',
      status: (input.status as string) ?? 'prospect',
      created_by: userId,
    }).select('id').single()

    if (error) throw new Error(`create_contract failed: ${error.message}`)

    const payload = {
      id: data.id,
      organization_name: String(input.organization_name),
      mrr_eur: Number(input.mrr_eur),
      license_count: Number(input.license_count),
      status: (input.status as string) ?? 'prospect',
    }
    return {
      sseEvent: sseToolResult('create_contract', payload),
      toolResultContent: `Contrat créé pour ${input.organization_name} (id: ${data.id})`,
    }
  }

  throw new Error(`Outil inconnu : ${name}`)
}

// ── Handler ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult
  const { user } = authResult as { user: { id: string } }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return errorResponse('anthropic_not_configured', 500)

  const token = req.headers.get('Authorization')!.replace('Bearer ', '')

  try {
    const body: RequestBody = await req.json()

    const rawMessage = typeof body.message === 'string' ? body.message.trim() : ''
    if (!rawMessage) return errorResponse('message_required', 400)

    const message = rawMessage.slice(0, 2000)
    const history = Array.isArray(body.history) ? body.history.slice(-20) : []
    const context = body.context

    const systemPrompt = buildSystemPrompt(context)
    const messages: ChatMessage[] = [...history, { role: 'user', content: message }]

    // ── Phase 1 : appel non-streaming avec tools ───────────────────────────────
    const phase1Resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        tools: TOOLS,
      }),
    })

    if (!phase1Resp.ok) {
      const errText = await phase1Resp.text()
      return errorResponse(`anthropic_error_${phase1Resp.status}: ${errText.slice(0, 200)}`, phase1Resp.status)
    }

    const phase1 = await phase1Resp.json() as {
      stop_reason: string
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>
    }

    // ── Cas 1 : pas de tool use → émettre le texte directement ────────────────
    const textBlocks = phase1.content.filter((b) => b.type === 'text')
    const toolUseBlock = phase1.content.find((b) => b.type === 'tool_use')

    if (phase1.stop_reason !== 'tool_use' || !toolUseBlock) {
      const text = textBlocks.map((b) => b.text ?? '').join('')
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(sseText(text)))
          controller.enqueue(encoder.encode(SSE_DONE))
          controller.close()
        },
      })
      return new Response(stream, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
      })
    }

    // ── Cas 2 : tool use → exécuter l'outil, émettre carte, streaming phase 2 ─
    const { name: toolName, id: toolId, input: toolInput } = toolUseBlock as {
      name: string; id: string; input: Record<string, unknown>
    }

    // Construire la réponse SSE en streaming
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Exécuter l'outil
          const { sseEvent: toolCardSSE, toolResultContent } = await executeTool(
            toolName,
            toolInput,
            user.id,
            token,
          )

          // Émettre la carte outil
          controller.enqueue(encoder.encode(toolCardSSE))

          // Phase 2 : streaming avec tool result
          const messagesWithTool: ChatMessage[] = [
            ...messages,
            { role: 'assistant', content: phase1.content as AnthropicContentBlock[] },
            {
              role: 'user',
              content: [{ type: 'tool_result', tool_use_id: toolId, content: toolResultContent }] as AnthropicContentBlock[],
            },
          ]

          const phase2Resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 512,
              system: systemPrompt,
              messages: messagesWithTool,
              stream: true,
            }),
          })

          if (!phase2Resp.ok || !phase2Resp.body) {
            controller.enqueue(encoder.encode(sseText('Action effectuée.')))
            controller.enqueue(encoder.encode(SSE_DONE))
            controller.close()
            return
          }

          // Piper le stream phase 2
          const reader = phase2Resp.body.getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            controller.enqueue(value)
          }
          controller.close()
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erreur lors de l\'exécution de l\'action.'
          controller.enqueue(encoder.encode(sseText(msg)))
          controller.enqueue(encoder.encode(SSE_DONE))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return errorResponse(message, 502)
  }
})
```

- [ ] **Step 2.2 : Vérifier la syntaxe TypeScript Deno**

```bash
cd /Users/naoufelbassou/memovia-dashboard
deno check supabase/functions/copilot-chat/index.ts 2>&1 | head -30
```

Attendu : pas d'erreur de compilation.

Si `deno` n'est pas installé, vérifier à la main que toutes les accolades sont fermées :
```bash
grep -c '{' supabase/functions/copilot-chat/index.ts && grep -c '}' supabase/functions/copilot-chat/index.ts
```
Les deux counts doivent être identiques.

- [ ] **Step 2.3 : Commit**

```bash
cd /Users/naoufelbassou/memovia-dashboard
git add supabase/functions/copilot-chat/index.ts
git commit -m "feat(copilot): tool use Anthropic natif + exécution DB dans copilot-chat"
```

---

## Task 3 : Créer les composants de cartes d'action

**Files:**
- Create: `src/components/copilot/TaskCard.tsx`
- Create: `src/components/copilot/LeadCard.tsx`
- Create: `src/components/copilot/ContractCard.tsx`

- [ ] **Step 3.1 : Créer `TaskCard.tsx`**

```typescript
// src/components/copilot/TaskCard.tsx
import { CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskCardData } from '@/hooks/useCopilot'

const PRIORITY_STYLES: Record<string, string> = {
  haute: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
  normale: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800',
  basse: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
}

const STATUS_STYLES: Record<string, string> = {
  todo: 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border-color)]',
  en_cours: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
}

const STATUS_LABELS: Record<string, string> = { todo: 'À faire', en_cours: 'En cours' }
const PRIORITY_LABELS: Record<string, string> = { haute: 'Haute', normale: 'Normale', basse: 'Basse' }

const ASSIGNEE_INITIALS: Record<string, string> = { naoufel: 'N', emir: 'E' }
const ASSIGNEE_COLORS: Record<string, string> = {
  naoufel: 'bg-[var(--memovia-violet)] text-white',
  emir: 'bg-emerald-600 text-white',
}

export function TaskCard({ data }: { data: TaskCardData }) {
  return (
    <div className="my-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-[var(--memovia-violet)]" strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{data.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', STATUS_STYLES[data.status] ?? STATUS_STYLES.todo)}>
              {STATUS_LABELS[data.status] ?? data.status}
            </span>
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', PRIORITY_STYLES[data.priority] ?? '')}>
              {PRIORITY_LABELS[data.priority] ?? data.priority}
            </span>
            <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold', ASSIGNEE_COLORS[data.assigned_to] ?? 'bg-[var(--bg-secondary)] text-[var(--text-muted)]')}>
              {ASSIGNEE_INITIALS[data.assigned_to] ?? data.assigned_to[0]?.toUpperCase()}
            </span>
            {data.due_date && (
              <span className="text-[10px] text-[var(--text-muted)]">
                {new Date(data.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3.2 : Créer `LeadCard.tsx`**

```typescript
// src/components/copilot/LeadCard.tsx
import { ArrowRight, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeadCardData } from '@/hooks/useCopilot'

const STATUS_STYLES: Record<string, string> = {
  nouveau: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  contacte: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  en_discussion: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
  proposition: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  gagne: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  perdu: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
}

const STATUS_LABELS: Record<string, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  en_discussion: 'En discussion',
  proposition: 'Proposition',
  gagne: 'Gagné',
  perdu: 'Perdu',
}

const TYPE_LABELS: Record<string, string> = { ecole: 'École', cfa: 'CFA', entreprise: 'Entreprise', autre: 'Autre' }

export function LeadCard({ data }: { data: LeadCardData }) {
  return (
    <div className="my-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-[var(--memovia-violet)]" strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{data.name}</p>
            <span className="shrink-0 rounded-full bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
              {TYPE_LABELS[data.type] ?? data.type}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_STYLES[data.old_status] ?? 'bg-[var(--bg-secondary)] text-[var(--text-muted)]')}>
              {STATUS_LABELS[data.old_status] ?? data.old_status}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_STYLES[data.new_status] ?? 'bg-[var(--bg-secondary)] text-[var(--text-muted)]')}>
              {STATUS_LABELS[data.new_status] ?? data.new_status}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3.3 : Créer `ContractCard.tsx`**

```typescript
// src/components/copilot/ContractCard.tsx
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContractCardData } from '@/hooks/useCopilot'

const STATUS_STYLES: Record<string, string> = {
  prospect: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  negotiation: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  signe: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  actif: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
}

const STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  negotiation: 'Négociation',
  signe: 'Signé',
  actif: 'Actif',
}

export function ContractCard({ data }: { data: ContractCardData }) {
  return (
    <div className="my-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--memovia-violet)]" strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{data.organization_name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_STYLES[data.status] ?? 'bg-[var(--bg-secondary)] text-[var(--text-muted)]')}>
              {STATUS_LABELS[data.status] ?? data.status}
            </span>
            {data.mrr_eur !== null && (
              <span className="text-[10px] font-medium text-[var(--text-primary)]">
                {data.mrr_eur.toLocaleString('fr-FR')} €/mois
              </span>
            )}
            <span className="text-[10px] text-[var(--text-muted)]">
              {data.license_count} licence{data.license_count > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3.4 : Vérifier la compilation TypeScript des 3 composants**

```bash
cd /Users/naoufelbassou/memovia-dashboard
npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreur sur les 3 nouveaux fichiers.

- [ ] **Step 3.5 : Commit**

```bash
cd /Users/naoufelbassou/memovia-dashboard
git add src/components/copilot/TaskCard.tsx src/components/copilot/LeadCard.tsx src/components/copilot/ContractCard.tsx
git commit -m "feat(copilot): composants de cartes TaskCard, LeadCard, ContractCard"
```

---

## Task 4 : Mettre à jour `CopilotBubble.tsx`

**Files:**
- Modify: `src/components/copilot/CopilotBubble.tsx`

- [ ] **Step 4.1 : Mettre à jour les imports**

Remplacer la ligne d'import `useCopilot` et ajouter les imports des cartes :

```typescript
import { useCopilot, type CopilotMessage, type ChatMessage } from '@/hooks/useCopilot'
import { TaskCard } from './TaskCard'
import { LeadCard } from './LeadCard'
import { ContractCard } from './ContractCard'
```

- [ ] **Step 4.2 : Ajouter les chips d'action**

Remplacer :
```typescript
const quickChips = [
  'Quel est notre MRR ?',
  'Solde Qonto actuel ?',
  'Tâches en cours ?',
  'Leads actifs ?',
]
```

Par :
```typescript
const quickChips = [
  'Quel est notre MRR ?',
  'Solde Qonto actuel ?',
  'Tâches en cours ?',
  'Quels leads sont en attente ?',
  'Ajoute une tâche assignée à Emir',
  'Contrats actifs ?',
]
```

- [ ] **Step 4.3 : Ajouter le helper de rendu de carte**

Ajouter la fonction suivante juste avant `export function CopilotBubble()` :

```typescript
function renderToolCard(msg: CopilotMessage) {
  if (!('type' in msg) || msg.type !== 'tool_result') return null
  const { tool } = msg
  if (tool.kind === 'task') return <TaskCard data={tool.data} />
  if (tool.kind === 'lead') return <LeadCard data={tool.data} />
  if (tool.kind === 'contract') return <ContractCard data={tool.data} />
  return null
}
```

- [ ] **Step 4.4 : Mettre à jour le rendu des messages**

Dans la section `{messages.map((message) => (`, remplacer tout le bloc `<div key={message.id} ...>...</div>` par :

```typescript
              {messages.map((message) => {
                // Carte d'action outil
                if ('type' in message && message.type === 'tool_result') {
                  return (
                    <div key={message.id} className="pl-9">
                      {renderToolCard(message)}
                    </div>
                  )
                }

                const chatMsg = message as ChatMessage
                return (
                  <div
                    key={chatMsg.id}
                    className={cn(
                      'flex items-start gap-2.5',
                      chatMsg.role === 'user' && 'flex-row-reverse',
                    )}
                  >
                    {chatMsg.role === 'assistant' && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--memovia-violet-light)]">
                        <Sparkles
                          className="h-3.5 w-3.5 text-[var(--memovia-violet)]"
                          strokeWidth={2.25}
                        />
                      </div>
                    )}

                    <div
                      className={cn(
                        'max-w-[80%] px-3 py-2 text-[13px] leading-relaxed',
                        chatMsg.role === 'user'
                          ? 'rounded-2xl rounded-tr-md bg-[var(--memovia-violet)] text-white'
                          : 'rounded-2xl rounded-tl-md bg-[var(--bg-primary)] text-[var(--text-primary)]',
                      )}
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {chatMsg.role === 'assistant'
                        ? renderInlineMarkdown(chatMsg.content)
                        : chatMsg.content}
                      {chatMsg.streaming && (
                        <span className="ml-1 inline-flex gap-0.5">
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60 animate-bounce"
                              style={{ animationDelay: `${i * 150}ms` }}
                            />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
```

Note: remplacer aussi le `.map((message) => (` initial par `.map((message) => {` (parenthèse → accolade).

- [ ] **Step 4.5 : Vérifier la compilation TypeScript**

```bash
cd /Users/naoufelbassou/memovia-dashboard
npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreur TypeScript.

- [ ] **Step 4.6 : Commit**

```bash
cd /Users/naoufelbassou/memovia-dashboard
git add src/components/copilot/CopilotBubble.tsx
git commit -m "feat(copilot): rendu cartes tool_result + chips d'action dans CopilotBubble"
```

---

## Task 5 : Déployer l'Edge Function et pousser

- [ ] **Step 5.1 : Déployer la Edge Function**

```bash
cd /Users/naoufelbassou/memovia-dashboard
npx supabase functions deploy copilot-chat --project-ref mzjzwffpqubpruyaaxew
```

Attendu : `Deployed Function copilot-chat`

- [ ] **Step 5.2 : Vérifier le build frontend**

```bash
cd /Users/naoufelbassou/memovia-dashboard
npm run build 2>&1 | tail -20
```

Attendu : `✓ built in` sans erreur.

- [ ] **Step 5.3 : Push**

```bash
cd /Users/naoufelbassou/memovia-dashboard
git push origin main
```

---

## Self-Review Checklist

- [x] **Spec coverage** : contexte enrichi (tasks/leads/contracts/calendar/stripe/qonto) ✓ — tool use 3 outils ✓ — cartes structurées ✓ — SSE étendu ✓
- [x] **No placeholders** : tout le code est complet avec vraies valeurs
- [x] **Type consistency** :
  - `TaskCardData` défini dans useCopilot.ts, importé dans TaskCard.tsx et CopilotBubble.tsx ✓
  - `LeadCardData` idem ✓
  - `ContractCardData` idem ✓
  - `ToolResultMessage` utilisé dans useCopilot.ts parser et CopilotBubble.tsx ✓
  - `parseToolResultCard()` retourne `ToolResultCard | null` utilisé dans le parser SSE ✓
  - `executeTool()` dans Edge Function retourne `{ sseEvent, toolResultContent }` ✓
