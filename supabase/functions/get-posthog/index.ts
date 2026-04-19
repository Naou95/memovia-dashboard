import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

const BASE_URL = 'https://eu.posthog.com/api/projects'

interface TrendResult {
  data: number[]
  days: string[]
  count: number
  breakdown_value?: string
}

interface TrendResponse {
  result: TrendResult[]
}

async function phFetch(path: string, apiKey: string): Promise<TrendResponse> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`PostHog ${res.status}: ${path}`)
  return res.json()
}

function trendUrl(
  projectId: string,
  events: object[],
  opts: {
    dateFrom?: string
    dateTo?: string
    interval?: string
    breakdown?: string
    breakdownType?: string
  } = {},
): string {
  const params = new URLSearchParams()
  params.set('events', JSON.stringify(events))
  params.set('date_from', opts.dateFrom ?? '-7d')
  if (opts.dateTo) params.set('date_to', opts.dateTo)
  if (opts.interval) params.set('interval', opts.interval)
  if (opts.breakdown) params.set('breakdown', opts.breakdown)
  if (opts.breakdownType) params.set('breakdown_type', opts.breakdownType)
  return `/${projectId}/insights/trend/?${params.toString()}`
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

    const [visitorsRes, pageviewsRes, inscriptionsRes, generationsRes, topPagesRes, sourcesRes, sessionsRes] =
      await Promise.all([
        phFetch(trendUrl(projectId, [{ id: '$pageview', math: 'dau' }], { interval: 'day' }), apiKey),
        phFetch(trendUrl(projectId, [{ id: '$pageview', math: 'total' }], { interval: 'day' }), apiKey),
        phFetch(trendUrl(projectId, [{ id: 'inscription_completee', math: 'total' }]), apiKey),
        phFetch(trendUrl(projectId, [{ id: 'generation_contenu', math: 'total' }]), apiKey),
        phFetch(
          trendUrl(projectId, [{ id: '$pageview', math: 'total' }], {
            breakdown: '$current_url',
            breakdownType: 'event',
          }),
          apiKey,
        ),
        phFetch(
          trendUrl(projectId, [{ id: '$pageview', math: 'total' }], {
            breakdown: '$referring_domain',
            breakdownType: 'event',
          }),
          apiKey,
        ),
        phFetch(
          trendUrl(projectId, [{ id: '$session_start', math: 'total' }], {
            dateFrom: today,
            dateTo: today,
            interval: 'day',
          }),
          apiKey,
        ),
      ])

    // Unique visitors 7d — sum of daily DAU values
    const visitorsResult = visitorsRes.result[0]
    const uniqueVisitors7d = visitorsResult?.data?.reduce((s, n) => s + n, 0) ?? 0

    // Pageviews 7d — sum
    const pageviewsResult = pageviewsRes.result[0]
    const pageviews7d = pageviewsResult?.data?.reduce((s, n) => s + n, 0) ?? 0

    // Daily visitors series for chart
    const visitorsDaily = (visitorsResult?.days ?? []).map((date, i) => ({
      date,
      visitors: visitorsResult.data[i] ?? 0,
    }))

    // Key event totals
    const inscriptions7d = inscriptionsRes.result[0]?.count ?? 0
    const generations7d = generationsRes.result[0]?.count ?? 0

    // Top pages (breakdown by URL, limit 10)
    const topPages = topPagesRes.result
      .map((r) => ({
        url: String(r.breakdown_value ?? ''),
        count: r.count ?? r.data?.reduce((s, n) => s + n, 0) ?? 0,
      }))
      .filter((p) => p.url && !p.url.startsWith('http://localhost'))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Traffic sources (breakdown by referring domain)
    const trafficSources = sourcesRes.result
      .map((r) => ({
        source: String(r.breakdown_value ?? 'Direct'),
        count: r.count ?? r.data?.reduce((s, n) => s + n, 0) ?? 0,
      }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Sessions today
    const sessionsToday = sessionsRes.result[0]?.count ?? 0

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
