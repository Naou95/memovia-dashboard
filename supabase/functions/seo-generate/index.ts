import { createClient } from 'jsr:@supabase/supabase-js@2'
import { marked } from 'https://esm.sh/marked@9'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

function mdToHtml(md: string): string {
  if (!md) return ''
  // Skip conversion if content is already HTML
  if (md.trimStart().startsWith('<')) return md
  return marked.parse(md) as string
}

function isSafeUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr)
    if (u.protocol !== 'https:') return false
    const host = u.hostname
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(host)) return false
    return true
  } catch {
    return false
  }
}

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
  paa: string[]
}

interface GeneratedArticle {
  title: string
  meta_title: string
  meta_description: string
  excerpt: string
  content: string
  reading_time: number
  suggested_slug: string
  cover_image_url?: string | null
  internal_linking_suggestions?: string[] | null
  paa_used?: string[] | null
}

// ── Step 1 — DataForSEO SERP + PAA ────────────────────────────────────────────
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

  // Extract PAA questions (max 5)
  const paaItems = items.filter((i: any) => i.type === 'people_also_ask')
  const paa: string[] = paaItems
    .flatMap((i: any) => (i.items ?? []).map((q: any) => q.title).filter(Boolean))
    .slice(0, 5)

  return {
    keyword,
    total_results: task.result?.[0]?.se_results_count ?? 0,
    results: organic.map((i: any) => ({
      position: i.rank_absolute,
      title: i.title ?? '',
      url: i.url ?? '',
      description: i.description ?? '',
    })),
    paa,
  }
}

// ── Step 2 — Competitor content fetching ──────────────────────────────────────
async function fetchCompetitorContent(urls: string[]): Promise<string[]> {
  const validContents: string[] = []

  for (const url of urls.slice(0, 5)) {
    if (validContents.length >= 3) break

    if (!isSafeUrl(url)) continue

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      })

      if (!res.ok) { clearTimeout(timeoutId); continue }

      const html = await res.text()
      clearTimeout(timeoutId)

      // Strip HTML tags
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (text.length < 200) continue

      const decoded = text
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
      validContents.push(decoded.slice(0, 3000))
    } catch {
      // timeout or network error — skip silently
      continue
    }
  }

  return validContents
}

// ── Step 3 — Competitor analysis (single Haiku call) ─────────────────────────
async function analyzeCompetitors(contents: string[], apiKey: string): Promise<string> {
  if (contents.length === 0) return ''

  const numbered = contents
    .map((c, i) => `=== Article concurrent ${i + 1} ===\n${c}`)
    .join('\n\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Voici ${contents.length} article(s) concurrent(s). Pour chacun, liste en 5 points les sous-thèmes et angles couverts. Sois concis.\n\n${numbered}`,
      }],
    }),
  })

  if (!res.ok) return '' // Non-fatal: proceed without competitor context

  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

// ── Step 4 — Claude article generation (E-E-A-T) ──────────────────────────────
async function generateArticle(
  keyword: string,
  serp: SerpAnalysis,
  theme: string,
  competitorContext: string,
): Promise<GeneratedArticle> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('anthropic_not_configured')

  const systemPrompt = `Tu es un expert en formation professionnelle et EdTech en France, avec 10 ans d'expérience terrain dans les CFAs et organismes de formation. Tu rédiges pour MEMOVIA AI.

Lecteur cible : responsable pédagogique ou directeur de CFA, pragmatique, peu de temps, cherche des solutions concrètes.

Règles E-E-A-T :
- Montre une vraie expertise : exemples concrets du secteur, erreurs courantes connues sur le terrain, chiffres réels si disponibles
- Opinion tranchée — pas de "d'un côté... de l'autre"
- Intègre chaque PAA comme sous-section H3 naturellement dans le texte
- Suis l'intent dominant des concurrents pour la structure
- Angle spécifique CFA/formation pro — jamais de généralités EdTech globales

Interdit :
- Tirets (—) comme transitions
- "Dans un monde où", "À l'ère du numérique", "Il est essentiel de", "N'hésitez pas à", "En conclusion nous avons vu que"
- Introduction qui paraphrase la question plus de 2 lignes
- Keyword stuffing
- Plus d'une liste à puces par section

Structure :
- H1 unique (max 60 chars)
- 4-6 H2
- H3 pour les PAA
- 900-1400 mots selon la cible
- Excerpt 1-2 phrases (max 160 chars)
- À la fin, suggérer 2 sujets d'articles connexes pour le maillage interne (champ séparé "internal_linking_suggestions")`

  const cappedContext = competitorContext ? competitorContext.slice(0, 2000) : ''

  const userPrompt = `Mot-clé : "${keyword}"
${theme ? `\nAngle éditorial : ${theme}` : ''}

Top 5 titres des concurrents :
${serp.results.slice(0, 5).map((r, i) => `${i + 1}. ${r.title}`).join('\n')}

Questions PAA à intégrer comme H3 :
${serp.paa.length > 0 ? serp.paa.join('\n') : 'Aucune PAA disponible'}

${cappedContext ? `Ce que couvrent les concurrents (à faire mieux) :\n${cappedContext}` : ''}

Réponds UNIQUEMENT avec un objet JSON valide :
{
  "title": "Titre ≤ 60 caractères",
  "meta_title": "Meta title SEO (60 chars max)",
  "meta_description": "Meta description (155 chars max)",
  "excerpt": "1-2 phrases, 160 chars max",
  "suggested_slug": "url-slug-kebab-case-sans-accents",
  "reading_time": 8,
  "content": "# Titre\\n\\nContenu complet en Markdown...",
  "internal_linking_suggestions": ["Titre article connexe 1", "Titre article connexe 2"]
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
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
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

  let result: GeneratedArticle
  try {
    result = JSON.parse(jsonMatch[0]) as GeneratedArticle
  } catch {
    throw new Error('invalid_claude_json')
  }

  result.paa_used = serp.paa.slice(0, 5)
  result.content = mdToHtml(result.content)
  return result
}

// ── Unsplash Source URL fallback ──────────────────────────────────────────────
function buildUnsplashUrl(title: string): string {
  const stopWords = new Set([
    'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'est',
    'en', 'au', 'aux', 'par', 'pour', 'sur', 'dans', 'avec', 'sans', 'que',
    'qui', 'ce', 'se', 'sa', 'son', 'ses', 'tout', 'plus', 'tres', 'bien',
    'lors', 'selon', 'cette', 'cet', 'ces', 'leur', 'leurs', 'votre', 'vos',
  ])
  const keywords = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .slice(0, 3)
  const query = keywords.length > 0 ? keywords.join(',') : 'education,technology'
  return `https://source.unsplash.com/1200x630/?${encodeURIComponent(query)}`
}

