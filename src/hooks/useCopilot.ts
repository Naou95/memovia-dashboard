import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface DashboardContext {
  mrr?: number
  arr?: number
  qontoBalance?: number
  tasksCount?: { todo: number; en_cours: number; done: number }
  leadsCount?: number
  contractsCount?: { active: number; total: number }
}

export interface UseCopilotReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  contextReady: boolean
  contextLoading: boolean
  sendMessage: (text: string) => Promise<void>
  clearHistory: () => void
}

export function useCopilot(open: boolean): UseCopilotReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [contextReady, setContextReady] = useState(false)
  const [contextLoading, setContextLoading] = useState(false)
  const contextRef = useRef<DashboardContext>({})
  const contextFetched = useRef(false)
  const messagesRef = useRef<ChatMessage[]>([])
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
        const [stripeResult, qontoResult, tasksResult, contractsResult, leadsResult] =
          await Promise.allSettled([
            supabase.functions.invoke('get-stripe-finance'),
            supabase.functions.invoke('get-qonto-balance'),
            supabase.from('tasks').select('status'),
            supabase.from('contracts').select('status'),
            supabase.from('leads').select('id', { count: 'exact', head: true }),
          ])

        const ctx: DashboardContext = {}

        if (stripeResult.status === 'fulfilled' && stripeResult.value.data) {
          const d = stripeResult.value.data as { mrr?: number; arr?: number }
          if (d.mrr !== undefined) ctx.mrr = d.mrr
          if (d.arr !== undefined) ctx.arr = d.arr
          // arr fallback in case get-stripe-finance doesn't include it
          if (ctx.mrr !== undefined && ctx.arr === undefined) {
            ctx.arr = Math.round(ctx.mrr * 12 * 100) / 100
          }
        }

        if (qontoResult.status === 'fulfilled' && qontoResult.value.data) {
          const d = qontoResult.value.data as { balance?: number }
          if (d.balance !== undefined) ctx.qontoBalance = d.balance
        }

        if (tasksResult.status === 'fulfilled' && tasksResult.value.data) {
          const rows = tasksResult.value.data as { status: string }[]
          ctx.tasksCount = {
            todo: rows.filter((r) => r.status === 'todo').length,
            en_cours: rows.filter((r) => r.status === 'en_cours').length,
            done: rows.filter((r) => r.status === 'done').length,
          }
        }

        if (contractsResult.status === 'fulfilled' && contractsResult.value.data) {
          const rows = contractsResult.value.data as { status: string }[]
          ctx.contractsCount = {
            active: rows.filter((r) => r.status === 'active').length,
            total: rows.length,
          }
        }

        if (leadsResult.status === 'fulfilled') {
          // supabase returns count as top-level property on the response (not inside .data)
          const res = leadsResult.value as { count: number | null }
          if (res.count !== null && res.count !== undefined) ctx.leadsCount = res.count
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

        while (true) {
          const { done, value } = await reader.read()
          if (done || abort.signal.aborted) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (
                parsed.type === 'content_block_delta' &&
                parsed.delta?.type === 'text_delta'
              ) {
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + parsed.delta.text,
                    }
                  }
                  return updated
                })
              }
            } catch {
              // malformed SSE chunk — skip
            }
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
