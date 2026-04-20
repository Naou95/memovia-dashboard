import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

interface AnthropicContentBlock {
  type: string
  [key: string]: unknown
}

interface TaskSummary { id: string; title: string; status: string; priority: string; assigned_to: string | null; due_date: string | null }
interface LeadSummary { id: string; name: string; type: string; status: string; assigned_to: string | null; next_action: string | null }
interface ContractSummary { id: string; organization_name: string; status: string; mrr_eur: number | null; license_count: number }
interface CalendarEventSummary { title: string; start: string; end: string }
interface FeedbackItemSummary { id: string; title: string; status: string; category: string; voteCount: number }

interface DashboardContext {
  mrr?: number
  arr?: number
  activeSubscriptions?: number
  qontoBalance?: number
  tasks?: TaskSummary[]
  leads?: LeadSummary[]
  contracts?: ContractSummary[]
  todayEvents?: CalendarEventSummary[]
  feedbackItems?: FeedbackItemSummary[]
}

interface RequestBody {
  message: string
  history: ChatMessage[]
  context?: DashboardContext
}

// ── Tool definitions ────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'create_task',
    description: 'Crée une tâche dans le système de gestion des tâches MEMOVIA. Utilise cet outil quand l\'utilisateur demande d\'ajouter, créer ou noter une tâche.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titre de la tâche' },
        description: { type: 'string', description: 'Description optionnelle de la tâche' },
        priority: { type: 'string', enum: ['haute', 'normale', 'basse'], description: 'Priorité. Défaut: normale' },
        assigned_to: {
          oneOf: [
            { type: 'string', enum: ['naoufel', 'emir'] },
            { type: 'array', items: { type: 'string', enum: ['naoufel', 'emir'] } }
          ],
          description: 'Personne(s) assignée(s) — string ou array de naoufel/emir'
        },
        due_date: { type: 'string', description: 'Date d\'échéance au format YYYY-MM-DD (optionnel)' },
        status: { type: 'string', enum: ['todo', 'en_cours'], description: 'Statut initial. Défaut: todo' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_lead_status',
    description: 'Change le statut d\'un lead dans le CRM MEMOVIA. Utilise cet outil quand l\'utilisateur veut mettre à jour, faire avancer ou changer le statut d\'un lead.',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: 'ID exact du lead si connu (prioritaire sur lead_name)' },
        lead_name: { type: 'string', description: 'Nom de l\'organisation ou du lead (recherche partielle acceptée)' },
        new_status: {
          type: 'string',
          enum: ['nouveau', 'contacte', 'en_discussion', 'proposition', 'gagne', 'perdu'],
          description: 'Nouveau statut du lead',
        },
      },
      required: ['lead_name', 'new_status'],
    },
  },
  {
    name: 'create_contract',
    description: 'Crée un nouveau contrat dans le système MEMOVIA. Utilise cet outil quand l\'utilisateur veut enregistrer, créer ou ajouter un contrat.',
    input_schema: {
      type: 'object',
      properties: {
        organization_name: { type: 'string', description: 'Nom de l\'organisation cliente' },
        contact_name: { type: 'string', description: 'Nom du contact principal (optionnel)' },
        mrr_eur: { type: 'number', description: 'Revenu mensuel récurrent en euros' },
        license_count: { type: 'number', description: 'Nombre de licences' },
        organization_type: { type: 'string', enum: ['ecole', 'cfa', 'entreprise', 'autre'], description: 'Type d\'organisation. Défaut: ecole' },
        status: { type: 'string', enum: ['prospect', 'negotiation', 'signe', 'actif'], description: 'Statut du contrat. Défaut: prospect' },
      },
      required: ['organization_name', 'mrr_eur', 'license_count'],
    },
  },
  {
    name: 'create_feedback_item',
    description: 'Crée un item dans la roadmap/feedback MEMOVIA. Utilise cet outil quand l\'utilisateur veut soumettre une idée, signaler un bug ou suggérer une amélioration.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titre de l\'item de feedback' },
        description: { type: 'string', description: 'Description détaillée (optionnel)' },
        category: {
          type: 'string',
          enum: ['fonctionnalite', 'bug', 'amelioration'],
          description: 'Catégorie. Défaut: fonctionnalite',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_feedback_status',
    description: 'Met à jour le statut d\'un item de feedback/roadmap. Utilise cet outil quand l\'utilisateur veut faire avancer un item vers planifié, en développement ou livré.',
    input_schema: {
      type: 'object',
      properties: {
        item_title: { type: 'string', description: 'Titre ou partie du titre de l\'item (recherche partielle)' },
        new_status: {
          type: 'string',
          enum: ['backlog', 'planifie', 'en_dev', 'livre'],
          description: 'Nouveau statut de l\'item',
        },
      },
      required: ['item_title', 'new_status'],
    },
  },
  {
    name: 'list_feedback_items',
    description: 'Liste les items de la roadmap/feedback MEMOVIA avec leur nombre de votes.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['backlog', 'planifie', 'en_dev', 'livre'],
          description: 'Filtre par statut (optionnel — tous si absent)',
        },
      },
      required: [],
    },
  },
]

