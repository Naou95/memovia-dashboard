// Serveur MCP (Model Context Protocol) over HTTP pour MEMOVIA.
// Protocole JSON-RPC 2.0 — https://modelcontextprotocol.io/specification
//
// Auth : en-tête `x-memovia-mcp-secret` (ou `Authorization: Bearer <secret>`)
// comparé à MEMOVIA_MCP_SECRET. `verify_jwt = false` dans config.toml.
//
// Lectures DB via SUPABASE_SERVICE_ROLE_KEY (bypasse RLS — outil interne).

import Stripe from 'npm:stripe@17'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// ── CORS ───────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-memovia-mcp-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── JSON-RPC 2.0 helpers ───────────────────────────────────────────────────────

type JsonRpcId = string | number | null

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: JsonRpcId
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcError {
  code: number
  message: string
  data?: unknown
}

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: '2.0', id, result }
}

function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  const error: JsonRpcError = { code, message }
  if (data !== undefined) error.data = data
  return { jsonrpc: '2.0', id, error }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ── Supabase client (service role) ─────────────────────────────────────────────

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

// ── Lead scoring (aligné sur src/lib/leadScoring.ts) ───────────────────────────

type LeadMaturity = 'froid' | 'tiede' | 'chaud'
type LeadStatus = 'nouveau' | 'contacte' | 'en_discussion' | 'proposition' | 'gagne' | 'perdu'

const MATURITY_POINTS: Record<LeadMaturity, number> = { froid: 10, tiede: 40, chaud: 70 }
const STATUS_POINTS: Record<LeadStatus, number> = {
  nouveau: 0, contacte: 5, en_discussion: 15, proposition: 20, gagne: 30, perdu: -50,
}

function relancePoints(count: number): number {
  if (count <= 0) return 0
  if (count === 1) return 5
  if (count === 2) return 10
  return 5
}

function daysSince(dateStr: string, now: Date): number {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY
  const dayMs = 24 * 60 * 60 * 1000
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.floor((b - a) / dayMs)
}

function lastContactPoints(dateStr: string | null, now: Date): number {
  if (!dateStr) return -15
  const days = daysSince(dateStr, now)
  if (days <= 0) return 10
  if (days < 7) return 5
  if (days < 30) return 0
  return -10
}

function computeLeadScore(lead: {
  maturity: LeadMaturity | null
  status: LeadStatus
  relance_count: number | null
  last_contact_date: string | null
}): number {
  const now = new Date()
  const m = lead.maturity ? MATURITY_POINTS[lead.maturity] : 0
  const s = STATUS_POINTS[lead.status] ?? 0
  const r = relancePoints(lead.relance_count ?? 0)
  const lc = lastContactPoints(lead.last_contact_date, now)
  return Math.max(0, Math.min(100, m + s + r + lc))
}

