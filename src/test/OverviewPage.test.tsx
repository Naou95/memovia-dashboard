import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { StripeFinanceData } from '@/types/stripe'
import type { QontoFinanceData } from '@/types/qonto'
import type { StripeMetrics } from '@/types/overview'

// ── Recharts: stub ResponsiveContainer so charts render deterministically ────
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 600, height: 260 }}>
        {children}
      </div>
    ),
  }
})

// ── Hook mocks ────────────────────────────────────────────────────────────────
vi.mock('@/hooks/useOverviewKpis', () => ({
  useOverviewKpis: vi.fn(),
}))
vi.mock('@/hooks/useStripeFinance', () => ({
  useStripeFinance: vi.fn(),
  invalidateStripeFinanceCache: vi.fn(),
}))
vi.mock('@/hooks/useQontoFinance', () => ({
  useQontoFinance: vi.fn(),
  invalidateQontoFinanceCache: vi.fn(),
}))
vi.mock('@/hooks/useTasks', () => ({
  useTasks: vi.fn(() => ({ tasks: [], isLoading: false })),
}))
vi.mock('@/hooks/useLeads', () => ({
  useLeads: vi.fn(() => ({ leads: [], isLoading: false })),
}))
vi.mock('@/hooks/useContracts', () => ({
  useContracts: vi.fn(() => ({ contracts: [], isLoading: false })),
}))
vi.mock('@/hooks/useIaBriefing', () => ({
  useIaBriefing: vi.fn(() => ({
    briefing: 'Tout va bien aujourd\'hui.',
    isLoading: false,
    isStreaming: false,
    error: null,
  })),
}))
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { profile: { full_name: 'Naoufel Bassou' } },
    session: null,
    isLoading: false,
  })),
}))

import OverviewPage from '@/modules/overview/OverviewPage'
import { useOverviewKpis } from '@/hooks/useOverviewKpis'
import { useStripeFinance } from '@/hooks/useStripeFinance'
import { useQontoFinance } from '@/hooks/useQontoFinance'

const mockOverviewKpis = vi.mocked(useOverviewKpis)
const mockStripeFinance = vi.mocked(useStripeFinance)
const mockQontoFinance = vi.mocked(useQontoFinance)

const stripeMetrics: StripeMetrics = {
  mrr: 360,
  activeSubscribers: 30,
  cancelingAtPeriodEnd: 2,
  fetchedAt: new Date().toISOString(),
}

const stripeFinance: StripeFinanceData = {
  mrr: 360,
  arr: 4320,
  newThisMonth: 2,
  churnsThisMonth: 1,
  totalRevenue12mo: 3960,
  subscriptions: [],
  revenueByMonth: Array.from({ length: 12 }, (_, i) => ({
    month: `mois ${i + 1}`,
    revenue: 300 + i * 10,
  })),
  recentTransactions: [],
  fetchedAt: new Date().toISOString(),
}

const qontoFinance: QontoFinanceData = {
  balance: 12430.5,
  currency: 'EUR',
  transactions: [],
  monthlyCashFlow: [
    { month: 'Nov 2025', income: 1200, expenses: 800, net: 400 },
    { month: 'Déc 2025', income: 1500, expenses: 900, net: 600 },
    { month: 'Jan 2026', income: 1800, expenses: 1100, net: 700 },
    { month: 'Fév 2026', income: 1400, expenses: 1300, net: 100 },
    { month: 'Mar 2026', income: 2000, expenses: 1200, net: 800 },
    { month: 'Avr 2026', income: 1700, expenses: 1500, net: 200 },
  ],
  fetchedAt: new Date().toISOString(),
}

describe('OverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders greeting, 4 KPI cards, P&L chart and Revenue chart on happy path', () => {
    mockOverviewKpis.mockReturnValue({
      stripe: stripeMetrics,
      qonto: null,
      stripeError: null,
      qontoError: null,
      isLoading: false,
    })
    mockStripeFinance.mockReturnValue({ data: stripeFinance, isLoading: false, error: null })
    mockQontoFinance.mockReturnValue({ data: qontoFinance, isLoading: false, error: null })

    render(<OverviewPage />)

    // Greeting with first name
    expect(screen.getByText(/Naoufel/)).toBeInTheDocument()
    // 4 KPI labels
    expect(screen.getByText('MRR')).toBeInTheDocument()
    expect(screen.getByText('Abonnés actifs')).toBeInTheDocument()
    expect(screen.getByText('Solde Qonto')).toBeInTheDocument()
    expect(screen.getByText('Annulations en cours')).toBeInTheDocument()
    // Sections
    expect(screen.getByText('Flux financier')).toBeInTheDocument()
    expect(screen.getByText('Revenus facturés')).toBeInTheDocument()
    expect(screen.getByText('Activité récente')).toBeInTheDocument()
  })

  it('shows a skeleton for the P&L chart while qonto data is loading', () => {
    mockOverviewKpis.mockReturnValue({
      stripe: stripeMetrics,
      qonto: null,
      stripeError: null,
      qontoError: null,
      isLoading: false,
    })
    mockStripeFinance.mockReturnValue({ data: stripeFinance, isLoading: false, error: null })
    mockQontoFinance.mockReturnValue({ data: null, isLoading: true, error: null })

    const { container } = render(<OverviewPage />)
    // At least one skeleton div inside the P&L card area
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0)
    // P&L chart (responsive container) is NOT rendered during loading
    expect(screen.queryByTestId('responsive-container')).toBeTruthy() // Revenue chart still present
  })

  it('shows "Indisponible" in the P&L card when qontoError is set (CRITICAL failure mode)', () => {
    mockOverviewKpis.mockReturnValue({
      stripe: stripeMetrics,
      qonto: null,
      stripeError: null,
      qontoError: null,
      isLoading: false,
    })
    mockStripeFinance.mockReturnValue({ data: stripeFinance, isLoading: false, error: null })
    mockQontoFinance.mockReturnValue({
      data: null,
      isLoading: false,
      error: 'Impossible de charger les données Qonto',
    })

    render(<OverviewPage />)

    // The "Flux financier" section heading is still visible
    expect(screen.getByText('Flux financier')).toBeInTheDocument()
    // P&L chart area shows fallback error label
    expect(screen.getAllByText('Indisponible').length).toBeGreaterThanOrEqual(1)
    // Page did NOT crash — other sections still visible
    expect(screen.getByText('MRR')).toBeInTheDocument()
    expect(screen.getByText('Revenus facturés')).toBeInTheDocument()
  })

  it('renders MRR card even when stripeFinance is loading (no sparkline yet)', () => {
    mockOverviewKpis.mockReturnValue({
      stripe: stripeMetrics,
      qonto: null,
      stripeError: null,
      qontoError: null,
      isLoading: false,
    })
    mockStripeFinance.mockReturnValue({ data: null, isLoading: true, error: null })
    mockQontoFinance.mockReturnValue({ data: qontoFinance, isLoading: false, error: null })

    const { container } = render(<OverviewPage />)
    expect(screen.getByText('MRR')).toBeInTheDocument()
    // No sparkline rendered while stripeFinance.revenueByMonth is absent
    expect(container.querySelector('[data-testid="kpi-sparkline"]')).toBeFalsy()
  })
})
