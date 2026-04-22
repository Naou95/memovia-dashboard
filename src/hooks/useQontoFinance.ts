import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { createCache } from '@/lib/cache'
import type { QontoFinanceData } from '@/types/qonto'

const qontoCache = createCache<QontoFinanceData>('qonto', 2 * 60 * 1000)

export interface UseQontoFinanceResult {
  data: QontoFinanceData | null
  isLoading: boolean
  error: string | null
  lastFetchedAt: number | null
}

export function useQontoFinance(): UseQontoFinanceResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<QontoFinanceData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const cached = qontoCache.get()
    if (cached) {
      setData(cached.data)
      setLastFetchedAt(cached.ts)
      setIsLoading(false)
    }

    supabase.functions
      .invoke<QontoFinanceData>('get-qonto-finance')
      .then(({ data: d, error: e }) => {
        if (cancelled) return
        if (e || !d) {
          if (!cached) {
            setError('Impossible de charger les données Qonto')
            setIsLoading(false)
          }
        } else {
          qontoCache.set(d)
          setData(d)
          setLastFetchedAt(Date.now())
          if (!cached) setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { data, isLoading, error, lastFetchedAt }
}

export function invalidateQontoFinanceCache(): void {
  qontoCache.clear()
}
