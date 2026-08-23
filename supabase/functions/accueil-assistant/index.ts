import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'
import { SCHEMA, TABLES, missingForCreate, schemaForPrompt, validate } from './schema.ts'

/**
 * Assistant IA de l'accueil.
 *
 * 23/08/2026 — bascule Gemini → NVIDIA NIM SEUL, sans repli payant (même compte
 * que email-lead-detector, clé NVIDIA_NIM_KEY). GOOGLE_API_KEY n'est plus lue ici
 * (elle sert encore à rdv-transcribe, seo-generate et changelog-collect).
 * ⚠️ Qwen était la demande initiale : NVIDIA a mis TOUS ses
 * Qwen en fin de vie (HTTP 410 « end of life », le dernier — qwen3.5-397b-a17b —
 * le 27/07/2026), aucun n'est plus servi. Modèle retenu au banc du 23/08 sur le
 * contrat réel (tool-calling + gros contexte) : minimax-m3, 1,5 s et appels
 * d'outils corrects, là où deepseek-v4-flash met 26 s et kimi-k3 51 s.
 *
 * Les 3 outils métier figés (update_lead/update_financement/create_rdv) sont
 * remplacés par 3 outils GÉNÉRIQUES bornés par SCHEMA ci-dessous : l'agent écrit
 * dans n'importe quelle table du dashboard sans qu'on ajoute une fonction par
 * table. Ajouter une table = 4 lignes dans SCHEMA.
 *
 * 23/08/2026 (suite) : Positionnement est passé en base (migration 00053), donc
 * l'agent peut enfin le modifier comme le reste.
 */

/**
 * Modèles NVIDIA NIM essayés dans l'ordre, banc du 23/08/2026 sur le contrat réel
 * (appel d'outil + français). Le quota gratuit se compte PAR MODÈLE, donc la
 * cascade sert de rattrapage : un 429 sur l'un ne dit rien des autres.
 * Ordre : minimax est le plus rapide ; step passe AVANT nemotron parce qu'il est
 * le seul à avoir rendu un tool_call à toutes les tailles de contexte testées.
 * ⚠️ Vérifié en conditions réelles le 23/08 : avec le prompt système complet,
 * nemotron « réfléchit à voix haute » au lieu d'appeler l'outil et l'action ne
 * part jamais. Il reste plus bas, mieux que pas de réponse du tout.
 * deepseek ferme la marche : lent (26 s à vide, davantage avec le contexte), mais
 * il répondait encore quand minimax était déjà en 429 — c'est un quota de plus.
 * kimi-k3 reste écarté : 51 s à vide, il ne tiendrait pas dans le budget.
 */
const NIM_MODELS = [
  'minimaxai/minimax-m3',
  'stepfun-ai/step-3.7-flash',
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'deepseek-ai/deepseek-v4-flash-0731',
]

/** Budget de temps de TOUTE la requête, tours d'outils compris. */
const TOTAL_BUDGET_MS = 110_000

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  message: string
  history?: ChatMessage[]
}

// ── Outils ─────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_rows',
      description:
        "Liste le contenu d'une table du dashboard. À utiliser avant d'agir quand l'info n'est pas déjà dans le contexte fourni.",
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string', enum: TABLES },
          search: { type: 'string', description: 'Filtre optionnel sur le nom/titre' },
        },
        required: ['table'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_row',
      description: "Crée une ligne dans une table du dashboard (RDV, tâche, lead, financement, item de roadmap…).",
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string', enum: TABLES },
          values: { type: 'object', description: 'Colonnes → valeurs, conformes au schéma donné dans le prompt.' },
        },
        required: ['table', 'values'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_row',
      description: "Met à jour une ligne existante, retrouvée par son nom/titre (recherche partielle).",
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string', enum: TABLES },
          match: { type: 'string', description: 'Nom ou titre de la ligne à modifier' },
          values: { type: 'object', description: 'Colonnes → nouvelles valeurs.' },
        },
        required: ['table', 'match', 'values'],
      },
    },
  },
]