// ── Définition des outils MCP ──────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_overview',
    description:
      "Récupère les métriques business clés de MEMOVIA : MRR (Stripe + contrats B2B), ARR, solde Qonto, abonnés actifs Stripe, annulations en cours.",
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'get_leads',
    description:
      "Liste les leads du CRM MEMOVIA avec leur statut, maturité, score calculé 0-100 et prochaine action. Optionnellement filtré par statut.",
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['nouveau', 'contacte', 'en_discussion', 'proposition', 'gagne', 'perdu'],
          description: 'Filtre par statut (optionnel).',
        },
        limit: {
          type: 'number',
          description: 'Nombre maximum de leads à retourner (défaut 50, max 200).',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_tasks',
    description:
      "Liste les tâches du kanban MEMOVIA avec statut, priorité, assigné et détection de retard (due_date dépassée).",
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['todo', 'en_cours', 'done'],
          description: 'Filtre par statut (optionnel).',
        },
        assigned_to: {
          type: 'string',
          enum: ['naoufel', 'emir'],
          description: 'Filtre par assigné (optionnel).',
        },
        limit: {
          type: 'number',
          description: 'Nombre maximum de tâches à retourner (défaut 50, max 200).',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_contracts',
    description:
      "Liste les contrats B2B MEMOVIA avec statut, licences, MRR et date de renouvellement.",
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['prospect', 'negotiation', 'signe', 'actif', 'resilie'],
          description: 'Filtre par statut (optionnel).',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'create_task',
    description: "Crée une tâche dans le kanban MEMOVIA.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titre de la tâche.' },
        description: { type: 'string', description: 'Description optionnelle.' },
        priority: {
          type: 'string',
          enum: ['haute', 'normale', 'basse'],
          description: 'Priorité (défaut : normale).',
        },
        assigned_to: {
          type: 'string',
          enum: ['naoufel', 'emir'],
          description: 'Personne assignée (optionnel).',
        },
        due_date: {
          type: 'string',
          description: "Date d'échéance au format YYYY-MM-DD (optionnel).",
        },
        status: {
          type: 'string',
          enum: ['todo', 'en_cours'],
          description: 'Statut initial (défaut : todo).',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_lead',
    description: "Crée un lead dans le CRM MEMOVIA.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "Nom du lead ou de l'organisation." },
        type: {
          type: 'string',
          enum: ['ecole', 'cfa', 'entreprise', 'autre'],
          description: "Type d'organisation (défaut : autre).",
        },
        canal: {
          type: 'string',
          enum: ['linkedin', 'email', 'referral', 'appel', 'autre'],
          description: "Canal d'acquisition (défaut : autre).",
        },
        status: {
          type: 'string',
          enum: ['nouveau', 'contacte', 'en_discussion', 'proposition', 'gagne', 'perdu'],
          description: 'Statut initial (défaut : nouveau).',
        },
        assigned_to: {
          type: 'string',
          enum: ['naoufel', 'emir'],
          description: 'Personne assignée (optionnel).',
        },
        notes: { type: 'string', description: 'Notes libres (optionnel).' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_lead_status',
    description:
      "Met à jour le statut et/ou la maturité d'un lead. Recherche par id (prioritaire) ou par nom (ilike).",
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: 'ID exact du lead (prioritaire).' },
        lead_name: { type: 'string', description: 'Nom du lead (recherche partielle).' },
        new_status: {
          type: 'string',
          enum: ['nouveau', 'contacte', 'en_discussion', 'proposition', 'gagne', 'perdu'],
          description: 'Nouveau statut (optionnel si maturity fournie).',
        },
        new_maturity: {
          type: 'string',
          enum: ['froid', 'tiede', 'chaud'],
          description: 'Nouvelle maturité (optionnel si new_status fourni).',
        },
      },
      additionalProperties: false,
    },
  },
]

// ── Implémentation des outils ──────────────────────────────────────────────────

function textContent(payload: unknown) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
  return { content: [{ type: 'text', text }] }
}

function errorContent(message: string) {
  return { content: [{ type: 'text', text: message }], isError: true }
}

async function getStripeMetrics(): Promise<{
  mrr_stripe: number
  active_subscribers: number
  canceling_at_period_end: number
}> {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!secretKey) return { mrr_stripe: 0, active_subscribers: 0, canceling_at_period_end: 0 }

  const stripe = new Stripe(secretKey)
  const subs = await stripe.subscriptions.list({ status: 'active', limit: 100 }, { timeout: 8000 })

  const mrr = subs.data.reduce((sum, sub) => {
    const plan = sub.items.data[0]?.plan
    if (!plan?.amount) return sum
    const monthly = plan.interval === 'year' ? plan.amount / 12 : plan.amount
    return sum + monthly / 100
  }, 0)

  const paid = subs.data.filter((s) => (s.items.data[0]?.plan?.amount ?? 0) > 0)
  const active_subscribers = paid.filter((s) => !s.cancel_at_period_end).length
  const canceling_at_period_end = paid.filter((s) => s.cancel_at_period_end).length

  return {
    mrr_stripe: Math.round(mrr * 100) / 100,
    active_subscribers,
    canceling_at_period_end,
  }
}

