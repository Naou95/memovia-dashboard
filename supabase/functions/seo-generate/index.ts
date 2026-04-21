import { createClient } from 'jsr:@supabase/supabase-js@2'
import { marked } from 'https://esm.sh/marked@9'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

function mdToHtml(md: string): string {
  if (!md) return ''
  // Skip conversion if content is already HTML
  if (md.trimStart().startsWith('<')) return md
  return marked.parse(md) as string
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
  theme: string,
): Promise<GeneratedArticle> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('anthropic_not_configured')

  const serpContext = serp.results
    .slice(0, 5)
    .map((r) => `${r.position}. ${r.title}\n   ${r.url}\n   ${r.description}`)
    .join('\n\n')

  const themeSection = theme
    ? `\nThème / angle éditorial : ${theme}\n`
    : ''

  const systemPrompt = `Tu es un rédacteur expert en EdTech et formation professionnelle, avec 10 ans d'expérience. Tu écris des articles de blog pour MEMOVIA AI, une plateforme française qui génère du contenu pédagogique par IA pour les CFAs et écoles.

Règles absolues de rédaction :
- Jamais de tiret (—) comme transition entre deux idées. Utilise des points, des virgules, des phrases courtes.
- Jamais de formules creuses : "Dans un monde où", "À l'ère du numérique", "Il est essentiel de", "Force est de constater", "N'hésitez pas à".
- Jamais de listes à puces sauf si la liste apporte vraiment quelque chose (max 1 liste par section).
- Pas de conclusion qui résume ce qui vient d'être dit mot pour mot.
- Pas de ton corporate ou publicitaire. Tu n'es pas un commercial.
- Phrases courtes à moyennes (15-25 mots max). Pas de phrases à rallonge avec trois subordonnées.
- Ton direct, concret, légèrement personnel. Comme un expert qui parle à un pair, pas à un client.
- Chaque paragraphe fait 3-4 lignes max. Aère le texte.

Structure obligatoire en Markdown :
- Un seul H1 (le titre, max 60 caractères)
- Des H2 pour les grandes sections (4 à 6 sections)
- Des H3 pour les sous-parties si nécessaire
- Minimum 900 mots, maximum 1400 mots
- Un excerpt de 1-2 phrases percutantes (max 160 caractères) séparé du corps de l'article

Ce qui doit transparaître :
- Une vraie expertise sur le sujet
- Des exemples concrets ou des chiffres réels si pertinents
- Un point de vue tranché — pas de "d'un côté... de l'autre"
- Une accroche première phrase qui donne envie de lire la suite`

  const userPrompt = `Tu rédiges pour MEMOVIA, une EdTech SaaS française spécialisée dans les outils pédagogiques IA.

Génère un article de blog SEO optimisé en français pour le mot-clé : "${keyword}"
${themeSection}
Contexte SERP — top résultats actuels :
${serpContext || 'Aucun résultat SERP disponible.'}

Structure attendue :
- Un H1 (titre, ≤ 60 caractères, sans "Pourquoi" ni "Comment" en début)
- Introduction en 2 paragraphes courts (3-4 lignes chacun), mot-clé inclus naturellement
- 4 à 6 sections H2, chacune avec 2-3 paragraphes courts et des exemples concrets
- Sous-sections H3 si une section est complexe
- Conclusion avec un CTA vers MEMOVIA (memovia.io)
- Aucun tiret en début de ligne, aucune liste à puces excessive

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown autour, avec exactement cette structure :
{
  "title": "Titre ≤ 60 caractères, sans Pourquoi/Comment en début",
  "meta_title": "Meta title SEO (60 caractères max)",
  "meta_description": "Meta description (155 caractères max)",
  "excerpt": "1-2 phrases, 160 caractères max",
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

  const result = JSON.parse(jsonMatch[0]) as GeneratedArticle
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

    // Sequential: SERP → Claude article → Gemini cover image
    const serp = await fetchSerp(keyword, language, location)
    const article = await generateArticle(keyword, serp, theme)
    const coverImageUrl = await generateCoverImage(article.title, article.suggested_slug)

    return Response.json(
      { serp, article: { ...article, cover_image_url: coverImageUrl } },
      { headers: corsHeaders },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return errorResponse(message, 502)
  }
})
