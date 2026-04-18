import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { QontoFinanceData } from '@/types/qonto'

// Cache module-level : 5 minutes TTL
const CACHE_TTL = 5 * 60 * 1000
let cache: { data: QontoFinanceData; ts: number } | null = null

export interface UseQontoFinanceResult {
  data: QontoFinanceData | null
  isLoading: boolean
  error: string | null
}

export function useQontoFinance(): UseQontoFinanceResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<QontoFinanceData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      setData(cache.data)
      setIsLoading(false)
      return
    }

    supabase.functions
      .invoke<QontoFinanceData>('get-qonto-finance')
      .then(({ data: d, error: e }) => {
        if (cancelled) return

        if (e || !d) {
          setError('Impossible de charger les données Qonto')
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

export function invalidateQontoFinanceCache(): void {
  cache = null
}
