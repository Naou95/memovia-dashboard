import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, validateAuth } from '../_shared/auth.ts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DailyCost {
  date: string
  openai: number
  gemini: number
  gladia: number
}

type CostSource = 'db' | 'api' | 'unavailable'

interface ProviderSummary {
  id: 'openai' | 'gemini' | 'gladia'
  label: string
  monthTotal: number
  currency: 'USD'
  available: boolean
  source: CostSource
  /** Nombre d'appels/transcriptions ce mois (optionnel) */
  callCount?: number
}

interface ApiCostsResponse {
  providers: ProviderSummary[]
  dailyCosts: DailyCost[]
  totalMonth: number
  fetchedAt: string
  period: { start: string; end: string }
}

// ── Constants ─────────────────────────────────────────────────────────────────

// api_costs.cost_usd_microcents stores micro-dollars (10^-6 USD)
const MICROCENTS_TO_USD = 1 / 1_000_000

// Gladia pricing: $0.0002/minute → per second
const GLADIA_PRICE_PER_SECOND = 0.0002 / 60

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfMonth(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function buildDailyMap(): Map<string, DailyCost> {
  const map = new Map<string, DailyCost>()
  const start = startOfMonth()
  const now = new Date()
  for (const d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    const key = toDateStr(new Date(d))
    map.set(key, { date: key, openai: 0, gemini: 0, gladia: 0 })
  }
  return map
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

// ── DB costs (OpenAI + Gemini from api_costs table) ───────────────────────────

interface DbRow {
  provider: string
  created_at: string
  cost_usd_microcents: number
}

async function fetchDbCosts(startISO: string): Promise<{
  openai: { daily: Map<string, number>; total: number; count: number }
  gemini: { daily: Map<string, number>; total: number; count: number }
}> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await supabase
    .from('api_costs')
    .select('provider, created_at, cost_usd_microcents')
    .gte('created_at', startISO)
    .in('provider', ['openai', 'gemini'])

  if (error || !data) {
    return {
      openai: { daily: new Map(), total: 0, count: 0 },
      gemini: { daily: new Map(), total: 0, count: 0 },
    }
  }

  const openaiDaily = new Map<string, number>()
  const geminiDaily = new Map<string, number>()
  let openaiTotal = 0
  let geminiTotal = 0
  let openaiCount = 0
  let geminiCount = 0

  for (const row of data as DbRow[]) {
    const date = (row.created_at ?? '').split('T')[0]
    const cost = Number(row.cost_usd_microcents) * MICROCENTS_TO_USD

    if (row.provider === 'openai') {
      openaiDaily.set(date, (openaiDaily.get(date) ?? 0) + cost)
      openaiTotal += cost
      openaiCount++
    } else if (row.provider === 'gemini') {
      geminiDaily.set(date, (geminiDaily.get(date) ?? 0) + cost)
      geminiTotal += cost
      geminiCount++
    }
  }

  return {
    openai: { daily: openaiDaily, total: openaiTotal, count: openaiCount },
    gemini: { daily: geminiDaily, total: geminiTotal, count: geminiCount },
  }
}

// ── Gladia API ────────────────────────────────────────────────────────────────
// /v2/billing/usage n'existe pas. On utilise GET /v2/pre-recorded avec after_date.
// Chaque job expose billing_time (secondes). Coût = billing_time × $0.0002/60.

interface GladiaJob {
  id: string
  created_at: string
  billing_time?: number
  audio_duration?: number
  status?: string
}

async function fetchGladiaCosts(
  apiKey: string,
): Promise<{ daily: Map<string, number>; total: number; count: number }> {
  const afterDate = toDateStr(startOfMonth())
  const headers = { 'x-gladia-key': apiKey }

  const daily = new Map<string, number>()
  let total = 0
  let count = 0
  let offset = 0
  const limit = 100

  // Paginate through all jobs for this month
  while (true) {
    const url = `https://api.gladia.io/v2/pre-recorded?after_date=${afterDate}&limit=${limit}&offset=${offset}`
    const res = await fetch(url, { headers }).catch(() => null)

    if (!res?.ok) break

    const json = await res.json() as Record<string, unknown>
    const results = json.results as GladiaJob[] | undefined
    if (!results?.length) break

    for (const job of results) {
      if (job.status !== 'done' && job.status !== 'processed') continue
      const seconds = Number(job.billing_time ?? job.audio_duration ?? 0)
      const cost = seconds * GLADIA_PRICE_PER_SECOND
      const date = (job.created_at ?? '').split('T')[0]
      daily.set(date, (daily.get(date) ?? 0) + cost)
      total += cost
      count++
    }

    // Stop if we got fewer results than the page size
    if (results.length < limit) break
    offset += limit
  }

  return { daily, total, count }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  const gladiaKey = Deno.env.get('GLADIA_API_KEY') ?? ''
  const monthStart = startOfMonth()
  const startISO = monthStart.toISOString()
  const dailyMap = buildDailyMap()
  const providers: ProviderSummary[] = []

  // OpenAI + Gemini — données réelles depuis api_costs
  const { openai: oai, gemini: gem } = await fetchDbCosts(startISO)

  for (const [date, cost] of oai.daily) {
    const entry = dailyMap.get(date)
    if (entry) entry.openai = round4(cost)
  }
  providers.push({
    id: 'openai',
    label: 'OpenAI',
    monthTotal: round4(oai.total),
    currency: 'USD',
    available: true,
    source: 'db',
    callCount: oai.count,
  })

  for (const [date, cost] of gem.daily) {
    const entry = dailyMap.get(date)
    if (entry) entry.gemini = round4(cost)
  }
  providers.push({
    id: 'gemini',
    label: 'Gemini',
    monthTotal: round4(gem.total),
    currency: 'USD',
    available: true,
    source: 'db',
    callCount: gem.count,
  })

  // Gladia — GET /v2/pre-recorded (billing_time × $0.0002/min)
  if (gladiaKey) {
    try {
      const { daily, total, count } = await fetchGladiaCosts(gladiaKey)
      for (const [date, cost] of daily) {
        const entry = dailyMap.get(date)
        if (entry) entry.gladia = round4(cost)
      }
      providers.push({
        id: 'gladia',
        label: 'Gladia',
        monthTotal: round4(total),
        currency: 'USD',
        available: true,
        source: 'api',
        callCount: count,
      })
    } catch {
      providers.push({ id: 'gladia', label: 'Gladia', monthTotal: 0, currency: 'USD', available: false, source: 'unavailable' })
    }
  } else {
    providers.push({ id: 'gladia', label: 'Gladia', monthTotal: 0, currency: 'USD', available: false, source: 'unavailable' })
  }

  const totalMonth = round4(
    providers.reduce((s, p) => s + p.monthTotal, 0),
  )

  const response: ApiCostsResponse = {
    providers,
    dailyCosts: Array.from(dailyMap.values()),
    totalMonth,
    fetchedAt: new Date().toISOString(),
    period: { start: toDateStr(monthStart), end: toDateStr(new Date()) },
  }

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
