import Anthropic from 'npm:@anthropic-ai/sdk'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'
import type { CompetitorAnalysisResult, CompetitorPage, ContentGap } from '../../src/types/seo.ts'

const DATAFORSEO_BASE = 'https://api.dataforseo.com/v3'
const CLAUDE_TIMEOUT_MS = 25_000

function getCredentials(): { dfsLogin: string; dfsPassword: string; anthropicKey: string } | null {
  const dfsLogin = Deno.env.get('DATAFORSEO_LOGIN')
  const dfsPassword = Deno.env.get('DATAFORSEO_PASSWORD')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!dfsLogin || !dfsPassword || !anthropicKey) return null
  return { dfsLogin, dfsPassword, anthropicKey }
}

async function fetchTopPages(domain: string, auth: string): Promise<CompetitorPage[]> {
  const res = await fetch(`${DATAFORSEO_BASE}/domain_analytics/organic/pages/live`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      target: domain,
      language_name: 'French',
      location_name: 'France',
      limit: 20,
      order_by: ['traffic_share,desc'],
    }]),
  })
  const json = await res.json()
  const items: Array<{
    full_path: string
    title: string | null
    traffic_share: number
    etv: number | null
  }> = json?.tasks?.[0]?.result?.items ?? []

  return items.map((i) => ({
    url: i.full_path,
    title: i.title ?? i.full_path,
    traffic_share: Math.round((i.traffic_share ?? 0) * 100) / 100,
    etv: i.etv ?? null,
  }))
}

async function analyzeGaps(
  competitorDomain: string,
  pages: CompetitorPage[],
  anthropicKey: string,
): Promise<ContentGap[]> {
  const client = new Anthropic({ apiKey: anthropicKey })

  const pageList = pages
    .slice(0, 20)
    .map((p, i) => `${i + 1}. [${(p.traffic_share).toFixed(1)}% trafic] ${p.title} — ${p.url}`)
    .join('\n')

  const prompt = `Tu es un expert SEO analysant les content gaps entre un concurrent et MEMOVIA AI (logiciel SaaS EdTech français pour organismes de formation et CFA).

Concurrent analysé : ${competitorDomain}
Top pages organiques :
${pageList}

MEMOVIA couvre : logiciels CFA, gestion formation, suivi apprenants, conformité Qualiopi, comptabilité formation.

Identifie 5-8 sujets importants couverts par ${competitorDomain} mais absents ou sous-couverts sur memovia.io.
Pour chaque sujet, évalue l'opportunité.

Réponds UNIQUEMENT en JSON, format exact :
[
  {
    "topic": "titre du sujet",
    "why": "pourquoi c'est une opportunité pour MEMOVIA en 1 phrase",
    "estimated_volume": 500
  }
]
Ne mets aucun texte avant ou après le JSON.`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS)

  try {
    const message = await Promise.race([
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('claude_timeout')), CLAUDE_TIMEOUT_MS),
      ),
    ])

    clearTimeout(timeoutId)

    const text = (message as Anthropic.Message).content[0].type === 'text'
      ? (message as Anthropic.Message).content[0].text
      : ''

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const parsed: ContentGap[] = JSON.parse(jsonMatch[0])
    return parsed
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[seo-competitor-analysis] Claude error:', err)
    return []
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  let domain: string
  try {
    const body = await req.json()
    domain = (body.domain ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!domain) return errorResponse('domain_required', 400)
  } catch {
    return errorResponse('invalid_json', 400)
  }

  const creds = getCredentials()
  if (!creds) return errorResponse('credentials_not_configured', 500)

  const dfsAuth = `Basic ${btoa(`${creds.dfsLogin}:${creds.dfsPassword}`)}`

  const topPages = await fetchTopPages(domain, dfsAuth)
  const contentGaps = topPages.length > 0
    ? await analyzeGaps(domain, topPages, creds.anthropicKey)
    : []

  const result: CompetitorAnalysisResult = {
    domain,
    top_pages: topPages,
    content_gaps: contentGaps,
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
