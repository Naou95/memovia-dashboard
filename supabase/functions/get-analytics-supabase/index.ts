import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

function buildDailySeries(
  rows: { day: string; count: number }[],
  todayISO: string,
): { date: string; count: number }[] {
  const map = new Map<string, number>()
  for (const row of rows) {
    const key = String(row.day).split('T')[0]
    map.set(key, Number(row.count) || 0)
  }

  const series: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayISO)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    series.push({ date: key, count: map.get(key) ?? 0 })
  }
  return series
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
  )

  try {
    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [inscriptionsRes, generationsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', sevenDaysAgo),
      supabase
        .from('api_costs')
        .select('created_at')
        .gte('created_at', sevenDaysAgo),
    ])

    if (inscriptionsRes.error) throw new Error(inscriptionsRes.error.message)
    if (generationsRes.error) throw new Error(generationsRes.error.message)

    const groupByDay = (rows: { created_at: string }[]): { day: string; count: number }[] => {
      const map = new Map<string, number>()
      for (const row of rows) {
        const key = row.created_at.split('T')[0]
        map.set(key, (map.get(key) ?? 0) + 1)
      }
      return Array.from(map.entries()).map(([day, count]) => ({ day, count }))
    }

    const inscriptionsByDay = groupByDay(inscriptionsRes.data ?? [])
    const generationsByDay = groupByDay(generationsRes.data ?? [])

    const inscriptionsDaily = buildDailySeries(inscriptionsByDay, today)
    const generationsDaily = buildDailySeries(generationsByDay, today)

    return Response.json(
      {
        inscriptions: {
          total7d: inscriptionsRes.data?.length ?? 0,
          byDay: inscriptionsDaily,
        },
        generations: {
          total7d: generationsRes.data?.length ?? 0,
          byDay: generationsDaily,
        },
        fetchedAt: new Date().toISOString(),
      },
      { headers: corsHeaders },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return errorResponse(message, 502)
  }
})
