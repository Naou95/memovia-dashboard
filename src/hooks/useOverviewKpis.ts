import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { StripeMetrics, OverviewKpis } from '@/types/overview'

const CACHE_TTL = 5 * 60 * 1000
let cache: { data: StripeMetrics; ts: number } | null = null

export function useOverviewKpis(): OverviewKpis {
  const [isLoading, setIsLoading] = useState(true)
  const [stripe, setStripe] = useState<StripeMetrics | null>(null)
  const [stripeError, setStripeError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      setStripe(cache.data)
      setIsLoading(false)
      return
    }

    supabase.functions
      .invoke<StripeMetrics>('get-stripe-metrics')
      .then(({ data, error }) => {
        if (cancelled) return

        if (error || !data) {
          setStripeError('Impossible de charger les métriques Stripe')
        } else {
          cache = { data, ts: Date.now() }
          setStripe(data)
        }

        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // qonto balance is now sourced from useQontoFinance on the Overview page
  // to avoid a redundant network call. Kept here as null for type compatibility
  // with existing OverviewKpis shape; consumers should prefer useQontoFinance.
  return { stripe, qonto: null, stripeError, qontoError: null, isLoading }
}

export function invalidateOverviewKpisCache(): void {
  cache = null
}
