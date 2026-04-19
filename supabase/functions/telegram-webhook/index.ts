import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendTelegramMessage } from '../_shared/telegram.ts'

// verify_jwt: false — configured in supabase/config.toml
// Telegram sends no JWT; security is enforced by chat_id check

interface TelegramMessage {
  message_id: number
  from?: { id: number; first_name: string; username?: string }
  chat: { id: number; type: string }
  text?: string
  date: number
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

interface AnthropicContent {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

// ── Tool definitions (identical to copilot-chat) ───────────────────────────────

const TOOLS = [
  {
    name: 'create_task',
    description: 'Crée une tâche dans le système de gestion des tâches MEMOVIA.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titre de la tâche' },
        description: { type: 'string', description: 'Description optionnelle' },
        priority: { type: 'string', enum: ['haute', 'normale', 'basse'], description: 'Priorité. Défaut: normale' },
        assigned_to: { type: 'string', enum: ['naoufel', 'emir'], description: 'Personne assignée' },
        due_date: { type: 'string', description: 'Date d\'échéance YYYY-MM-DD (optionnel)' },
        status: { type: 'string', enum: ['todo', 'en_cours'], description: 'Statut initial. Défaut: todo' },
      },
      required: ['title', 'assigned_to'],
    },
  },
  {
    name: 'update_lead_status',
    description: 'Change le statut d\'un lead dans le CRM MEMOVIA.',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: 'ID exact du lead (prioritaire sur lead_name)' },
        lead_name: { type: 'string', description: 'Nom de l\'organisation ou du lead (recherche partielle)' },
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
    description: 'Crée un nouveau contrat dans le système MEMOVIA.',
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
]

// ── System prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  return [
    `Tu es le Copilote IA interne de MEMOVIA, une EdTech SaaS française (outils pédagogiques IA pour établissements scolaires).`,
    `Tu réponds à Naoufel via Telegram. Date du jour : ${today}.`,
    `Réponds en français, de façon concise et directe (idéalement sous 3 paragraphes pour Telegram).`,
    `Tu peux exécuter des actions : créer une tâche, changer le statut d'un lead, créer un contrat.`,
    `Utilise les outils dès qu'une action est clairement demandée. Ne demande pas de confirmation sauf si les paramètres sont ambigus.`,
    `Formate tes réponses avec du Markdown Telegram (* pour gras, _ pour italique, \` pour code).`,
  ].join('\n')
}

// ── Tool execution (uses service role — no user JWT) ───────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  if (name === 'create_task') {
    const { data, error } = await supabase.from('tasks').insert({
      title: String(input.title),
      description: input.description ? String(input.description) : null,
      priority: (input.priority as string) ?? 'normale',
      assigned_to: String(input.assigned_to),
      due_date: input.due_date ? String(input.due_date) : null,
      status: (input.status as string) ?? 'todo',
    }).select('id').single()

    if (error) throw new Error('Impossible de créer la tâche.')
    return `Tâche créée avec succès (id: ${data.id})`
  }

  if (name === 'update_lead_status') {
    const query = supabase.from('leads').select('id, name, status, type')
    const { data: leads, error: findError } = input.lead_id
      ? await query.eq('id', String(input.lead_id)).limit(1)
      : await query.ilike('name', `%${String(input.lead_name)}%`).limit(1)

    if (findError || !leads?.[0]) {
      throw new Error(`Lead "${String(input.lead_name ?? input.lead_id)}" introuvable dans le CRM.`)
    }

    const lead = leads[0] as { id: string; name: string; status: string; type: string }
    const { error: updateError } = await supabase
      .from('leads')
      .update({ status: String(input.new_status) })
      .eq('id', lead.id)

    if (updateError) throw new Error('Impossible de mettre à jour le statut du lead.')
    return `Statut du lead "${lead.name}" mis à jour : ${lead.status} → ${input.new_status}`
  }

  if (name === 'create_contract') {
    const { data, error } = await supabase.from('contracts').insert({
      organization_name: String(input.organization_name),
      contact_name: input.contact_name ? String(input.contact_name) : null,
      mrr_eur: Number(input.mrr_eur),
      license_count: Number(input.license_count),
      organization_type: (input.organization_type as string) ?? 'ecole',
      status: (input.status as string) ?? 'prospect',
    }).select('id').single()

    if (error) throw new Error('Impossible de créer le contrat.')
    return `Contrat créé pour ${input.organization_name} (id: ${data.id})`
  }

  throw new Error('Action inconnue.')
}