// ── Gemini image generation (with Unsplash fallback) ──────────────────────────
async function generateCoverImage(title: string, slug: string): Promise<string | null> {
  const unsplashUrl = buildUnsplashUrl(title)

  try {
    const apiKey = Deno.env.get('GOOGLE_API_KEY')
    if (!apiKey) return unsplashUrl

    const prompt =
      `Professional editorial illustration for a blog article titled: ${title}. Modern, clean, minimalist style. No text. Suitable for EdTech and AI topics.`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      },
    )

    if (!res.ok) return unsplashUrl

    const data = await res.json()
    const inlineData = data.candidates?.[0]?.content?.parts
      ?.find((p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData)
      ?.inlineData
    if (!inlineData?.data) return unsplashUrl

    const mimeType: string = inlineData.mimeType ?? 'image/jpeg'
    const ext = mimeType.includes('png') ? 'png' : 'jpg'

    const binaryStr = atob(inlineData.data)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const filename = `${slug || 'article'}-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('blog-covers')
      .upload(filename, bytes, { contentType: mimeType })

    if (uploadError) return unsplashUrl

    const { data: urlData } = supabase.storage.from('blog-covers').getPublicUrl(filename)
    return urlData.publicUrl ?? unsplashUrl
  } catch {
    return unsplashUrl
  }
}

// ── 4-step pipeline ───────────────────────────────────────────────────────────
const PIPELINE_TIMEOUT = 90_000

async function runPipeline(keyword: string, theme: string, language: string, location: string) {
  // Step 1 — SERP + PAA
  const serp = await fetchSerp(keyword, language, location)

  // Step 2 + 3 — Competitor fetch & analysis (non-fatal)
  const competitorUrls = serp.results.slice(0, 5).map((r) => r.url)
  let competitorContext = ''

  try {
    const contents = await fetchCompetitorContent(competitorUrls)
    if (contents.length > 0) {
      const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
      if (apiKey) {
        competitorContext = await analyzeCompetitors(contents, apiKey)
      }
    }
  } catch {
    // Non-fatal: proceed without competitor context
    competitorContext = ''
  }

  // Step 4 — Article generation + cover image
  const article = await generateArticle(keyword, serp, theme, competitorContext)
  const coverImageUrl = await generateCoverImage(article.title, article.suggested_slug)

  return { serp, article: { ...article, cover_image_url: coverImageUrl } }
}

// ── Handler ────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  try {
    const body = await req.json()
    const keyword: string = (body.keyword ?? '').trim()
    const theme: string = (body.theme ?? '').trim()
    const language: string = body.language ?? 'French'
    const location: string = body.location ?? 'France'

    if (!keyword) return errorResponse('keyword_required', 400)

    // 4-step pipeline: SERP+PAA → fetch competitors → analyse competitors → generate article+image
    const result = await Promise.race([
      runPipeline(keyword, theme, language, location),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('pipeline_timeout')), PIPELINE_TIMEOUT)
      ),
    ])

    return Response.json(result, { headers: corsHeaders })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    if (message === 'pipeline_timeout') {
      return errorResponse(
        'La génération a dépassé 90 secondes. Réessayez avec un mot-clé plus court ou sans thème.',
        504,
      )
    }
    return errorResponse(message, 502)
  }
})
