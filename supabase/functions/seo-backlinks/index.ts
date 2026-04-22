import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'
import type { BacklinksResult, BacklinkTopPage } from '../../src/types/seo.ts'

const DATAFORSEO_BASE = 'https://api.dataforseo.com/v3'

function getCredentials(): { login: string; password: string } | null {
  const login = Deno.env.get('DATAFORSEO_LOGIN')
  const password = Deno.env.get('DATAFORSEO_PASSWORD')
  if (!login || !password) return null
  return { login, password }
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
  if (!creds) return errorResponse('dataforseo_not_configured', 500)

  const auth = `Basic ${btoa(`${creds.login}:${creds.password}`)}`

  // Summary: total backlinks, referring domains, DR
  const summaryRes = await fetch(`${DATAFORSEO_BASE}/backlinks/summary/live`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ target: domain, include_subdomains: true }]),
  })
  const summaryJson = await summaryRes.json()
  const summary = summaryJson?.tasks?.[0]?.result?.[0] ?? {}

  // Top pages by backlinks
  const pagesRes = await fetch(`${DATAFORSEO_BASE}/backlinks/pages/live`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      target: domain,
      include_subdomains: true,
      limit: 10,
      order_by: ['backlinks,desc'],
    }]),
  })
  const pagesJson = await pagesRes.json()
  const pagesItems: Array<{
    url: string
    backlinks: number
    referring_domains: number
  }> = pagesJson?.tasks?.[0]?.result?.items ?? []

  const topPages: BacklinkTopPage[] = pagesItems.map((p) => ({
    url: p.url,
    backlinks_count: p.backlinks ?? 0,
    referring_domains: p.referring_domains ?? 0,
  }))

  const result: BacklinksResult = {
    domain,
    total_backlinks: summary.backlinks ?? 0,
    referring_domains: summary.referring_domains ?? 0,
    domain_rank: summary.rank ?? null,
    top_pages: topPages,
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