async function getQontoBalance(): Promise<number> {
  const apiKey = Deno.env.get('QONTO_API_KEY')
  const orgSlug = Deno.env.get('QONTO_ORGANIZATION_SLUG')
  if (!apiKey || !orgSlug) return 0

  const res = await fetch('https://thirdparty.qonto.com/v2/bank_accounts', {
    signal: AbortSignal.timeout(8000),
    headers: {
      'Authorization': `${orgSlug}:${apiKey}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) return 0
  const { bank_accounts } = await res.json() as {
    bank_accounts: Array<{ balance_cents: number }>
  }
  const totalCents = (bank_accounts ?? []).reduce((s, a) => s + (a.balance_cents ?? 0), 0)
  return Math.round(totalCents) / 100
}

async function toolGetOverview() {
  const supabase = getSupabase()

  const [stripe, qonto, contractsRes] = await Promise.all([
    getStripeMetrics().catch(() => ({ mrr_stripe: 0, active_subscribers: 0, canceling_at_period_end: 0 })),
    getQontoBalance().catch(() => 0),
    supabase.from('contracts').select('mrr_eur').eq('status', 'actif'),
  ])

  const mrr_contracts = Math.round(
    ((contractsRes.data ?? []).reduce(
      (s: number, r: { mrr_eur: number | null }) => s + (r.mrr_eur ?? 0),
      0,
    )) * 100,
  ) / 100

  const mrr_total = Math.round((stripe.mrr_stripe + mrr_contracts) * 100) / 100
  const arr = Math.round(mrr_total * 12 * 100) / 100

  return textContent({
    mrr_total,
    mrr_stripe: stripe.mrr_stripe,
    mrr_contracts,
    arr,
    active_subscribers: stripe.active_subscribers,
    canceling_at_period_end: stripe.canceling_at_period_end,
    qonto_balance: qonto,
    currency: 'EUR',
    fetched_at: new Date().toISOString(),
  })
}

async function toolGetLeads(input: Record<string, unknown>) {
  const supabase = getSupabase()
  const limit = Math.min(Math.max(Number(input.limit ?? 50) || 50, 1), 200)

  let query = supabase
    .from('leads')
    .select('id, name, type, canal, status, maturity, relance_count, last_contact_date, next_action, follow_up_date, assigned_to, notes, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (typeof input.status === 'string') {
    query = query.eq('status', input.status)
  }

  const { data, error } = await query
  if (error) return errorContent(`Erreur leads : ${error.message}`)

  const leads = (data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    type: l.type,
    canal: l.canal,
    status: l.status,
    maturity: l.maturity,
    score: computeLeadScore({
      maturity: l.maturity,
      status: l.status,
      relance_count: l.relance_count,
      last_contact_date: l.last_contact_date,
    }),
    relance_count: l.relance_count ?? 0,
    last_contact_date: l.last_contact_date,
    next_action: l.next_action,
    follow_up_date: l.follow_up_date,
    assigned_to: l.assigned_to,
  }))

  return textContent({ count: leads.length, leads })
}

async function toolGetTasks(input: Record<string, unknown>) {
  const supabase = getSupabase()
  const limit = Math.min(Math.max(Number(input.limit ?? 50) || 50, 1), 200)

  let query = supabase
    .from('tasks')
    .select('id, title, description, status, priority, due_date, assigned_to, assignees, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (typeof input.status === 'string') query = query.eq('status', input.status)
  if (typeof input.assigned_to === 'string') query = query.eq('assigned_to', input.assigned_to)

  const { data, error } = await query
  if (error) return errorContent(`Erreur tâches : ${error.message}`)

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const tasks = (data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    assigned_to: t.assigned_to,
    assignees: t.assignees ?? [],
    is_overdue: t.due_date !== null && t.status !== 'done' && String(t.due_date) < todayStr,
  }))

  return textContent({ count: tasks.length, tasks })
}

async function toolGetContracts(input: Record<string, unknown>) {
  const supabase = getSupabase()
  let query = supabase
    .from('contracts')
    .select('id, organization_name, organization_type, status, license_count, contact_name, mrr_eur, renewal_date, notes, created_at')
    .order('created_at', { ascending: false })

  if (typeof input.status === 'string') query = query.eq('status', input.status)

  const { data, error } = await query
  if (error) return errorContent(`Erreur contrats : ${error.message}`)

  const total_mrr = Math.round(
    ((data ?? []).reduce((s: number, c: { mrr_eur: number | null; status: string }) =>
      c.status === 'actif' ? s + (c.mrr_eur ?? 0) : s, 0)) * 100,
  ) / 100

  return textContent({
    count: data?.length ?? 0,
    total_mrr_actif: total_mrr,
    contracts: data ?? [],
  })
}

async function toolCreateTask(input: Record<string, unknown>) {
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!title) return errorContent('title requis.')

  const supabase = getSupabase()
  const { data, error } = await supabase.from('tasks').insert({
    title,
    description: typeof input.description === 'string' ? input.description : null,
    priority: (input.priority as string) ?? 'normale',
    assigned_to: (input.assigned_to as string) ?? null,
    due_date: typeof input.due_date === 'string' ? input.due_date : null,
    status: (input.status as string) ?? 'todo',
  }).select('id, title, status, priority, assigned_to, due_date').single()

  if (error) return errorContent(`Impossible de créer la tâche : ${error.message}`)
  return textContent({ ok: true, task: data })
}

async function toolCreateLead(input: Record<string, unknown>) {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name) return errorContent('name requis.')

  const supabase = getSupabase()
  const { data, error } = await supabase.from('leads').insert({
    name,
    type: (input.type as string) ?? 'autre',
    canal: (input.canal as string) ?? 'autre',
    status: (input.status as string) ?? 'nouveau',
    assigned_to: (input.assigned_to as string) ?? null,
    notes: typeof input.notes === 'string' ? input.notes : null,
  }).select('id, name, type, canal, status, assigned_to').single()

  if (error) return errorContent(`Impossible de créer le lead : ${error.message}`)
  return textContent({ ok: true, lead: data })
}

async function toolUpdateLeadStatus(input: Record<string, unknown>) {
  const supabase = getSupabase()
  const leadId = typeof input.lead_id === 'string' ? input.lead_id : null
  const leadName = typeof input.lead_name === 'string' ? input.lead_name : null
  const newStatus = typeof input.new_status === 'string' ? input.new_status : null
  const newMaturity = typeof input.new_maturity === 'string' ? input.new_maturity : null

  if (!newStatus && !newMaturity) {
    return errorContent('new_status ou new_maturity requis.')
  }
  if (!leadId && !leadName) {
    return errorContent('lead_id ou lead_name requis.')
  }

  const finder = supabase.from('leads').select('id, name, status, maturity')
  const { data: found, error: findErr } = leadId
    ? await finder.eq('id', leadId).limit(1)
    : await finder.ilike('name', `%${leadName}%`).limit(1)

  if (findErr) return errorContent(`Erreur recherche : ${findErr.message}`)
  if (!found?.[0]) return errorContent(`Lead introuvable.`)

  const lead = found[0] as { id: string; name: string; status: string; maturity: string | null }

  const patch: Record<string, string> = {}
  if (newStatus) patch.status = newStatus
  if (newMaturity) patch.maturity = newMaturity

  const { error: updateErr } = await supabase.from('leads').update(patch).eq('id', lead.id)
  if (updateErr) return errorContent(`Impossible de mettre à jour : ${updateErr.message}`)

  return textContent({
    ok: true,
    id: lead.id,
    name: lead.name,
    old_status: lead.status,
    new_status: newStatus ?? lead.status,
    old_maturity: lead.maturity,
    new_maturity: newMaturity ?? lead.maturity,
  })
}

// ── Dispatcher ─────────────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'get_overview': return await toolGetOverview()
    case 'get_leads': return await toolGetLeads(args)
    case 'get_tasks': return await toolGetTasks(args)
    case 'get_contracts': return await toolGetContracts(args)
    case 'create_task': return await toolCreateTask(args)
    case 'create_lead': return await toolCreateLead(args)
    case 'update_lead_status': return await toolUpdateLeadStatus(args)
    default: throw new Error(`Outil inconnu : ${name}`)
  }
}

// ── Auth par secret partagé ────────────────────────────────────────────────────

function checkSecret(req: Request): boolean {
  const expected = Deno.env.get('MEMOVIA_MCP_SECRET')
  if (!expected) {
    console.error('[memovia-mcp] MEMOVIA_MCP_SECRET non configuré')
    return false
  }
  const fromHeader = req.headers.get('x-memovia-mcp-secret')
  const authHeader = req.headers.get('authorization') ?? ''
  const fromAuth = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7)
    : null
  const provided = fromHeader ?? fromAuth
  if (!provided || provided.length !== expected.length) return false
  const a = new TextEncoder().encode(provided)
  const b = new TextEncoder().encode(expected)
  return crypto.subtle.timingSafeEqual(a, b)
}

// ── Handler MCP ────────────────────────────────────────────────────────────────

async function handleRpc(rpc: JsonRpcRequest): Promise<Response | null> {
  const id = rpc.id ?? null

  if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
    return jsonResponse(rpcError(id, -32600, 'Invalid Request'), 400)
  }

  // Notifications : pas de id → pas de réponse.
  const isNotification = rpc.id === undefined

  try {
    switch (rpc.method) {
      case 'initialize': {
        const result = {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'memovia-mcp', version: '1.0.0' },
        }
        return jsonResponse(rpcResult(id, result))
      }

      case 'notifications/initialized':
      case 'notifications/cancelled': {
        return new Response(null, { status: 204, headers: corsHeaders })
      }

      case 'ping': {
        return jsonResponse(rpcResult(id, {}))
      }

      case 'tools/list': {
        return jsonResponse(rpcResult(id, { tools: TOOLS }))
      }

      case 'tools/call': {
        const params = rpc.params ?? {}
        const name = typeof params.name === 'string' ? params.name : ''
        const args = (params.arguments && typeof params.arguments === 'object')
          ? params.arguments as Record<string, unknown>
          : {}

        if (!name) {
          return jsonResponse(rpcError(id, -32602, 'params.name requis'))
        }
        if (!TOOLS.some((t) => t.name === name)) {
          return jsonResponse(rpcError(id, -32601, `Outil introuvable : ${name}`))
        }

        try {
          const result = await callTool(name, args)
          return jsonResponse(rpcResult(id, result))
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[memovia-mcp] tool ${name} failed:`, msg)
          return jsonResponse(rpcResult(id, {
            content: [{ type: 'text', text: `Erreur outil ${name} : ${msg}` }],
            isError: true,
          }))
        }
      }

      default: {
        if (isNotification) {
          return new Response(null, { status: 204, headers: corsHeaders })
        }
        return jsonResponse(rpcError(id, -32601, `Méthode inconnue : ${rpc.method}`))
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[memovia-mcp] internal error:', msg)
    return jsonResponse(rpcError(id, -32603, `Internal error : ${msg}`), 500)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return jsonResponse({
      name: 'memovia-mcp',
      version: '1.0.0',
      protocol: 'mcp/jsonrpc-2.0',
      transport: 'http',
      tools: TOOLS.map((t) => t.name),
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse(rpcError(null, -32600, 'Méthode HTTP non supportée'), 405)
  }

  if (!checkSecret(req)) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse(rpcError(null, -32700, 'Parse error'), 400)
  }

  // Batch requests.
  if (Array.isArray(body)) {
    if (body.length === 0) {
      return jsonResponse(rpcError(null, -32600, 'Batch vide'), 400)
    }
    const responses: unknown[] = []
    for (const item of body) {
      const resp = await handleRpc(item as JsonRpcRequest)
      if (resp && resp.status !== 204) {
        try {
          responses.push(await resp.json())
        } catch {
          // pas de JSON → on ignore.
        }
      }
    }
    if (responses.length === 0) {
      return new Response(null, { status: 204, headers: corsHeaders })
    }
    return jsonResponse(responses)
  }

  const resp = await handleRpc(body as JsonRpcRequest)
  return resp ?? new Response(null, { status: 204, headers: corsHeaders })
})
