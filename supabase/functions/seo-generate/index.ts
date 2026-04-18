import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

// ── Types ──────────────────────────────────────────────────────────────────────
interface SerpResult {
  position: number
  title: string
  url: string
  description: string
}

interface SerpAnalysis {
  keyword: string
  total_results: number
  results: SerpResult[]
}

interface GeneratedArticle {
  title: string
  meta_title: string
  meta_description: string
  excerpt: string
  content: string
  reading_time: number
  suggested_slug: string
}

// ── DataForSEO SERP ────────────────────────────────────────────────────────────
async function fetchSerp(
  keyword: string,
  language: string,
  location: string,
): Promise<SerpAnalysis> {
  const login = Deno.env.get('DATAFORSEO_LOGIN')
  const password = Deno.env.get('DATAFORSEO_PASSWORD')

  if (!login || !password) {
    throw new Error('dataforseo_not_configured')
  }

  const credentials = btoa(`${login}:${password}`)

  const res = await fetch(
    'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          keyword,
          language_name: language,
          location_name: location,
          device: 'desktop',
          os: 'windows',
        },
      ]),
    },
  )

  if (!res.ok) {
    throw new Error(`dataforseo_error_${res.status}`)
  }

  const data = await res.json()
  const task = data.tasks?.[0]

  if (!task || task.status_code !== 20000) {
    throw new Error(`dataforseo_task_failed: ${task?.status_message ?? 'unknown'}`)
  }

  const items: any[] = task.result?.[0]?.items ?? []
  const organic = items.filter((i: any) => i.type === 'organic').slice(0, 10)

  return {
    keyword,
    total_results: task.result?.[0]?.se_results_count ?? 0,
    results: organic.map((i: any) => ({
      position: i.rank_absolute,
      title: i.title ?? '',
      url: i.url ?? '',
      description: i.description ?? '',
    })),
  }
}

// ── Claude article generation ──────────────────────────────────────────────────
async function generateArticle(
  keyword: string,
  serp: SerpAnalysis,
): Promise<GeneratedArticle> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('anthropic_not_configured')

  const serpContext = serp.results
    .slice(0, 5)
    .map((r) => `${r.position}. ${r.title}\n   ${r.url}\n   ${r.description}`)
    .join('\n\n')

  const prompt = `Tu es un expert SEO et rédacteur web pour MEMOVIA, une EdTech SaaS française spécialisée dans les outils pédagogiques IA.

Génère un article de blog SEO optimisé en français pour le mot-clé : "${keyword}"

Contexte SERP — top résultats actuels :
${serpContext || 'Aucun résultat SERP disponible.'}

Écris un article structuré en Markdown avec :
- Titre H1 accrocheur contenant le mot-clé
- Introduction engageante (2-3 paragraphes, inclure le mot-clé naturellement)
- 4-6 sections H2 avec contenu substantiel et exemples concrets
- Listes à puces ou tableaux quand c'est pertinent
- Conclusion avec un CTA vers MEMOVIA (memovia.io)
- Minimum 1 200 mots au total

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown autour, avec exactement cette structure :
{
  "title": "Titre complet de l'article",
  "meta_title": "Meta title SEO (60 caractères max)",
  "meta_description": "Meta description (155 caractères max)",
  "excerpt": "Résumé accrocheur de l'article (150 à 200 caractères)",
  "suggested_slug": "url-slug-kebab-case-sans-accents",
  "reading_time": 8,
  "content": "# Titre\\n\\nContenu complet en Markdown..."
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`anthropic_error_${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const raw: string = data.content?.[0]?.text ?? ''

  // Extract JSON — Claude sometimes wraps in ```json blocks
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('invalid_claude_response')

  return JSON.parse(jsonMatch[0]) as GeneratedArticle
}

// ── Handler ────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  try {
    const body = await req.json()
    const keyword: string = (body.keyword ?? '').trim()
    const language: string = body.language ?? 'French'
    const location: string = body.location ?? 'France'

    if (!keyword) return errorResponse('keyword_required', 400)

    // Sequential: SERP context is needed for article generation
    const serp = await fetchSerp(keyword, language, location)
    const article = await generateArticle(keyword, serp)

    return Response.json({ serp, article }, { headers: corsHeaders })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return errorResponse(message, 502)
  }
})
