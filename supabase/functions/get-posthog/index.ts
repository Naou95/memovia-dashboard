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
    map.set(day, Number(row[1]) || 0)
  }

  const series: { date: string; visitors: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayISO)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    series.push({ date: key, visitors: Number(map.get(key)) || 0 })
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

  const url = new URL(req.url)
  const RAW_HOST = url.searchParams.get('host') ?? 'app.memovia.io'
  const ALLOWED_HOSTS = new Set(['app.memovia.io', 'memovia.io'])
  if (!ALLOWED_HOSTS.has(RAW_HOST)) return errorResponse('invalid_host', 400)
  const host = RAW_HOST
  const hostFilter = `AND properties['$host'] = '${host}'`

  try {
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    if (host === 'memovia.io') {
      // ── Mode marketing site ──────────────────────────────────────────────
      const [dailyRows, pagesRows, sourcesRows, eventsRows, uniqVisitorsRow] = await Promise.all([
        // Daily visitors + pageviews (7d)
        hogql(
          `SELECT toDate(timestamp) AS day, uniq(distinct_id) AS visitors, count() AS pageviews
           FROM events
           WHERE event = '$pageview'
             AND timestamp >= now() - toIntervalDay(7)
             ${hostFilter}
           GROUP BY day ORDER BY day`,
          apiKey, projectId,
        ),
        // Top pages
        hogql(
          `SELECT properties['$current_url'] AS url, count() AS cnt
           FROM events
           WHERE event = '$pageview'
             AND timestamp >= now() - toIntervalDay(7)
             AND properties['$current_url'] != ''
             ${hostFilter}
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
             ${hostFilter}
           GROUP BY source ORDER BY cnt DESC LIMIT 10`,
          apiKey, projectId,
        ),
        // Marketing-specific event counts
        hogql(
          `SELECT event, count() AS cnt
           FROM events
           WHERE event IN ('demo_demandee', 'tarifs_vus', 'article_lu')
             AND timestamp >= now() - toIntervalDay(7)
             ${hostFilter}
           GROUP BY event`,
          apiKey, projectId,
        ),
        // True 7-day unique visitors (deduplicated across days)
        hogql(
          `SELECT uniq(distinct_id) AS visitors
           FROM events
           WHERE event = '$pageview'
             AND timestamp >= now() - toIntervalDay(7)
             AND properties['$host'] = '${host}'`,
          apiKey, projectId,
        ),
      ])

      const visitorsDaily = buildDailySeries(dailyRows, today)
      const uniqueVisitors7d = Number(uniqVisitorsRow[0]?.[0]) || 0
      const pageviews7d = dailyRows.reduce((s, row) => s + (Number(row[2]) || 0), 0)

      const topPages = pagesRows
        .filter((r) => r[0] && !String(r[0]).startsWith('http://localhost'))
        .map((r) => ({ url: String(r[0]), count: Number(r[1]) || 0 }))

      const trafficSources = sourcesRows.map((r) => ({
        source: String(r[0]) || 'Direct',
        count: Number(r[1]) || 0,
      }))

      const eventsMap = new Map<string, number>()
      for (const row of eventsRows) eventsMap.set(String(row[0]), Number(row[1]) || 0)

      return Response.json(
        {
          uniqueVisitors7d,
          pageviews7d,
          visitorsDaily,
          topPages,
          trafficSources,
          events: {
            demo_demandee: Number(eventsMap.get('demo_demandee')) || 0,
            tarifs_vus: Number(eventsMap.get('tarifs_vus')) || 0,
            article_lu: Number(eventsMap.get('article_lu')) || 0,
          },
          fetchedAt: now.toISOString(),
        },
        { headers: corsHeaders },
      )
    }

    // ── Mode app (app.memovia.io ou défaut) ──────────────────────────────
    const [dailyRows, pagesRows, sourcesRows, sessionsRows, uniqVisitorsRow] = await Promise.all([
      // Daily visitors + pageviews (7d)
      hogql(
        `SELECT toDate(timestamp) AS day, uniq(distinct_id) AS visitors, count() AS pageviews
         FROM events
         WHERE event = '$pageview'
           AND timestamp >= now() - toIntervalDay(7)
           ${hostFilter}
         GROUP BY day ORDER BY day`,
        apiKey, projectId,
      ),
      // Top pages
      hogql(
        `SELECT properties['$current_url'] AS url, count() AS cnt
         FROM events
         WHERE event = '$pageview'
           AND timestamp >= now() - toIntervalDay(7)
           AND properties['$current_url'] != ''
           ${hostFilter}
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
           ${hostFilter}
         GROUP BY source ORDER BY cnt DESC LIMIT 10`,
        apiKey, projectId,
      ),
      // Sessions today
      hogql(
        `SELECT uniq(properties['$session_id']) AS sessions
         FROM events
         WHERE timestamp >= toDate(now())
           ${hostFilter}`,
        apiKey, projectId,
      ),
      // True 7-day unique visitors (deduplicated across days)
      hogql(
        `SELECT uniq(distinct_id) AS visitors
         FROM events
         WHERE event = '$pageview'
           AND timestamp >= now() - toIntervalDay(7)
           AND properties['$host'] = '${host}'`,
        apiKey, projectId,
      ),
    ])

    const visitorsDaily = buildDailySeries(dailyRows, today)
    const uniqueVisitors7d = Number(uniqVisitorsRow[0]?.[0]) || 0
    const pageviews7d = dailyRows.reduce((s, row) => s + (Number(row[2]) || 0), 0)

    const topPages = pagesRows
      .filter((r) => r[0] && !String(r[0]).startsWith('http://localhost'))
      .map((r) => ({ url: String(r[0]), count: Number(r[1]) || 0 }))

    const trafficSources = sourcesRows.map((r) => ({
      source: String(r[0]) || 'Direct',
      count: Number(r[1]) || 0,
    }))

    const sessionsToday = Number(sessionsRows[0]?.[0]) || 0

    // inscriptions7d et generations7d viennent désormais de la DB Supabase
    // (voir Edge Function get-posthog-app-events). On retourne 0 pour la
    // compatibilité descendante avec les clients existants.
    return Response.json(
      {
        uniqueVisitors7d,
        pageviews7d,
        inscriptions7d: 0,
        generations7d: 0,
        visitorsDaily,
        topPages,
        trafficSources,
        sessionsToday,
        fetchedAt: now.toISOString(),
      },
      { headers: corsHeaders },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return errorResponse(message, 502)
  }
})
