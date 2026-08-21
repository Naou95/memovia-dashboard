import { corsHeaders, errorResponse } from '../_shared/auth.ts'
import { isAuthenticatedCronCall } from '../_shared/cronAuth.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Historique produit (mémoire d'entreprise, 21/08/2026) : chaque lundi 05:30 UTC
// (cron 00048), les PRs mergées de la semaine sur les 5 dépôts MEMOVIA deviennent
// des « candidats » dans product_milestones ; le tri humain (retenir/écarter) se
// fait en un clic sur /historique, relancé par le briefing tant qu'il en reste.

// Les 5 dépôts MEMOVIA (CLAUDE.md racine ~/memovia).
const REPOS = [
  'Naou95/memovia-ia-notes',
  'Naou95/memovia-ia-notes-landing-page',
  'Naou95/memovia-landing-it',
  'Naou95/memovia-dashboard',
  'Naou95/memovia-guides',
]
// 8 jours et pas 7 : le cron est hebdo, une dérive d'horaire ne doit pas perdre de
// PR ; la dédupe sur source_url absorbe le chevauchement.
const DAYS_BACK = 8

interface SearchItem {
  title: string
  html_url: string
  repository_url: string
  pull_request?: { merged_at?: string | null }
  closed_at: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const isCronCall = serviceRoleKey.length > 0 && authHeader === `Bearer ${serviceRoleKey}`
  if (!isCronCall && !(await isAuthenticatedCronCall(req))) {
    return errorResponse('unauthorized', 401)
  }

  const ghToken = Deno.env.get('GITHUB_CHANGELOG_TOKEN')
  if (!ghToken) return errorResponse('github_token_not_configured', 500)

  const since = new Date(Date.now() - DAYS_BACK * 86400000).toISOString().split('T')[0]
  // Plusieurs qualificateurs repo: dans une même recherche GitHub = OR.
  const q = `is:pr is:merged merged:>=${since} ${REPOS.map((r) => `repo:${r}`).join(' ')}`
  const resp = await fetch(
    `https://api.github.com/search/issues?per_page=50&q=${encodeURIComponent(q)}`,
    {
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'memovia-dashboard-changelog',
      },
      signal: AbortSignal.timeout(20_000),
    },
  )
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    console.error('changelog-collect: GitHub API', resp.status, body.slice(0, 200))
    return errorResponse(`github_api_${resp.status}`, 502)
  }
  const { items } = await resp.json() as { items: SearchItem[] }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let inserted = 0
  for (const it of items) {
    const merged = it.pull_request?.merged_at ?? it.closed_at
    if (!merged) continue
    // ignoreDuplicates : un jalon déjà trié (retenu/écarté) ne doit JAMAIS
    // revenir en candidat — la dédupe se joue sur source_url (UNIQUE, 00047).
    const { error, count } = await supabaseAdmin
      .from('product_milestones')
      .upsert({
        date: merged.split('T')[0],
        repo: it.repository_url.split('/').pop() ?? 'inconnu',
        title: it.title,
        source_url: it.html_url,
        status: 'candidat',
      }, { onConflict: 'source_url', ignoreDuplicates: true, count: 'exact' })
    if (error) { console.error('changelog-collect upsert:', error.message); continue }
    inserted += count ?? 0
  }

  console.log(`changelog-collect terminé: ${items.length} PRs trouvées, ${inserted} candidats insérés`)
  return Response.json({ found: items.length, inserted }, { headers: corsHeaders })
})
