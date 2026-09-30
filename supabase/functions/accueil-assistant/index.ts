import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

/**
 * Assistant IA de l'accueil (22/08/2026).
 *
 * Remplace l'usage du vieux copilot-chat (Anthropic, compte sans crédit depuis
 * le 19/08 — même bascule que le détecteur de leads) : ici Gemini 2.5 Flash,
 * la clé GOOGLE_API_KEY déjà en place pour rdv-transcribe.
 *
 * Le contexte est construit CÔTÉ SERVEUR (service role, lecture seule) sur les
 * tables v2 : leads (avec pourquoi/pitch), rdv (avec CR), financements. Trois
 * actions d'écriture, volontairement bornées aux tables du dashboard :
 * update_lead, update_financement, create_rdv.
 */

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  message: string
  history?: ChatMessage[]
}

// ── Gemini types (minimum utile) ───────────────────────────────────────────────

interface GeminiPart {
  text?: string
  functionCall?: { name: string; args: Record<string, unknown> }
  functionResponse?: { name: string; response: Record<string, unknown> }
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'update_lead',
        description:
          "Met à jour un lead du CRM : statut, prochaine action, date de relance. N'utiliser que si l'utilisateur demande clairement une modification.",
        parameters: {
          type: 'OBJECT',
          properties: {
            lead_name: { type: 'STRING', description: 'Nom du lead (recherche partielle)' },
            status: {
              type: 'STRING',
              enum: ['nouveau', 'contacte', 'en_discussion', 'proposition', 'gagne', 'perdu'],
            },
            next_action: { type: 'STRING', description: 'Nouvelle prochaine action' },
            follow_up_date: { type: 'STRING', description: 'Date de relance YYYY-MM-DD' },
          },
          required: ['lead_name'],
        },
      },
      {
        name: 'update_financement',
        description:
          "Met à jour un financement/concours : statut et/ou prochaine action. N'utiliser que sur demande claire.",
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Nom du financement (recherche partielle)' },
            status: {
              type: 'STRING',
              enum: ['veille', 'a_deposer', 'depose', 'jury', 'gagne', 'perdu', 'abandonne'],
            },
            next_action: { type: 'STRING' },
          },
          required: ['name'],
        },
      },
      {
        name: 'create_rdv',
        description: 'Crée une fiche RDV (titre + date/heure, lead optionnel).',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            date_iso: { type: 'STRING', description: 'Date/heure ISO 8601, ex 2026-08-24T14:30:00+02:00' },
            lead_name: { type: 'STRING', description: 'Nom du lead à lier (optionnel)' },
          },
          required: ['title', 'date_iso'],
        },
      },
    ],
  },
]

// ── Contexte serveur ───────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function buildContext(admin: any): Promise<string> {
  const [leadsRes, rdvRes, finRes] = await Promise.all([
    admin
      .from('leads')
      .select('name,type,status,maturity,assigned_to,contact_name,contact_role,contact_phone,contact_email,next_action,follow_up_date,last_contact_date,why,pitch')
      .eq('archived', false),
    admin.from('rdv').select('title,rdv_date,cr_status,cr').order('rdv_date', { ascending: false }).limit(12),
    admin
      .from('financements')
      .select('name,type,status,deadline,next_action,assigned_to,notes')
      .not('status', 'in', '("gagne","perdu","abandonne")'),
  ])

  const lines: string[] = []

  lines.push('## LEADS ACTIFS (table de vérité du CRM)')
  // deno-lint-ignore no-explicit-any
  for (const l of (leadsRes.data ?? []) as any[]) {
    lines.push(
      `- ${l.name} [${l.type}/${l.status}${l.maturity ? '/' + l.maturity : ''}] — contact : ${l.contact_name ?? '?'}${l.contact_role ? ' (' + l.contact_role + ')' : ''}${l.contact_phone ? ' ' + l.contact_phone : ''}${l.contact_email ? ' ' + l.contact_email : ''}`,
    )
    if (l.why) lines.push(`  Pourquoi : ${l.why}`)
    if (l.pitch) lines.push(`  Pitch : ${l.pitch}`)
    if (l.next_action) lines.push(`  Prochaine action : ${l.next_action}${l.follow_up_date ? ' (relance ' + l.follow_up_date + ')' : ''}`)
  }

  lines.push('', '## RDV (les 12 derniers, CR inclus)')
  // deno-lint-ignore no-explicit-any
  for (const r of (rdvRes.data ?? []) as any[]) {
    lines.push(`### ${r.title} — ${r.rdv_date} (CR : ${r.cr_status})`)
    if (r.cr) lines.push(String(r.cr).slice(0, 1600))
  }

  lines.push('', '## FINANCEMENTS & CONCOURS (non clos)')
  // deno-lint-ignore no-explicit-any
  for (const f of (finRes.data ?? []) as any[]) {
    lines.push(
      `- ${f.name} [${f.type}/${f.status}]${f.deadline ? ' — deadline ' + f.deadline : ''}${f.next_action ? ' — prochaine action : ' + f.next_action : ''}`,
    )
    if (f.notes) lines.push(`  Notes : ${String(f.notes).slice(0, 400)}`)
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
    `Tu peux AGIR via les outils (update_lead, update_financement, create_rdv) quand l'utilisateur le demande clairement. Ne demande pas de confirmation si les paramètres sont clairs. Après une action, dis ce qui a été fait.`,
    `Si une info n'est pas dans les données ci-dessous, dis-le au lieu d'inventer.`,
    ``,
    `# DONNÉES DU DASHBOARD (temps réel)`,
    context,
  ].join('\n')
}