// ── Handler ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  const allowedChatId = Deno.env.get('TELEGRAM_CHAT_ID_NAOUFEL')
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')

  // Always return 200 to Telegram to prevent retries, even on config errors
  if (!allowedChatId || !apiKey) {
    console.error('telegram-webhook: missing TELEGRAM_CHAT_ID_NAOUFEL or ANTHROPIC_API_KEY')
    return new Response('ok', { status: 200 })
  }

  let update: TelegramUpdate
  try {
    update = await req.json() as TelegramUpdate
  } catch {
    return new Response('ok', { status: 200 })
  }

  const msg = update.message
  if (!msg?.text || String(msg.chat.id) !== allowedChatId) {
    return new Response('ok', { status: 200 })
  }

  const chatId = String(msg.chat.id)
  const userText = msg.text.trim()

  if (userText === '/start') {
    await sendTelegramMessage(chatId,
      `👋 *Copilote MEMOVIA actif*\n\nEnvoie-moi tes questions ou demandes. Je peux :\n• Créer des tâches\n• Mettre à jour des leads CRM\n• Créer des contrats\n• Répondre à tes questions sur MEMOVIA`
    )
    return new Response('ok', { status: 200 })
  }

  try {
    const systemPrompt = buildSystemPrompt()

    // Phase 1 : appel Anthropic avec tools
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
        messages: [{ role: 'user', content: userText }],
        tools: TOOLS,
      }),
    })

    if (!phase1Resp.ok) {
      await sendTelegramMessage(chatId, '❌ Erreur lors du traitement de ta demande. Réessaie dans un instant.')
      return new Response('ok', { status: 200 })
    }

    const phase1 = await phase1Resp.json() as {
      stop_reason: string
      content: AnthropicContent[]
    }

    const toolUseBlock = phase1.content.find((b) => b.type === 'tool_use')

    // Pas de tool use → réponse texte directe
    if (phase1.stop_reason !== 'tool_use' || !toolUseBlock) {
      const text = phase1.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')
      await sendTelegramMessage(chatId, text || 'Je n\'ai pas pu générer une réponse.')
      return new Response('ok', { status: 200 })
    }

    // Tool use → exécuter l'outil
    const { name: toolName, id: toolId, input: toolInput } = toolUseBlock as {
      name: string; id: string; input: Record<string, unknown>
    }

    let toolResult: string
    try {
      toolResult = await executeTool(toolName, toolInput)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Erreur lors de l\'exécution.'
      await sendTelegramMessage(chatId, `❌ ${errMsg}`)
      return new Response('ok', { status: 200 })
    }

    // Phase 2 : confirmation de l'action
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
        messages: [
          { role: 'user', content: userText },
          { role: 'assistant', content: phase1.content },
          {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: toolId, content: toolResult }],
          },
        ],
      }),
    })

    let responseText = `✅ ${toolResult}`
    if (phase2Resp.ok) {
      const phase2 = await phase2Resp.json() as { content: AnthropicContent[] }
      const text = phase2.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')
      if (text) responseText = text
    }

    await sendTelegramMessage(chatId, responseText)
    return new Response('ok', { status: 200 })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'unknown_error'
    console.error('telegram-webhook error:', errMsg)
    try {
      await sendTelegramMessage(chatId, `❌ Erreur interne. Réessaie dans un instant.`)
    } catch { /* ignore */ }
    return new Response('ok', { status: 200 })
  }
})
