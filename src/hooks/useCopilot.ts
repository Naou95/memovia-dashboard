import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface TaskSummary {
  id: string
  title: string
  status: 'todo' | 'en_cours'
  priority: 'haute' | 'normale' | 'basse'
  assigned_to: string | null
  due_date: string | null
}

interface LeadSummary {
  id: string
  name: string
  type: string
  status: string
  assigned_to: string | null
  next_action: string | null
}

interface ContractSummary {
  id: string
  organization_name: string
  status: string
  mrr_eur: number | null
  license_count: number
}

interface CalendarEventSummary {
  title: string
  start: string
  end: string
}

interface DashboardContext {
  mrr?: number
  arr?: number
  activeSubscriptions?: number
  qontoBalance?: number
  tasks?: TaskSummary[]
  leads?: LeadSummary[]
  contracts?: ContractSummary[]
  todayEvents?: CalendarEventSummary[]
}

export interface TaskCardData {
  id: string
  title: string
  assigned_to: string
  priority: 'haute' | 'normale' | 'basse'
  status: 'todo' | 'en_cours'
  due_date: string | null
}

export interface LeadCardData {
  id: string
  name: string
  old_status: string
  new_status: string
  type: string
}

export interface ContractCardData {
  id: string
  organization_name: string
  mrr_eur: number | null
  license_count: number
  status: string
}

export type ToolResultCard =
  | { kind: 'task'; data: TaskCardData }
  | { kind: 'lead'; data: LeadCardData }
  | { kind: 'contract'; data: ContractCardData }

export interface ToolResultMessage {
  id: string
  role: 'assistant'
  type: 'tool_result'
  tool: ToolResultCard
}

export type CopilotMessage = ChatMessage | ToolResultMessage

export interface UseCopilotReturn {
  messages: CopilotMessage[]
  isStreaming: boolean
  contextReady: boolean
  contextLoading: boolean
  sendMessage: (text: string) => Promise<void>
  clearHistory: () => void
}

function parseToolResultCard(raw: { type: string; payload: Record<string, unknown> }): ToolResultCard | null {
  if (raw.type === 'create_task') {
    const p = raw.payload
    return {
      kind: 'task',
      data: {
        id: String(p.id ?? ''),
        title: String(p.title ?? ''),
        assigned_to: String(p.assigned_to ?? ''),
        priority: (p.priority as TaskCardData['priority']) ?? 'normale',
        status: (p.status as TaskCardData['status']) ?? 'todo',
        due_date: p.due_date ? String(p.due_date) : null,
      },
    }
  }
  if (raw.type === 'update_lead_status') {
    const p = raw.payload
    return {
      kind: 'lead',
      data: {
        id: String(p.id ?? ''),
        name: String(p.name ?? ''),
        old_status: String(p.old_status ?? ''),
        new_status: String(p.new_status ?? ''),
        type: String(p.type ?? ''),
      },
    }
  }
  if (raw.type === 'create_contract') {
    const p = raw.payload
    return {
      kind: 'contract',
      data: {
        id: String(p.id ?? ''),
        organization_name: String(p.organization_name ?? ''),
        mrr_eur: p.mrr_eur !== undefined ? Number(p.mrr_eur) : null,
        license_count: Number(p.license_count ?? 0),
        status: String(p.status ?? ''),
      },
    }
  }
  return null
}

