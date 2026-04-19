import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

const EU_BASE = 'https://eu.posthog.com'

async function hogql(query: string, apiKey: string, projectId: string): Promise<unknown[][]> {
  const res = await fetch(`${EU_BASE}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  })
  if (!res.ok) throw new Error(`PostHog ${res.status}`)
  const data = await res.json() as { results: unknown[][]; error?: string }
  if (data.error) throw new Error(data.error)
  return data.results ?? []
}

// Fill in missing days so the chart always has 7 points
function buildDailySeries(
  rows: unknown[][],
  todayISO: string,
): { date: string; visitors: number }[] {
  const map = new Map<string, number>()
  for (const row of rows) {
    const day = String(row[0]).split('T')[0]
    map.set(day, Number(row[1]) ?? 0)
  }

  const series: { date: string; visitors: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayISO)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    series.push({ date: key, visitors: map.get(key) ?? 0 })
  }
  return series
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  const apiKey = Deno.env.get('POSTHOG_API_KEY')
  const projectId = Deno.env.get('POSTHOG_PROJECT_ID')
  if (!apiKey || !projectId) return errorResponse('posthog_not_configured', 500)

  try {
    const today = new Date().toISOString().split('T')[0]

    const [dailyRows, eventsRows, pagesRows, sourcesRows, sessionsRows] = await Promise.all([
      // Daily visitors + pageviews (7d)
      hogql(
        `SELECT toDate(timestamp) AS day, uniq(distinct_id) AS visitors, count() AS pageviews
         FROM events
         WHERE event = '$pageview' AND timestamp >= now() - toIntervalDay(7)
         GROUP BY day ORDER BY day`,
        apiKey, projectId,
      ),
      // Key events totals
      hogql(
        `SELECT event, count() AS cnt
         FROM events
         WHERE event IN ('inscription_completee', 'generation_contenu')
           AND timestamp >= now() - toIntervalDay(7)
         GROUP BY event`,
        apiKey, projectId,
      ),
      // Top pages
      hogql(
        `SELECT properties['$current_url'] AS url, count() AS cnt
         FROM events
         WHERE event = '$pageview'
           AND timestamp >= now() - toIntervalDay(7)
           AND properties['$current_url'] != ''
         GROUP BY url ORDER BY cnt DESC LIMIT 10`,
        apiKey, projectId,
      ),
      // Traffic sources
      hogql(
        `SELECT coalesce(nullIf(properties['$referring_domain'], ''), 'Direct') AS source,
                count() AS cnt
         FROM events
         WHERE event = '$pageview'
           AND timestamp >= now() - toIntervalDay(7)
         GROUP BY source ORDER BY cnt DESC LIMIT 10`,
        apiKey, projectId,
      ),
      // Sessions today
      hogql(
        `SELECT uniq(properties['$session_id']) AS sessions
         FROM events
         WHERE timestamp >= toDate(now())`,
        apiKey, projectId,
      ),
    ])

    // Daily series (fill missing days with 0)
    const visitorsDaily = buildDailySeries(dailyRows, today)

    // Totals from daily rows
    const uniqueVisitors7d = visitorsDaily.reduce((s, d) => s + d.visitors, 0)
    const pageviews7d = dailyRows.reduce((s, row) => s + (Number(row[2]) || 0), 0)

    // Key event counts
    const eventsMap = new Map<string, number>()
    for (const row of eventsRows) eventsMap.set(String(row[0]), Number(row[1]) || 0)
    const inscriptions7d = eventsMap.get('inscription_completee') ?? 0
    const generations7d = eventsMap.get('generation_contenu') ?? 0

    // Top pages
    const topPages = pagesRows
      .filter((r) => r[0] && !String(r[0]).startsWith('http://localhost'))
      .map((r) => ({ url: String(r[0]), count: Number(r[1]) || 0 }))

    // Traffic sources
    const trafficSources = sourcesRows.map((r) => ({
      source: String(r[0]) || 'Direct',
      count: Number(r[1]) || 0,
    }))

    // Sessions today
    const sessionsToday = Number(sessionsRows[0]?.[0]) || 0

    return Response.json(
      {
        uniqueVisitors7d,
        pageviews7d,
        inscriptions7d,
        generations7d,
        visitorsDaily,
        topPages,
        trafficSources,
        sessionsToday,
        fetchedAt: new Date().toISOString(),
      },
      { headers: corsHeaders },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return errorResponse(message, 502)
  }
})
