import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { SentryData } from '@/types/sentry'

const CACHE_TTL = 5 * 60 * 1000
let cache: { data: SentryData; ts: number } | null = null

export interface UseSentryResult {
  data: SentryData | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useSentry(): UseSentryResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<SentryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      setData(cache.data)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    supabase.functions
      .invoke<SentryData>('get-sentry')
      .then(({ data: d, error: e }) => {
        if (cancelled) return
        if (e || !d) {
          setError('Impossible de charger les données Sentry')
        } else {
          cache = { data: d, ts: Date.now() }
          setData(d)
        }
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  const refresh = useCallback(() => {
    cache = null
    setTick((t) => t + 1)
  }, [])

  return { data, isLoading, error, refresh }
}

export function invalidateSentryCache(): void {
  cache = null
}
