import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Mock Supabase avant l'import du hook
vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

// On importe APRÈS le mock
import { useStripeFinance, invalidateStripeFinanceCache } from '@/hooks/useStripeFinance'
import { supabase } from '@/lib/supabase'
import type { StripeFinanceData } from '@/types/stripe'

const mockInvoke = vi.mocked(supabase.functions.invoke)

const mockData: StripeFinanceData = {
  mrr: 360,
  arr: 4320,
  newThisMonth: 2,
  churnsThisMonth: 0,
  totalRevenue12mo: 3960,
  subscriptions: [],
  revenueByMonth: [],
  recentTransactions: [],
  fetchedAt: new Date().toISOString(),
}

describe('useStripeFinance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Invalider le cache entre chaque test
    invalidateStripeFinanceCache()
  })

  it('commence avec isLoading=true et data=null', () => {
    mockInvoke.mockReturnValue(new Promise(() => {})) // ne résout jamais
    const { result } = renderHook(() => useStripeFinance())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('charge les données avec succès', async () => {
    mockInvoke.mockResolvedValue({ data: mockData, error: null })
    const { result } = renderHook(() => useStripeFinance())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
  })

  it('gère les erreurs Supabase', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Edge function error') })
    const { result } = renderHook(() => useStripeFinance())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('Impossible de charger les données Stripe')
  })

  it('retourne les données du cache sans refetch', async () => {
    mockInvoke.mockResolvedValue({ data: mockData, error: null })

    // Premier rendu — remplit le cache
    const { result: result1 } = renderHook(() => useStripeFinance())
    await waitFor(() => expect(result1.current.isLoading).toBe(false))

    // Deuxième rendu — doit utiliser le cache
    const { result: result2 } = renderHook(() => useStripeFinance())

    // isLoading immédiatement false (cache hit)
    expect(result2.current.isLoading).toBe(false)
    expect(result2.current.data).toEqual(mockData)
    // invoke ne doit avoir été appelé qu'une fois
    expect(mockInvoke).toHaveBeenCalledTimes(1)
  })
})
