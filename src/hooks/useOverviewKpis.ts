import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { createCache } from '@/lib/cache'
import type { StripeMetrics, OverviewKpis } from '@/types/overview'

const overviewCache = createCache<StripeMetrics>('overview-kpis', 5 * 60 * 1000)

export function useOverviewKpis(): OverviewKpis & { lastFetchedAt: number | null } {
  const [isLoading, setIsLoading] = useState(true)
  const [stripe, setStripe] = useState<StripeMetrics | null>(null)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const cached = overviewCache.get()
    if (cached) {
      setStripe(cached.data)
      setLastFetchedAt(cached.ts)
      setIsLoading(false)
    }

    supabase.functions
      .invoke<StripeMetrics>('get-stripe-metrics')
      .then(({ data, error }) => {
        if (cancelled) return

        if (error || !data) {
          if (!cached) {
            setStripeError('Impossible de charger les métriques Stripe')
            setIsLoading(false)
          }
        } else {
          overviewCache.set(data)
          setStripe(data)
          setLastFetchedAt(Date.now())
          if (!cached) setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { stripe, qonto: null, stripeError, qontoError: null, isLoading, lastFetchedAt }
}

export function invalidateOverviewKpisCache(): void {
  overviewCache.clear()
}
