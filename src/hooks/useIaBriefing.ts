import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface IaBriefingInput {
  enabled: boolean
  mrr: number | null
  qontoBalance: number | null
  cancelingCount: number
  overdueTasks: number
  overdueLeads: number
}

export interface UseIaBriefingResult {
  briefing: string
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  regenerate: () => void
}

function getTodayKey(): string {
  const d = new Date()
  return `briefing_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useIaBriefing({
  enabled,
  mrr,
  qontoBalance,
  cancelingCount,
  overdueTasks,
  overdueLeads,
}: IaBriefingInput): UseIaBriefingResult {
  const cacheKey = useRef(getTodayKey())

  const [briefing, setBriefing] = useState<string>(() => {
    try { return localStorage.getItem(cacheKey.current) ?? '' } catch { return '' }
  })
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try { return !localStorage.getItem(cacheKey.current) } catch { return true }
  })
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)

  // True when we already have data (from cache or from a fetch this session)
  const hasFetched = useRef<boolean>(false)
  // Initialize hasFetched from cache synchronously during first render
  const didInit = useRef(false)
  if (!didInit.current) {
    didInit.current = true
    try {
      if (localStorage.getItem(cacheKey.current)) hasFetched.current = true
    } catch {}
  }

  const regenerate = useCallback(() => {
    try { localStorage.removeItem(cacheKey.current) } catch {}
    setBriefing('')
    setIsLoading(true)
    setError(null)
    hasFetched.current = false
    setGeneration((c) => c + 1)
  }, [])

  useEffect(() => {
    if (!enabled || hasFetched.current) return
    hasFetched.current = true

    const run = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token
        if (!accessToken) {
          setError('Session expirée')
          setIsLoading(false)
          return
        }

        const parts: string[] = []
        if (mrr !== null) parts.push(`MRR : ${mrr.toLocaleString('fr-FR')} €`)
        if (qontoBalance !== null)
          parts.push(`Solde Qonto : ${qontoBalance.toLocaleString('fr-FR')} €`)
        if (cancelingCount > 0) parts.push(`${cancelingCount} annulation(s) Stripe en cours`)
        if (overdueTasks > 0) parts.push(`${overdueTasks} tâche(s) en retard`)
        if (overdueLeads > 0) parts.push(`${overdueLeads} lead(s) à relancer`)

        const situation = parts.length > 0 ? parts.join(', ') : 'données non disponibles'
        const prompt = `Génère un briefing de situation MEMOVIA en 3-4 phrases courtes, directes et actionnables. Sans titre, sans formule de politesse, sans formatage markdown (pas d'astérisques ni de caractères spéciaux), texte brut uniquement. Données du jour : ${situation}. Identifie les priorités immédiates.`

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

        const response = await fetch(`${supabaseUrl}/functions/v1/copilot-chat`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: prompt,
            history: [],
            context: {
              mrr: mrr ?? undefined,
              qontoBalance: qontoBalance ?? undefined,
            },
          }),
        })

        if (!response.ok || !response.body) {
          setError('Impossible de générer le briefing')
          setIsLoading(false)
          return
        }

        setIsLoading(false)
        setIsStreaming(true)

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') break
            try {
              const parsed = JSON.parse(raw)
              if (
                parsed.type === 'content_block_delta' &&
                parsed.delta?.type === 'text_delta'
              ) {
                accumulated += parsed.delta.text
                setBriefing((prev) => prev + parsed.delta.text)
              }
            } catch {
              // skip malformed SSE chunks
            }
          }
        }

        if (accumulated) {
          try { localStorage.setItem(cacheKey.current, accumulated) } catch {}
        }
      } catch (err) {
        if (!(err instanceof Error && err.name === 'AbortError')) {
          setError('Erreur lors du briefing')
        }
      } finally {
        setIsLoading(false)
        setIsStreaming(false)
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, generation])

  return { briefing, isLoading, isStreaming, error, regenerate }
}
