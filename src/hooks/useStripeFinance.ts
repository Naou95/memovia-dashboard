import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { createCache } from '@/lib/cache'
import type { StripeFinanceData } from '@/types/stripe'

const stripeCache = createCache<StripeFinanceData>('stripe', 5 * 60 * 1000)

export interface UseStripeFinanceResult {
  data: StripeFinanceData | null
  isLoading: boolean
  error: string | null
  lastFetchedAt: number | null
}

export function useStripeFinance(): UseStripeFinanceResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<StripeFinanceData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const cached = stripeCache.get()
    if (cached) {
      setData(cached.data)
      setLastFetchedAt(cached.ts)
      setIsLoading(false)
    }

    supabase.functions
      .invoke<StripeFinanceData>('get-stripe-finance')
      .then(({ data: d, error: e }) => {
        if (cancelled) return
        if (e || !d) {
          if (!cached) {
            setError('Impossible de charger les données Stripe')
            setIsLoading(false)
          }
        } else {
          stripeCache.set(d)
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

export function invalidateStripeFinanceCache(): void {
  stripeCache.clear()
}