// ── System prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(context?: DashboardContext): string {
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const lines: string[] = [
    `Tu es le Copilote IA interne de MEMOVIA, une EdTech SaaS française (outils pédagogiques IA pour établissements scolaires).`,
    `Tu es l'assistant de confiance de l'équipe fondatrice : Naoufel et Emir.`,
    `Date du jour : ${today}.`,
    `Réponds toujours en français, de façon concise et directe.`,
    ``,
    `Tu peux exécuter des actions directement : créer une tâche, changer le statut d'un lead, créer un contrat, gérer les items de roadmap/feedback.`,
    `Utilise les outils dès qu'une action est clairement demandée. Ne demande pas de confirmation sauf si les paramètres sont ambigus.`,
    ``,
  ]

  if (!context || Object.keys(context).length === 0) {
    lines.push('Données du dashboard : non disponibles.')
    return lines.join('\n')
  }

  // Stripe / Qonto
  if (context.mrr !== undefined || context.arr !== undefined || context.qontoBalance !== undefined) {
    lines.push('## FINANCES')
    if (context.mrr !== undefined) lines.push(`- MRR : ${context.mrr.toLocaleString('fr-FR')} €`)
    if (context.arr !== undefined) lines.push(`- ARR : ${context.arr.toLocaleString('fr-FR')} €`)
    if (context.activeSubscriptions !== undefined) lines.push(`- Abonnements actifs : ${context.activeSubscriptions}`)
    if (context.qontoBalance !== undefined) lines.push(`- Solde Qonto : ${context.qontoBalance.toLocaleString('fr-FR')} €`)
    lines.push('')
  }

  // Tasks
  if (context.tasks && context.tasks.length > 0) {
    lines.push('## TÂCHES EN COURS')
    for (const t of context.tasks) {
      const due = t.due_date ? ` — échéance ${t.due_date}` : ''
      lines.push(`- [${t.status}] ${t.title} — priorité ${t.priority} — ${t.assigned_to ?? 'non assigné'}${due} (id:${t.id})`)
    }
    lines.push('')
  } else {
    lines.push('## TÂCHES EN COURS\nAucune tâche active.\n')
  }

  // Leads
  if (context.leads && context.leads.length > 0) {
    lines.push('## LEADS ACTIFS (CRM)')
    for (const l of context.leads) {
      const action = l.next_action ? ` — next: ${l.next_action}` : ''
      lines.push(`- ${l.name} (${l.type}) — ${l.status} — ${l.assigned_to ?? 'non assigné'}${action} (id:${l.id})`)
    }
    lines.push('')
  } else {
    lines.push('## LEADS ACTIFS (CRM)\nAucun lead actif.\n')
  }

  // Contracts
  if (context.contracts && context.contracts.length > 0) {
    lines.push('## CONTRATS')
    for (const c of context.contracts) {
      const mrr = c.mrr_eur !== null ? `${c.mrr_eur.toLocaleString('fr-FR')} €/mois` : 'MRR inconnu'
      lines.push(`- ${c.organization_name} — ${c.status} — ${mrr} — ${c.license_count} licences (id:${c.id})`)
    }
    lines.push('')
  }

  // Calendar
  if (context.todayEvents && context.todayEvents.length > 0) {
    lines.push('## AGENDA DU JOUR')
    for (const e of context.todayEvents) {
      const start = new Date(e.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      lines.push(`- ${start} : ${e.title}`)
    }
    lines.push('')
  }

  // Feedback
  if (context.feedbackItems && context.feedbackItems.length > 0) {
    lines.push('## ROADMAP / FEEDBACK')
    for (const f of context.feedbackItems) {
      lines.push(`- [${f.status}] ${f.title} (${f.category}) — ${f.voteCount} vote(s) (id:${f.id})`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ── SSE helpers ────────────────────────────────────────────────────────────────

function sseText(text: string): string {
  return `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}\n\n`
}

function sseToolResult(type: string, payload: Record<string, unknown>): string {
  return `event: tool_result\ndata: ${JSON.stringify({ type, payload })}\n\n`
}

const SSE_DONE = 'data: [DONE]\n\n'

// ── Tool execution ─────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  token: string,
): Promise<{ sseEvent: string; toolResultContent: string }> {
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  if (name === 'create_task') {
    // Normalize assigned_to: accept string or array
    const assigneesRaw = Array.isArray(input.assigned_to) ? input.assigned_to as string[] : (input.assigned_to ? [String(input.assigned_to)] : [])
    const assignedTo = assigneesRaw[0] ?? null

    const { data, error } = await supabaseUser.from('tasks').insert({
      title: String(input.title),
      description: input.description ? String(input.description) : null,
      priority: (input.priority as string) ?? 'normale',
      assigned_to: assignedTo,
      assignees: assigneesRaw,
      due_date: input.due_date ? String(input.due_date) : null,
      status: (input.status as string) ?? 'todo',
      created_by: userId,
    }).select('id').single()

    if (error) throw new Error('Impossible de créer la tâche. Vérifie les paramètres et réessaie.')

    const payload = {
      id: data.id,
      title: String(input.title),
      assigned_to: assignedTo,
      assignees: assigneesRaw,
      priority: (input.priority as string) ?? 'normale',
      status: (input.status as string) ?? 'todo',
      due_date: input.due_date ? String(input.due_date) : null,
    }
    return {
      sseEvent: sseToolResult('create_task', payload),
      toolResultContent: `Tâche créée avec succès (id: ${data.id})`,
    }
  }

  if (name === 'update_lead_status') {
    const leadQuery = supabaseUser.from('leads').select('id, name, status, type')
    const { data: leads, error: findError } = input.lead_id
      ? await leadQuery.eq('id', String(input.lead_id)).limit(1)
      : await leadQuery.ilike('name', `%${String(input.lead_name)}%`).limit(1)

    if (findError || !leads?.[0]) {
      throw new Error(`Lead "${String(input.lead_name)}" introuvable dans le CRM.`)
    }

    const lead = leads[0] as { id: string; name: string; status: string; type: string }
    const { error: updateError } = await supabaseUser
      .from('leads')
      .update({ status: String(input.new_status) })
      .eq('id', lead.id)

    if (updateError) throw new Error('Impossible de mettre à jour le statut du lead.')

    const payload = {
      id: lead.id,
      name: lead.name,
      old_status: lead.status,
      new_status: String(input.new_status),
      type: lead.type,
    }
    return {
      sseEvent: sseToolResult('update_lead_status', payload),
      toolResultContent: `Statut du lead "${lead.name}" mis à jour : ${lead.status} → ${input.new_status}`,
    }
  }

  if (name === 'create_contract') {
    const { data, error } = await supabaseUser.from('contracts').insert({
      organization_name: String(input.organization_name),
      contact_name: input.contact_name ? String(input.contact_name) : null,
      mrr_eur: Number(input.mrr_eur),
      license_count: Number(input.license_count),
      organization_type: (input.organization_type as string) ?? 'ecole',
      status: (input.status as string) ?? 'prospect',
      created_by: userId,
    }).select('id').single()

    if (error) throw new Error('Impossible de créer le contrat. Vérifie les paramètres et réessaie.')

    const payload = {
      id: data.id,
      organization_name: String(input.organization_name),
      mrr_eur: Number(input.mrr_eur),
      license_count: Number(input.license_count),
      status: (input.status as string) ?? 'prospect',
    }
    return {
      sseEvent: sseToolResult('create_contract', payload),
      toolResultContent: `Contrat créé pour ${input.organization_name} (id: ${data.id})`,
    }
  }

  if (name === 'create_feedback_item') {
    const { data, error } = await supabaseUser.from('feedback_items').insert({
      title: String(input.title),
      description: input.description ? String(input.description) : null,
      category: (input.category as string) ?? 'fonctionnalite',
      status: 'backlog',
      created_by: userId,
    }).select('id').single()

    if (error) throw new Error('Impossible de créer l\'item de feedback.')

    const payload = {
      id: data.id,
      title: String(input.title),
      category: (input.category as string) ?? 'fonctionnalite',
      status: 'backlog',
    }
    return {
      sseEvent: sseToolResult('create_feedback_item', payload),
      toolResultContent: `Item de feedback créé : "${input.title}" (id: ${data.id}) — statut: backlog`,
    }
  }

  if (name === 'update_feedback_status') {
    const { data: items, error: findError } = await supabaseUser
      .from('feedback_items')
      .select('id, title, status')
      .ilike('title', `%${String(input.item_title)}%`)
      .limit(1)

    if (findError || !items?.[0]) {
      throw new Error(`Item "${String(input.item_title)}" introuvable dans la roadmap.`)
    }

    const item = items[0] as { id: string; title: string; status: string }
    const { error: updateError } = await supabaseUser
      .from('feedback_items')
      .update({ status: String(input.new_status) })
      .eq('id', item.id)

    if (updateError) throw new Error('Impossible de mettre à jour le statut de l\'item.')

    const payload = { id: item.id, title: item.title, old_status: item.status, new_status: String(input.new_status) }
    return {
      sseEvent: sseToolResult('update_feedback_status', payload),
      toolResultContent: `Item "${item.title}" : ${item.status} → ${input.new_status}`,
    }
  }

  if (name === 'list_feedback_items') {
    let query = supabaseUser
      .from('feedback_items')
      .select('id, title, status, category, feedback_votes(count)')
      .order('created_at', { ascending: false })

    if (input.status) {
      query = query.eq('status', String(input.status))
    }

    const { data: items, error } = await query
    if (error) throw new Error('Impossible de récupérer les items de feedback.')

    const list = (items ?? []).map((item: Record<string, unknown>) => {
      const voteCount = Array.isArray(item.feedback_votes)
        ? (item.feedback_votes[0] as { count: number } | undefined)?.count ?? 0
        : 0
      return `- [${item.status}] ${item.title} (${item.category}) — ${voteCount} vote(s) (id:${item.id})`
    })

    const resultText = list.length > 0
      ? `Roadmap (${list.length} items) :\n${list.join('\n')}`
      : 'Aucun item de feedback trouvé.'

    const payload = { count: list.length, items: list }
    return {
      sseEvent: sseToolResult('list_feedback_items', payload),
      toolResultContent: resultText,
    }
  }

  throw new Error("Une action inconnue a été demandée.")
}

// ── Handler ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult
  const { user } = authResult as { user: { id: string } }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return errorResponse('anthropic_not_configured', 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return errorResponse('unauthorized', 401)

  try {
    const body: RequestBody = await req.json()

    const rawMessage = typeof body.message === 'string' ? body.message.trim() : ''
    if (!rawMessage) return errorResponse('message_required', 400)

    const message = rawMessage.slice(0, 2000)
    const history = Array.isArray(body.history) ? body.history.slice(-20) : []
    const context = body.context

    const systemPrompt = buildSystemPrompt(context)
    const messages: ChatMessage[] = [...history, { role: 'user', content: message }]

    // ── Phase 1 : appel non-streaming avec tools ───────────────────────────────
    const phase1Resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        tools: TOOLS,
      }),
    })

    if (!phase1Resp.ok) {
      const errText = await phase1Resp.text()
      return errorResponse(`anthropic_error_${phase1Resp.status}: ${errText.slice(0, 200)}`, phase1Resp.status)
    }

    const phase1 = await phase1Resp.json() as {
      stop_reason: string
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>
    }

    const toolUseBlock = phase1.content.find((b) => b.type === 'tool_use')

    // ── Cas 1 : pas de tool use → émettre le texte directement ────────────────
    if (phase1.stop_reason !== 'tool_use' || !toolUseBlock) {
      const text = phase1.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(sseText(text)))
          controller.enqueue(encoder.encode(SSE_DONE))
          controller.close()
        },
      })
      return new Response(stream, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
      })
    }

    // ── Cas 2 : tool use → exécuter l'outil, émettre carte, streaming phase 2 ─
    const { name: toolName, id: toolId, input: toolInput } = toolUseBlock as {
      name: string; id: string; input: Record<string, unknown>
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const { sseEvent: toolCardSSE, toolResultContent } = await executeTool(
            toolName,
            toolInput,
            user.id,
            token,
          )

          controller.enqueue(encoder.encode(toolCardSSE))

          // Phase 2 : streaming avec tool result
          const messagesWithTool: ChatMessage[] = [
            ...messages,
            { role: 'assistant', content: phase1.content as AnthropicContentBlock[] },
            {
              role: 'user',
              content: [{ type: 'tool_result', tool_use_id: toolId, content: toolResultContent }] as AnthropicContentBlock[],
            },
          ]

          const phase2Resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 512,
              system: systemPrompt,
              messages: messagesWithTool,
              stream: true,
            }),
          })

          if (!phase2Resp.ok || !phase2Resp.body) {
            controller.enqueue(encoder.encode(sseText('Action effectuée.')))
            controller.enqueue(encoder.encode(SSE_DONE))
            controller.close()
            return
          }

          const reader = phase2Resp.body.getReader()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              controller.enqueue(value)
            }
          } finally {
            reader.releaseLock()
          }
          controller.close()
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erreur lors de l\'exécution de l\'action.'
          controller.enqueue(encoder.encode(sseText(msg)))
          controller.enqueue(encoder.encode(SSE_DONE))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return errorResponse(message, 502)
  }
})
