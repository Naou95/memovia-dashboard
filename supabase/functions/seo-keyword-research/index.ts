import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'
import type { KeywordResearchResult, RelatedKeyword, KeywordTrend } from '../../src/types/seo.ts'

const DATAFORSEO_BASE = 'https://api.dataforseo.com/v3'

function getCredentials(): { login: string; password: string } | null {
  const login = Deno.env.get('DATAFORSEO_LOGIN')
  const password = Deno.env.get('DATAFORSEO_PASSWORD')
  if (!login || !password) return null
  return { login, password }
}

function authHeader(login: string, password: string): string {
  return `Basic ${btoa(`${login}:${password}`)}`
}

async function fetchSearchVolume(
  keyword: string,
  auth: string,
): Promise<{ volume: number; competition: number | null; competition_level: string | null; cpc: number | null; trend: KeywordTrend[] }> {
  const res = await fetch(`${DATAFORSEO_BASE}/keywords_data/google_ads/search_volume/live`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ keywords: [keyword], language_name: 'French', location_name: 'France' }]),
  })
  const json = await res.json()
  const item = json?.tasks?.[0]?.result?.[0]
  if (!item) return { volume: 0, competition: null, competition_level: null, cpc: null, trend: [] }

  const trend: KeywordTrend[] = (item.monthly_searches ?? []).map((m: { year: number; month: number; search_volume: number }) => ({
    year: m.year,
    month: m.month,
    search_volume: m.search_volume ?? 0,
  }))

  return {
    volume: item.search_volume ?? 0,
    competition: item.competition ?? null,
    competition_level: item.competition_level ?? null,
    cpc: item.cpc ?? null,
    trend,
  }
}

async function fetchRelatedKeywords(
  keyword: string,
  auth: string,
): Promise<RelatedKeyword[]> {
  const res = await fetch(`${DATAFORSEO_BASE}/keywords_data/google_ads/keywords_for_keywords/live`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      keywords: [keyword],
      language_name: 'French',
      location_name: 'France',
      limit: 10,
    }]),
  })
  const json = await res.json()
  const items: Array<{
    keyword: string
    search_volume: number
    competition_level: string | null
    cpc: number | null
  }> = json?.tasks?.[0]?.result ?? []

  return items
    .filter((i) => i.keyword !== keyword)
    .slice(0, 10)
    .map((i) => ({
      keyword: i.keyword,
      search_volume: i.search_volume ?? 0,
      competition_level: (i.competition_level ?? null) as RelatedKeyword['competition_level'],
      cpc: i.cpc ?? null,
    }))
}

// KD estimation: Google competition (0-1) × 100, floored to integer
function estimateKD(competition: number | null): number {
  if (competition === null) return 0
  return Math.round(competition * 100)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  let keyword: string
  try {
    const body = await req.json()
    keyword = (body.keyword ?? '').trim()
    if (!keyword) return errorResponse('keyword_required', 400)
  } catch {
    return errorResponse('invalid_json', 400)
  }

  const creds = getCredentials()
  if (!creds) return errorResponse('dataforseo_not_configured', 500)

  const auth = authHeader(creds.login, creds.password)

  // Parallel calls to minimize latency
  const [volumeData, related] = await Promise.all([
    fetchSearchVolume(keyword, auth),
    fetchRelatedKeywords(keyword, auth),
  ])

  const result: KeywordResearchResult = {
    keyword,
    search_volume: volumeData.volume,
    competition: volumeData.competition,
    competition_level: volumeData.competition_level as KeywordResearchResult['competition_level'],
    cpc: volumeData.cpc,
    keyword_difficulty: estimateKD(volumeData.competition),
    trend: volumeData.trend,
    related_keywords: related,
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