// deno-lint-ignore no-explicit-any
async function executeTool(admin: any, name: string, args: Record<string, unknown>): Promise<{ result: string; label: string }> {
  const table = String(args.table ?? '')
  if (!SCHEMA[table]) return { result: `Table « ${table} » inconnue. Tables : ${TABLES.join(', ')}.`, label: '' }
  const spec = SCHEMA[table]

  if (name === 'list_rows') {
    const cols = ['id', spec.label, ...Object.keys(spec.cols)].filter((c, i, a) => a.indexOf(c) === i)
    let q = admin.from(table).select(cols.join(',')).limit(40)
    if (args.search) q = q.ilike(spec.label, `%${String(args.search)}%`)
    const { data, error } = await q
    if (error) return { result: `Lecture impossible : ${error.message}`, label: '' }
    return { result: JSON.stringify(data ?? []).slice(0, 6000), label: '' }
  }

  const values = (args.values ?? {}) as Record<string, unknown>

  // Le modèle nomme les lignes liées ; l'uuid se résout ici, jamais dans le prompt.
  const resolveRef = async (refTable: string, value: string): Promise<string | null> => {
    const { data } = await admin
      .from(refTable)
      .select('id')
      .ilike(SCHEMA[refTable].label, `%${value}%`)
      .limit(1)
    return data?.[0]?.id ?? null
  }

  const checked = await validate(table, values, resolveRef)
  if (!checked.ok) return { result: checked.error, label: '' }
  const patch = checked.patch

  if (name === 'create_row') {
    const missing = missingForCreate(table, patch)
    if (missing === null) return { result: `Création interdite sur ${table} (mise à jour seule).`, label: '' }
    if (missing.length) return { result: `Champs obligatoires manquants pour ${table} : ${missing.join(', ')}.`, label: '' }
    const { data, error } = await admin.from(table).insert(patch).select(`id,${spec.label}`).single()
    if (error) return { result: `Échec de la création : ${error.message}`, label: '' }
    const shown = data?.[spec.label] ?? table
    return { result: `Créé dans ${table} : ${shown}.`, label: `${table} créé : ${shown}` }
  }

  if (name === 'update_row') {
    if (Object.keys(patch).length === 0) return { result: 'Rien à mettre à jour.', label: '' }
    const { data: found } = await admin
      .from(table)
      .select(`id,${spec.label}`)
      .ilike(spec.label, `%${String(args.match ?? '')}%`)
      .limit(2)
    if (!found?.[0]) return { result: `Aucune ligne « ${args.match} » dans ${table}.`, label: '' }
    if (found.length > 1) {
      return { result: `Plusieurs lignes correspondent à « ${args.match} » dans ${table} : ${found.map((f: Record<string, unknown>) => f[spec.label]).join(', ')}. Précise laquelle.`, label: '' }
    }
    const { error } = await admin.from(table).update(patch).eq('id', found[0].id)
    if (error) return { result: `Échec de la mise à jour : ${error.message}`, label: '' }
    const shown = found[0][spec.label]
    return { result: `${table} « ${shown} » mis à jour (${Object.keys(patch).join(', ')}).`, label: `${shown} mis à jour` }
  }

  return { result: 'Action inconnue.', label: '' }
}

// ── Contexte serveur ───────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function buildContext(admin: any): Promise<string> {
  const [leadsRes, rdvRes, finRes, tasksRes] = await Promise.all([
    admin
      .from('leads')
      .select('name,type,status,maturity,assigned_to,contact_name,contact_role,contact_phone,contact_email,next_action,follow_up_date,last_contact_date,why,pitch')
      .eq('archived', false),
    admin.from('rdv').select('title,rdv_date,cr_status,cr').order('rdv_date', { ascending: false }).limit(12),
    admin
      .from('financements')
      .select('name,type,status,deadline,next_action,assigned_to,notes')
      .not('status', 'in', '("gagne","perdu","abandonne")'),
    admin.from('tasks').select('title,status,priority,due_date,assigned_to').neq('status', 'done').limit(30),
  ])

  const lines: string[] = []

  // Les totaux sont calculés ICI, pas par le modèle. Constaté le 23/08 : interrogé
  // sur « combien de RDV », il répondait 5 sur 6 (il omettait celui à venir), et
  // deux formulations de consigne n'y ont rien changé. Un compteur déterministe
  // dans l'en-tête de section règle le problème à la source.
  const n = (r: { data?: unknown[] | null }) => (r.data ?? []).length

  lines.push(`## LEADS ACTIFS — ${n(leadsRes)} au total (table de vérité du CRM)`)
  // deno-lint-ignore no-explicit-any
  for (const l of (leadsRes.data ?? []) as any[]) {
    lines.push(
      `- ${l.name} [${l.type}/${l.status}${l.maturity ? '/' + l.maturity : ''}] — contact : ${l.contact_name ?? '?'}${l.contact_role ? ' (' + l.contact_role + ')' : ''}${l.contact_phone ? ' ' + l.contact_phone : ''}${l.contact_email ? ' ' + l.contact_email : ''}`,
    )
    if (l.why) lines.push(`  Pourquoi : ${l.why}`)
    if (l.pitch) lines.push(`  Pitch : ${l.pitch}`)
    if (l.next_action) lines.push(`  Prochaine action : ${l.next_action}${l.follow_up_date ? ' (relance ' + l.follow_up_date + ')' : ''}`)
  }

  // CR complet des 4 derniers seulement : le contexte part à CHAQUE tour d'outil.
  // (Ce n'est PAS la latence NIM que ça vise : elle est indépendante de la taille,
  // mesuré 152 s à 12 tokens comme à 1 100. C'est la fiabilité du tool-calling
  // qui est en jeu : elle se dégrade quand le contexte grossit.)
  // Le détail des plus anciens s'obtient par list_rows.
  lines.push('', `## RDV — ${n(rdvRes)} au total (CR détaillé pour les 4 plus récents, titres ensuite)`)
  // deno-lint-ignore no-explicit-any
  for (const [i, r] of ((rdvRes.data ?? []) as any[]).entries()) {
    lines.push(`### ${r.title} — ${r.rdv_date} (CR : ${r.cr_status})`)
    if (r.cr && i < 4) lines.push(String(r.cr).slice(0, 900))
  }

  lines.push('', `## FINANCEMENTS & CONCOURS — ${n(finRes)} non clos`)
  // deno-lint-ignore no-explicit-any
  for (const f of (finRes.data ?? []) as any[]) {
    lines.push(
      `- ${f.name} [${f.type}/${f.status}]${f.deadline ? ' — deadline ' + f.deadline : ''}${f.next_action ? ' — prochaine action : ' + f.next_action : ''}`,
    )
    if (f.notes) lines.push(`  Notes : ${String(f.notes).slice(0, 400)}`)
  }

  lines.push('', `## TÂCHES OUVERTES — ${n(tasksRes)} au total`)
  // deno-lint-ignore no-explicit-any
  for (const t of (tasksRes.data ?? []) as any[]) {
    lines.push(`- ${t.title} [${t.status}/${t.priority}]${t.due_date ? ' — échéance ' + t.due_date : ''}${t.assigned_to ? ' — ' + t.assigned_to : ''}`)
  }

  return lines.join('\n')
}

