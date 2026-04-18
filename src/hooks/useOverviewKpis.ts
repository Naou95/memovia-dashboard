import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { StripeMetrics, QontoBalance, OverviewKpis } from '@/types/overview'

export function useOverviewKpis(): OverviewKpis {
  const [isLoading, setIsLoading] = useState(true)
  const [stripe, setStripe] = useState<StripeMetrics | null>(null)
  const [qonto, setQonto] = useState<QontoBalance | null>(null)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [qontoError, setQontoError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.allSettled([
      supabase.functions.invoke<StripeMetrics>('get-stripe-metrics'),
      supabase.functions.invoke<QontoBalance>('get-qonto-balance'),
    ]).then(([stripeResult, qontoResult]) => {
      if (cancelled) return

      if (stripeResult.status === 'fulfilled' && !stripeResult.value.error) {
        setStripe(stripeResult.value.data)
      } else {
        setStripeError('Impossible de charger les métriques Stripe')
      }

      if (qontoResult.status === 'fulfilled' && !qontoResult.value.error) {
        setQonto(qontoResult.value.data)
      } else {
        setQontoError('Impossible de charger le solde Qonto')
      }

      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return { stripe, qonto, stripeError, qontoError, isLoading }
}