export function useCopilot(open: boolean): UseCopilotReturn {
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [contextReady, setContextReady] = useState(false)
  const [contextLoading, setContextLoading] = useState(false)
  const contextRef = useRef<DashboardContext>({})
  const contextFetched = useRef(false)
  const messagesRef = useRef<CopilotMessage[]>([])
  const abortRef = useRef<AbortController | null>(null)
  // Resolves when context fetch completes (success or failure)
  const contextDoneRef = useRef<Promise<void>>(Promise.resolve())
  const contextDoneResolveRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!open || contextFetched.current) return
    contextFetched.current = true

    // Set up a promise that resolves when context fetch is done
    contextDoneRef.current = new Promise<void>((resolve) => {
      contextDoneResolveRef.current = resolve
    })

    setContextLoading(true)

    const fetchContext = async () => {
      try {
        const today = new Date()
        const todayStr = today.toISOString().slice(0, 10) // YYYY-MM-DD

        const [
          stripeResult,
          qontoResult,
          tasksResult,
          leadsResult,
          contractsResult,
          calendarResult,
        ] = await Promise.allSettled([
          supabase.functions.invoke('get-stripe-finance'),
          supabase.functions.invoke('get-qonto-balance'),
          supabase
            .from('tasks')
            .select('id, title, status, priority, assigned_to, due_date')
            .neq('status', 'done')
            .order('due_date', { ascending: true, nullsFirst: false }),
          supabase
            .from('leads')
            .select('id, name, type, status, assigned_to, next_action')
            .not('status', 'in', '("gagne","perdu")')
            .order('created_at', { ascending: false }),
          supabase
            .from('contracts')
            .select('id, organization_name, status, mrr_eur, license_count')
            .in('status', ['actif', 'signe', 'negotiation', 'prospect'])
            .order('created_at', { ascending: false }),
          supabase.functions.invoke('get-calendar-events'),
        ])

        const ctx: DashboardContext = {}

        if (stripeResult.status === 'fulfilled' && stripeResult.value.data) {
          const d = stripeResult.value.data as { mrr?: number; arr?: number; activeSubscriptions?: number }
          if (d.mrr !== undefined) ctx.mrr = d.mrr
          if (d.arr !== undefined) ctx.arr = d.arr
          if (ctx.mrr !== undefined && ctx.arr === undefined) {
            ctx.arr = Math.round(ctx.mrr * 12 * 100) / 100
          }
          if (d.activeSubscriptions !== undefined) ctx.activeSubscriptions = d.activeSubscriptions
        }

        if (qontoResult.status === 'fulfilled' && qontoResult.value.data) {
          const d = qontoResult.value.data as { balance?: number }
          if (d.balance !== undefined) ctx.qontoBalance = d.balance
        }

        if (tasksResult.status === 'fulfilled' && tasksResult.value.data) {
          ctx.tasks = (tasksResult.value.data as TaskSummary[]).slice(0, 30)
        }

        if (leadsResult.status === 'fulfilled' && leadsResult.value.data) {
          ctx.leads = (leadsResult.value.data as LeadSummary[]).slice(0, 30)
        }

        if (contractsResult.status === 'fulfilled' && contractsResult.value.data) {
          ctx.contracts = (contractsResult.value.data as ContractSummary[]).slice(0, 20)
        }

        if (calendarResult.status === 'fulfilled' && calendarResult.value.data) {
          const events = calendarResult.value.data as { events?: CalendarEventSummary[] }
          if (Array.isArray(events?.events)) {
            ctx.todayEvents = events.events
              .filter((e) => e.start.slice(0, 10) === todayStr)
              .map((e) => ({ title: e.title, start: e.start, end: e.end }))
              .slice(0, 10)
          }
        }

        contextRef.current = ctx
      } finally {
        setContextReady(true)
        setContextLoading(false)
        contextDoneResolveRef.current?.()
      }
    }

    fetchContext()
  }, [open])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
      }
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        streaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)

      abortRef.current?.abort()
      const abort = new AbortController()
      abortRef.current = abort

      try {
        // Wait for context to finish loading (up to 5s) before sending
        await Promise.race([
          contextDoneRef.current,
          new Promise<void>((r) => setTimeout(r, 5000)),
        ])

        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token

        if (!accessToken) {
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                content: 'Session expirée. Reconnecte-toi.',
                streaming: false,
              }
            }
            return updated
          })
          return
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

        const response = await fetch(`${supabaseUrl}/functions/v1/copilot-chat`, {
          method: 'POST',
          signal: abort.signal,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: text,
            history: messagesRef.current
              .filter((m): m is ChatMessage => !('type' in m && m.type === 'tool_result'))
              .slice(-10)
              .map((m) => ({ role: m.role, content: m.content })),
            context: contextRef.current,
          }),
        })

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let currentEvent = 'message'

        while (true) {
          const { done, value } = await reader.read()
          if (done || abort.signal.aborted) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim()
              continue
            }
            if (line === '') {
              currentEvent = 'message'
              continue
            }
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') break

            if (currentEvent === 'tool_result') {
              try {
                const toolResult = JSON.parse(data) as { type: string; payload: Record<string, unknown> }
                const card = parseToolResultCard(toolResult)
                if (card) {
                  setMessages((prev) => {
                    const withoutStreaming = prev.slice(0, -1)
                    const toolMsg: ToolResultMessage = {
                      id: crypto.randomUUID(),
                      role: 'assistant',
                      type: 'tool_result',
                      tool: card,
                    }
                    const newStreaming: ChatMessage = {
                      id: crypto.randomUUID(),
                      role: 'assistant',
                      content: '',
                      streaming: true,
                    }
                    return [...withoutStreaming, toolMsg, newStreaming]
                  })
                }
              } catch { /* skip malformed */ }
              currentEvent = 'message'
              continue
            }

            try {
              const parsed = JSON.parse(data)
              if (
                parsed.type === 'content_block_delta' &&
                parsed.delta?.type === 'text_delta'
              ) {
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last && 'content' in last && last.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: (last as ChatMessage).content + parsed.delta.text,
                    }
                  }
                  return updated
                })
              }
            } catch { /* malformed SSE chunk — skip */ }
          }
        }

        if (!abort.signal.aborted) {
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { ...last, streaming: false }
            }
            return updated
          })
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              content: 'Une erreur est survenue. Réessaie.',
              streaming: false,
            }
          }
          return updated
        })
      } finally {
        setIsStreaming(false)
      }
    },
    [isStreaming],
  )

  const clearHistory = useCallback(() => {
    setMessages([])
  }, [])

  return { messages, isStreaming, contextReady, contextLoading, sendMessage, clearHistory }
}
