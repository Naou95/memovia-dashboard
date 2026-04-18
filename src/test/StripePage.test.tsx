import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { StripeFinanceData } from '@/types/stripe'

// Mock du hook
vi.mock('@/hooks/useStripeFinance', () => ({
  useStripeFinance: vi.fn(),
  invalidateStripeFinanceCache: vi.fn(),
}))

// Recharts provoque des erreurs ResizeObserver en jsdom — on mock le module
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  }
})

import StripePage from '@/modules/stripe/StripePage'
import { useStripeFinance } from '@/hooks/useStripeFinance'

const mockUseStripeFinance = vi.mocked(useStripeFinance)

const mockData: StripeFinanceData = {
  mrr: 360,
  arr: 4320,
  newThisMonth: 2,
  churnsThisMonth: 1,
  totalRevenue12mo: 3960,
  subscriptions: [
    {
      id: 'sub_1',
      customerEmail: 'client@exemple.com',
      planName: 'B2B Pro',
      amount: 360,
      interval: 'month',
      startDate: '2025-01-01T00:00:00Z',
      cancelAtPeriodEnd: false,
    },
  ],
  revenueByMonth: Array.from({ length: 12 }, (_, i) => ({
    month: `mois ${i + 1}`,
    revenue: 360,
  })),
  recentTransactions: [
    {
      id: 'ch_1',
      date: '2026-04-01T10:00:00Z',
      description: 'Abonnement B2B',
      amount: 360,
      currency: 'EUR',
      status: 'succeeded',
    },
  ],
  fetchedAt: new Date().toISOString(),
}

describe('StripePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche les skeletons pendant le chargement', () => {
    mockUseStripeFinance.mockReturnValue({ data: null, isLoading: true, error: null })
    const { container } = render(<StripePage />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('affiche les 5 KPI cards avec les données', () => {
    mockUseStripeFinance.mockReturnValue({ data: mockData, isLoading: false, error: null })
    render(<StripePage />)

    expect(screen.getByText('MRR')).toBeInTheDocument()
    expect(screen.getByText('ARR')).toBeInTheDocument()
    expect(screen.getByText('Nouveaux ce mois')).toBeInTheDocument()
    expect(screen.getByText('Churns ce mois')).toBeInTheDocument()
    expect(screen.getByText('Revenus 12 mois')).toBeInTheDocument()
  })

  it('affiche la valeur MRR correctement formatée', () => {
    mockUseStripeFinance.mockReturnValue({ data: mockData, isLoading: false, error: null })
    render(<StripePage />)
    // 360 formaté en fr-FR
    expect(screen.getByText('360')).toBeInTheDocument()
  })

  it("affiche l'email du client dans le tableau abonnements", () => {
    mockUseStripeFinance.mockReturnValue({ data: mockData, isLoading: false, error: null })
    render(<StripePage />)
    expect(screen.getByText('client@exemple.com')).toBeInTheDocument()
  })

  it('affiche la description de la transaction', () => {
    mockUseStripeFinance.mockReturnValue({ data: mockData, isLoading: false, error: null })
    render(<StripePage />)
    expect(screen.getByText('Abonnement B2B')).toBeInTheDocument()
  })

  it('affiche "Indisponible" sur les KPI si erreur', () => {
    mockUseStripeFinance.mockReturnValue({ data: null, isLoading: false, error: 'Erreur Stripe' })
    render(<StripePage />)
    const indispos = screen.getAllByText('Indisponible')
    expect(indispos.length).toBeGreaterThanOrEqual(1)
  })
})
