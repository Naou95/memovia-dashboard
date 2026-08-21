import { corsHeaders, errorResponse } from '../_shared/auth.ts'
import { isAuthenticatedCronCall } from '../_shared/cronAuth.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

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

  const translated = await translateMissingTitles(supabaseAdmin)

  console.log(`changelog-collect terminé: ${items.length} PRs trouvées, ${inserted} candidats insérés, ${translated} titres traduits`)
  return Response.json({ found: items.length, inserted, translated }, { headers: corsHeaders })
})

// ── Titres en clair (00049) ────────────────────────────────────────────────────
// Réécrit chaque titre de PR en une phrase compréhensible par un non-technicien
// (retour Naoufel 21/08). Auto-rattrapage : traite TOUTES les lignes sans
// title_public, pas seulement les nouvelles — un échec Gemini laisse NULL (le
// front affiche alors le titre technique nettoyé) et sera retenté au run suivant.
// La phrase est RELUE au tri : Gemini reformule, l'humain valide — rien d'inventé
// ne devient un jalon retenu sans relecture.
// deno-lint-ignore no-explicit-any — même client non typé que dans le handler :
// `ReturnType<typeof createClient>` s'instancie en `never` sur les payloads (le
// piège documenté par les 9 erreurs héritées d'email-lead-detector).
async function translateMissingTitles(
  supabaseAdmin: SupabaseClient<any>,
): Promise<number> {
  const googleKey = Deno.env.get('GOOGLE_API_KEY')
  if (!googleKey) {
    console.error('changelog-collect: GOOGLE_API_KEY absent, titres en clair non générés')
    return 0
  }

  const { data: rows, error: selError } = await supabaseAdmin
    .from('product_milestones')
    .select('id, title, repo')
    .is('title_public', null)
    .limit(60)
  if (selError || !rows || rows.length === 0) {
    if (selError) console.error('changelog-collect select sans titre:', selError.message)
    return 0
  }

  const liste = (rows as Array<{ id: string; title: string; repo: string }>)
    .map((r) => `${r.id} | ${r.repo} | ${r.title}`)
    .join('\n')
  const prompt =
    'Voici des titres de changements techniques des produits MEMOVIA (un par ligne, format id | dépôt | titre).\n' +
    'Réécris CHAQUE titre en une phrase courte en français, compréhensible par quelqu\'un de non technique, ' +
    'FIDÈLE au titre : n\'invente aucun détail, ne promets aucun impact qui n\'y figure pas, pas de jargon ' +
    '(pas de « PR », « edge function », « cache », « 202 », noms de librairies). Dis ce que ça change pour ' +
    'l\'utilisateur ou l\'équipe.\n' +
    'Réponds UNIQUEMENT en JSON : [{"id": "...", "titre": "..."}]\n\n' + liste

  let text = ''
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // thinkingBudget:0 obligatoire : sans lui, 500 intermittents constatés sur le projet
          generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: AbortSignal.timeout(45_000),
      },
    )
    if (!res.ok) throw new Error(`gemini_${res.status}`)
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  } catch (err) {
    console.error('changelog-collect traduction Gemini:', err)
    return 0
  }

  const match = text.match(/\[[\s\S]*\]/)
  if (!match) { console.error('changelog-collect: réponse Gemini sans JSON'); return 0 }
  let parsed: Array<{ id?: string; titre?: string }>
  try { parsed = JSON.parse(match[0]) } catch { console.error('changelog-collect: JSON Gemini invalide'); return 0 }

  const validIds = new Set((rows as Array<{ id: string }>).map((r) => r.id))
  let updated = 0
  for (const item of parsed) {
    // On ne met à jour QUE les lignes demandées : un id fabriqué par le modèle est ignoré.
    if (!item.id || !validIds.has(item.id)) continue
    const titre = (item.titre ?? '').trim()
    if (!titre) continue
    const { error } = await supabaseAdmin
      .from('product_milestones')
      .update({ title_public: titre.slice(0, 200) })
      .eq('id', item.id)
    if (error) { console.error('changelog-collect update titre:', error.message); continue }
    updated++
  }
  return updated
}
