import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

// ── Types ──────────────────────────────────────────────────────────────────────
interface SeoSuggestion {
  keyword: string
  title: string
  angle: string
  volume: number
  opportunity_score: number
  why_now: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Compute SHA-256 hash of a string, returns lowercase hex string. */
async function sha256Hex(input: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  )
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── DataForSEO Search Volume ────────────────────────────────────────────────────
async function fetchSearchVolumes(
  keywords: string[],
): Promise<Map<string, number>> {
  const login = Deno.env.get('DATAFORSEO_LOGIN')
  const password = Deno.env.get('DATAFORSEO_PASSWORD')

  if (!login || !password) {
    throw new Error('dataforseo_not_configured')
  }

  const credentials = btoa(`${login}:${password}`)

  const body = keywords.map((keyword) => ({
    keyword,
    language_name: 'French',
    location_name: 'France',
  }))

  const res = await fetch(
    'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )

  if (!res.ok) {
    throw new Error(`dataforseo_error_${res.status}`)
  }

  const data = await res.json()
  const volumeMap = new Map<string, number>()

  if (Array.isArray(data.tasks)) {
    for (const task of data.tasks) {
      const result = task.result?.[0]
      if (result?.keyword != null) {
        volumeMap.set(result.keyword, result.search_volume ?? 0)
      }
    }
  }

  return volumeMap
}

// ── Claude suggestions generation ─────────────────────────────────────────────
async function generateSuggestions(
  volumeMap: Map<string, number>,
): Promise<SeoSuggestion[]> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('anthropic_not_configured')

  const systemPrompt =
    `Tu es expert SEO EdTech France. Voici les volumes de recherche sur des mots-clés liés à MEMOVIA AI (plateforme IA pour CFAs et formateurs). Génère exactement 8 suggestions d'articles à publier ce mois-ci. Pour chaque suggestion retourne un JSON : { keyword, title, angle, volume, opportunity_score (0-100 basé sur volume/concurrence estimée/pertinence MEMOVIA), why_now }. Priorise les sujets spécifiques au secteur CFA/formation pro avec peu de concurrence. Retourne uniquement le JSON array, rien d'autre.`

  const volumeLines = Array.from(volumeMap.entries())
    .map(([kw, vol]) => `- ${kw} : ${vol}`)
    .join('\n')

  const userMessage = `Voici les volumes de recherche mensuels :\n${volumeLines}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`anthropic_error_${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const raw: string = data.content?.[0]?.text ?? ''

  // Extract JSON array — Claude may include extra text or markdown fences
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('invalid_claude_response')

  const suggestions = JSON.parse(jsonMatch[0]) as SeoSuggestion[]
  return suggestions
}

// ── Handler ────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Read all seeds from seo_seeds table
    const { data: seeds, error: seedsError } = await supabase
      .from('seo_seeds')
      .select('keyword')

    if (seedsError) {
      throw new Error(`seeds_fetch_error: ${seedsError.message}`)
    }

    if (!seeds || seeds.length === 0) {
      return errorResponse('no_seeds_found', 400)
    }

    const keywords: string[] = seeds.map((s: { keyword: string }) => s.keyword)

    // 2. Compute SHA-256 hash of sorted, comma-joined keywords (for cache key)
    const sortedKeywords = [...keywords].sort()
    const seedsHash = await sha256Hex(sortedKeywords.join(','))

    // 3. Check cache — return if a non-expired entry exists
    const { data: cached } = await supabase
      .from('seo_suggestions_cache')
      .select('suggestions_json, expires_at')
      .eq('seeds_hash', seedsHash)
      .or('expires_at.is.null,expires_at.gt.now()')
      .maybeSingle()

    if (cached?.suggestions_json) {
      return Response.json(
        { suggestions: cached.suggestions_json },
        { headers: corsHeaders },
      )
    }

    // 4. Fetch DataForSEO search volumes for all seeds in one batch
    const volumeMap = await fetchSearchVolumes(keywords)

    // 5. Call Claude to generate 8 suggestions
    const suggestions = await generateSuggestions(volumeMap)

    // 6. Store result in cache (upsert on seeds_hash, expires in 24h)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await supabase
      .from('seo_suggestions_cache')
      .upsert(
        {
          seeds_hash: seedsHash,
          suggestions_json: suggestions,
          expires_at: expiresAt,
        },
        { onConflict: 'seeds_hash' },
      )

    // 7. Return suggestions
    return Response.json(
      { suggestions },
      { headers: corsHeaders },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'

    if (message === 'dataforseo_not_configured') {
      return errorResponse('dataforseo_not_configured', 400)
    }
    if (message === 'anthropic_not_configured') {
      return errorResponse('anthropic_not_configured', 400)
    }
    if (message === 'invalid_claude_response') {
      return errorResponse('invalid_claude_response', 502)
    }

    return errorResponse(message, 502)
  }
})