function systemPrompt(context: string): string {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  return [
    `Tu es l'assistant interne du dashboard MEMOVIA (EdTech SaaS d'accessibilité pédagogique pour CFA et écoles). Équipe : Naoufel (CTO) et Emir (commerce, à Milan).`,
    `Date du jour : ${today}. Réponds en français, concis, direct, sans flatterie. Markdown léger (listes, gras).`,
    ``,
    `Règles métier NON NÉGOCIABLES (à respecter dans toute recommandation) :`,
    `- Pricing par établissement, JAMAIS par siège ; pas de freemium.`,
    `- Ne jamais dire « 100 % financé par l'OPCO » ; le levier vérifié = majoration RQTH versée au CFA (module 2, décideur = référent handicap).`,
    `- Jamais « conforme RGAA » (état officiel : non conforme). Pas de comparatif Glaaster à charge.`,
    `- Aucune preuve inventée : pas de chiffre invérifiable, pas de faux témoignage.`,
    ``,
    `# AGIR`,
    `Tu pilotes le dashboard par les outils list_rows, create_row et update_row. Tu peux donc créer un RDV, une tâche, un lead, un financement, un item de roadmap, mettre à jour un statut, une date de relance, un CR, un pitch, etc.`,
    `Les valeurs doivent respecter STRICTEMENT ce schéma (toute autre colonne est refusée) :`,
    schemaForPrompt(),
    `Pour une colonne « ref:<table> », donne le NOM de la ligne visée, pas un identifiant.`,
    `Rien ne se supprime : pour sortir un lead de la liste active, mets archived à true.`,
    `N'invente pas de valeur d'énumération. Si l'utilisateur est clair, agis sans demander confirmation, puis dis ce qui a été fait.`,
    `La page Positionnement se pilote par la table positionnement_items. C'est l'argumentaire commercial : reprends les mots demandés, ne reformule pas de toi-même, et n'y introduis jamais un chiffre que l'utilisateur ne t'a pas donné. Fais un list_rows dessus avant de modifier, pour viser la bonne ligne.`,
    `Si une info n'est pas dans les données ci-dessous, utilise list_rows ou dis que tu ne sais pas — n'invente jamais.`,
    // Constaté le 23/08 : interrogé sur un nombre, le modèle répondait « 5 RDV » là où le
    // contexte en listait 6 — mais sommé d'ÉNUMÉRER, il sort les 6 et le bon total. Compter
    // « de tête » échoue, compter en écrivant réussit : d'où l'obligation de lister.
    `Quand on te demande COMBIEN il y a de quelque chose, liste d'abord les éléments un par un (en les numérotant), et ne donne le total qu'à la fin. Ne réponds jamais par un nombre seul : un décompte faux est pire qu'une absence de réponse.`,
    ``,
    `# DONNÉES DU DASHBOARD (temps réel)`,
    context,
  ].join('\n')
}

