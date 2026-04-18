import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

// ── Types ──────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface DashboardContext {
  mrr?: number
  arr?: number
  qontoBalance?: number
  tasksCount?: { todo: number; en_cours: number; done: number }
  leadsCount?: number
  contractsCount?: { active: number; total: number }
}

interface RequestBody {
  message: string
  history: ChatMessage[]
  context?: DashboardContext
}

// ── System prompt ──────────────────────────────────────────────────────────────
function buildSystemPrompt(context?: DashboardContext): string {
  let contextBlock: string

  if (context && Object.keys(context).length > 0) {
    const lines: string[] = []

    if (context.mrr !== undefined) {
      lines.push(`- MRR : ${context.mrr.toLocaleString('fr-FR')} €`)
    }
    if (context.arr !== undefined) {
      lines.push(`- ARR : ${context.arr.toLocaleString('fr-FR')} €`)
    }
    if (context.qontoBalance !== undefined) {
      lines.push(`- Solde Qonto : ${context.qontoBalance.toLocaleString('fr-FR')} €`)
    }
    if (context.tasksCount !== undefined) {
      const { todo, en_cours, done } = context.tasksCount
      lines.push(`- Tâches : ${todo} à faire, ${en_cours} en cours, ${done} terminées`)
    }
    if (context.leadsCount !== undefined) {
      lines.push(`- Leads CRM : ${context.leadsCount}`)
    }
    if (context.contractsCount !== undefined) {
      lines.push(
        `- Contrats : ${context.contractsCount.active} actifs sur ${context.contractsCount.total} au total`,
      )
    }

    contextBlock = lines.length > 0
      ? lines.join('\n')
      : 'données non disponibles'
  } else {
    contextBlock = 'données non disponibles'
  }

  return `Tu es le Copilote IA interne de MEMOVIA, une EdTech SaaS française qui propose des outils pédagogiques IA pour les établissements scolaires.
Tu as accès aux données du dashboard interne de MEMOVIA. Réponds en français, de façon concise et directe.
Tu es l'assistant de confiance de l'équipe fondatrice (Naoufel et Emir).

Données du dashboard disponibles :
${contextBlock}

Réponds toujours en français. Sois précis, actionnable et professionnel.
Si tu ne sais pas quelque chose, dis-le clairement.`
}

// ── Handler ────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return errorResponse('anthropic_not_configured', 500)

  try {
    const body: RequestBody = await req.json()

    // Input validation
    const rawMessage: string = typeof body.message === 'string' ? body.message.trim() : ''
    if (!rawMessage) return errorResponse('message_required', 400)

    const message = rawMessage.slice(0, 2000)

    const rawHistory: ChatMessage[] = Array.isArray(body.history) ? body.history : []
    const history = rawHistory.slice(-20)

    const context: DashboardContext | undefined = body.context

    // Build messages array
    const messages: ChatMessage[] = [
      ...history,
      { role: 'user', content: message },
    ]

    // Call Anthropic API with streaming
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: buildSystemPrompt(context),
        messages,
        stream: true,
      }),
    })

    if (!anthropicResponse.ok) {
      const body = await anthropicResponse.text()
      return errorResponse(
        `anthropic_error_${anthropicResponse.status}: ${body.slice(0, 200)}`,
        anthropicResponse.status,
      )
    }

    // Pipe SSE stream directly to client
    return new Response(anthropicResponse.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return errorResponse(message, 502)
  }
})
