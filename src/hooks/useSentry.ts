import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { createCache } from '@/lib/cache'
import type { SentryData } from '@/types/sentry'

const sentryCache = createCache<SentryData>('sentry', 10 * 60 * 1000)

export interface UseSentryResult {
  data: SentryData | null
  isLoading: boolean
  error: string | null
  refresh: () => void
  lastFetchedAt: number | null
}

export function useSentry(): UseSentryResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<SentryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    const cached = sentryCache.get()
    if (cached) {
      setData(cached.data)
      setLastFetchedAt(cached.ts)
      setIsLoading(false)
    } else {
      setIsLoading(true)
      setError(null)
    }

    supabase.functions
      .invoke<SentryData>('get-sentry')
      .then(({ data: d, error: e }) => {
        if (cancelled) return
        if (e || !d) {
          if (!cached) {
            setError('Impossible de charger les données Sentry')
            setIsLoading(false)
          }
        } else {
          sentryCache.set(d)
          setData(d)
          setLastFetchedAt(Date.now())
          if (!cached) setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  const refresh = useCallback(() => {
    sentryCache.clear()
    setTick((t) => t + 1)
  }, [])

  return { data, isLoading, error, refresh, lastFetchedAt }
}

export function invalidateSentryCache(): void {
  sentryCache.clear()
}