// ── Handler ────────────────────────────────────────────────────────────────────

interface NimToolCall {
  id: string
  type: string
  function: { name: string; arguments: string }
}

interface NimMessage {
  role: string
  content?: string | null
  tool_calls?: NimToolCall[]
  tool_call_id?: string
}

/**
 * Un tour de modèle, format OpenAI.
 *
 * ⚠️ Mesuré le 23/08/2026 : le tier gratuit NIM répond en 1 à 8 s au calme, mais
 * met les requêtes en FILE ~150 s dès qu'on enchaîne les appels — sur les trois
 * modèles testés, à la seconde près, donc c'est un throttling, pas du calcul.
 * Une conversation à 4 tours y passerait 10 minutes et mourrait en wall-clock.
 * D'où le budget de temps ci-dessous et la cascade de modèles.
 * 🔴 Pas de repli vers un modèle payant : décision du 23/08, on ne dépense pas
 * pour cet assistant. Quand les quatre modèles sont saturés, la fonction répond
 * « réessaie dans une minute » au lieu de basculer sur autre chose.
 */
const NIM_TIMEOUT_MS = 40_000

async function callModel(
  messages: NimMessage[],
  nimKey: string,
  deadline: number,
): Promise<{ msg: NimMessage | null; via: string }> {
  const payload = { messages, tools: TOOLS, temperature: 0.3, max_tokens: 1024 }

  // Le quota gratuit NIM est compté PAR MODÈLE (vérifié 23/08 : minimax en 429
  // pendant que deepseek répondait) — la cascade est donc TOUT le filet de
  // sécurité, puisqu'il n'y a plus de repli payant derrière (choix du 23/08 :
  // pas de dépense). Si les quatre sont saturés, on le dit à l'utilisateur.
  for (const model of NIM_MODELS) {
    const left = deadline - Date.now()
    if (left < 5_000) break // plus le temps d'un essai utile
    try {
      const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${nimKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, ...payload }),
        signal: AbortSignal.timeout(Math.min(NIM_TIMEOUT_MS, left)),
      })
      if (resp.ok) {
        const data = await resp.json() as { choices?: Array<{ message?: NimMessage }> }
        return { msg: data.choices?.[0]?.message ?? null, via: `nim:${model}` }
      }
      console.error('nim error', model, resp.status, (await resp.text()).slice(0, 160))
    } catch (err) {
      console.error('nim timeout/erreur', model, String(err).slice(0, 160))
    }
  }

  return { msg: null, via: 'nim' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  const nimKey = Deno.env.get('NVIDIA_NIM_KEY')
  if (!nimKey) return errorResponse('nim_key_missing', 500)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const body: RequestBody = await req.json()
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : ''
    if (!message) return errorResponse('message_required', 400)
    const history = Array.isArray(body.history) ? body.history.slice(-12) : []

    const context = await buildContext(admin)

    const messages: NimMessage[] = [
      { role: 'system', content: systemPrompt(context) },
      ...history.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content).slice(0, 2000),
      })),
      { role: 'user', content: message },
    ]

    const actionLabels: string[] = []
    let reply = ''

    // Boucle outils : 4 tours max (list_rows puis action = 2 tours fréquents).
    const deadline = Date.now() + TOTAL_BUDGET_MS
    let via = ''
    for (let round = 0; round < 4; round++) {
      const turn = await callModel(messages, nimKey, deadline)
      via = turn.via
      const msg = turn.msg
      if (!msg) {
        if (reply || actionLabels.length > 0) break // un tour a déjà produit quelque chose
        // Tous les modèles NIM sont saturés. Pas de repli payant : on le dit
        // franchement plutôt que de renvoyer une erreur muette au front.
        return new Response(
          JSON.stringify({
            reply: "Les modèles NVIDIA sont tous saturés à l'instant (quota gratuit). Réessaie dans une minute.",
            actions: [],
            via: 'indisponible',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      if (Date.now() > deadline) break

      const calls = msg.tool_calls ?? []
      if (msg.content) reply = msg.content

      if (calls.length === 0) break

      messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: calls })
      for (const call of calls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.function.arguments || '{}')
        } catch {
          messages.push({ role: 'tool', tool_call_id: call.id, content: 'Arguments JSON illisibles.' })
          continue
        }
        const { result, label } = await executeTool(admin, call.function.name, args)
        if (label) actionLabels.push(label)
        messages.push({ role: 'tool', tool_call_id: call.id, content: result })
      }
    }

    if (!reply) reply = actionLabels.length > 0 ? 'Fait.' : "Je n'ai pas de réponse — reformule ?"

    return new Response(JSON.stringify({ reply, actions: actionLabels, via }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('accueil-assistant error', err)
    return errorResponse('unknown_error', 500)
  }
})
