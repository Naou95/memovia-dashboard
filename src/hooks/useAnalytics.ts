import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { PostHogData } from '@/types/analytics'

const CACHE_TTL = 10 * 60 * 1000
let cache: { data: PostHogData; ts: number } | null = null

export interface UseAnalyticsResult {
  data: PostHogData | null
  isLoading: boolean
  error: string | null
}

export function useAnalytics(): UseAnalyticsResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<PostHogData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      setData(cache.data)
      setIsLoading(false)
      return
    }

    supabase.functions
      .invoke<PostHogData>('get-posthog')
      .then(({ data: d, error: e }) => {
        if (cancelled) return
        if (e || !d) {
          setError('Impossible de charger les données PostHog')
        } else {
          cache = { data: d, ts: Date.now() }
          setData(d)
        }
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { data, isLoading, error }
}

export function invalidateAnalyticsCache(): void {
  cache = null
}
