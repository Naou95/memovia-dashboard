import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { StripeFinanceData } from '@/types/stripe'

// Cache module-level : 5 minutes TTL
// Évite de refetch à chaque mount (navigation entre onglets)
const CACHE_TTL = 5 * 60 * 1000
let cache: { data: StripeFinanceData; ts: number } | null = null

export interface UseStripeFinanceResult {
  data: StripeFinanceData | null
  isLoading: boolean
  error: string | null
}

export function useStripeFinance(): UseStripeFinanceResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<StripeFinanceData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // Cache hit : éviter le refetch si les données sont récentes
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      setData(cache.data)
      setIsLoading(false)
      return
    }

    supabase.functions
      .invoke<StripeFinanceData>('get-stripe-finance')
      .then(({ data: d, error: e }) => {
        if (cancelled) return

        if (e || !d) {
          setError('Impossible de charger les données Stripe')
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

/** Invalide le cache (utile après un refresh manuel) */
export function invalidateStripeFinanceCache(): void {
  cache = null
}
