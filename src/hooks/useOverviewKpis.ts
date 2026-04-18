import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { StripeMetrics, OverviewKpis } from '@/types/overview'

export function useOverviewKpis(): OverviewKpis {
  const [isLoading, setIsLoading] = useState(true)
  const [stripe, setStripe] = useState<StripeMetrics | null>(null)
  const [stripeError, setStripeError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    supabase.functions
      .invoke<StripeMetrics>('get-stripe-metrics')
      .then(({ data, error }) => {
        if (cancelled) return

        if (error || !data) {
          setStripeError('Impossible de charger les métriques Stripe')
        } else {
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