// ── Exécution des actions ──────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function executeTool(admin: any, name: string, args: Record<string, unknown>): Promise<{ result: string; label: string }> {
  if (name === 'update_lead') {
    const { data: found } = await admin
      .from('leads')
      .select('id,name')
      .ilike('name', `%${String(args.lead_name)}%`)
      .eq('archived', false)
      .limit(1)
    if (!found?.[0]) return { result: `Lead « ${args.lead_name} » introuvable.`, label: '' }
    const patch: Record<string, unknown> = {}
    if (args.status) patch.status = String(args.status)
    if (args.next_action) patch.next_action = String(args.next_action)
    if (args.follow_up_date) patch.follow_up_date = String(args.follow_up_date)
    if (Object.keys(patch).length === 0) return { result: 'Rien à mettre à jour.', label: '' }
    const { error } = await admin.from('leads').update(patch).eq('id', found[0].id)
    if (error) return { result: `Échec de la mise à jour : ${error.message}`, label: '' }
    return { result: `Lead « ${found[0].name} » mis à jour (${Object.keys(patch).join(', ')}).`, label: `Lead ${found[0].name} mis à jour` }
  }

  if (name === 'update_financement') {
    const { data: found } = await admin
      .from('financements')
      .select('id,name')
      .ilike('name', `%${String(args.name)}%`)
      .limit(1)
    if (!found?.[0]) return { result: `Financement « ${args.name} » introuvable.`, label: '' }
    const patch: Record<string, unknown> = {}
    if (args.status) patch.status = String(args.status)
    if (args.next_action) patch.next_action = String(args.next_action)
    if (Object.keys(patch).length === 0) return { result: 'Rien à mettre à jour.', label: '' }
    const { error } = await admin.from('financements').update(patch).eq('id', found[0].id)
    if (error) return { result: `Échec de la mise à jour : ${error.message}`, label: '' }
    return { result: `Financement « ${found[0].name} » mis à jour.`, label: `${found[0].name} mis à jour` }
  }

  if (name === 'create_rdv') {
    let leadId: string | null = null
    if (args.lead_name) {
      const { data: found } = await admin
        .from('leads')
        .select('id')
        .ilike('name', `%${String(args.lead_name)}%`)
        .limit(1)
      leadId = found?.[0]?.id ?? null
    }
    const { error } = await admin.from('rdv').insert({
      title: String(args.title),
      rdv_date: String(args.date_iso),
      lead_id: leadId,
    })
    if (error) return { result: `Échec de la création : ${error.message}`, label: '' }
    return { result: `RDV « ${args.title} » créé pour le ${args.date_iso}.`, label: `RDV créé : ${args.title}` }
  }

  return { result: 'Action inconnue.', label: '' }
}

// ── Handler ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  const googleKey = Deno.env.get('GOOGLE_API_KEY')
  if (!googleKey) return errorResponse('google_api_key_missing', 500)

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

    const contents: GeminiContent[] = [
      ...history.map((m) => ({
        role: (m.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
        parts: [{ text: String(m.content).slice(0, 2000) }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ]

    const actionLabels: string[] = []
    let reply = ''

    // Boucle outils : 3 tours max (question simple = 1 tour).
    for (let round = 0; round < 3; round++) {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt(context) }] },
            contents,
            tools: TOOLS,
            generationConfig: { temperature: 0.3, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } },
          }),
        },
      )

      if (!resp.ok) {
        const errText = await resp.text()
        console.error('gemini error', resp.status, errText.slice(0, 300))
        return errorResponse(`gemini_error_${resp.status}`, 502)
      }

      const data = await resp.json() as {
        candidates?: Array<{ content?: { parts?: GeminiPart[] } }>
      }
      const parts = data.candidates?.[0]?.content?.parts ?? []
      const calls = parts.filter((p) => p.functionCall)
      const text = parts.filter((p) => p.text).map((p) => p.text).join('')

      if (calls.length === 0) {
        reply = text || reply
        break
      }

      // Exécuter les appels d'outils puis renvoyer les résultats au modèle.
      contents.push({ role: 'model', parts })
      const responseParts: GeminiPart[] = []
      for (const call of calls) {
        const { name, args } = call.functionCall!
        const { result, label } = await executeTool(admin, name, args ?? {})
        if (label) actionLabels.push(label)
        responseParts.push({ functionResponse: { name, response: { result } } })
      }
      contents.push({ role: 'user', parts: responseParts })
      reply = text // texte intermédiaire éventuel, remplacé au tour suivant
    }

    if (!reply) reply = actionLabels.length > 0 ? 'Fait.' : "Je n'ai pas de réponse — reformule ?"

    return new Response(JSON.stringify({ reply, actions: actionLabels }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('accueil-assistant error', err)
    return errorResponse('unknown_error', 500)
  }
})
