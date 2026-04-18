import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { ApiCostsData } from '@/types/api-costs'

const CACHE_TTL = 10 * 60 * 1000
let cache: { data: ApiCostsData; ts: number } | null = null

export interface UseApiCostsResult {
  data: ApiCostsData | null
  isLoading: boolean
  error: string | null
}

export function useApiCosts(): UseApiCostsResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<ApiCostsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      setData(cache.data)
      setIsLoading(false)
      return
    }

    supabase.functions
      .invoke<ApiCostsData>('get-api-costs')
      .then(({ data: d, error: e }) => {
        if (cancelled) return
        if (e || !d) {
          setError('Impossible de charger les coûts API')
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

export function invalidateApiCostsCache(): void {
  cache = null
}
