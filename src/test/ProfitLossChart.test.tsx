import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { MonthlyCashFlow } from '@/types/qonto'

// Recharts needs ResizeObserver stubbed + a deterministic ResponsiveContainer
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

import { ProfitLossChart } from '@/components/shared/ProfitLossChart'

const mockData: MonthlyCashFlow[] = [
  { month: 'Nov 2025', income: 1200, expenses: 800, net: 400 },
  { month: 'Déc 2025', income: 1500, expenses: 900, net: 600 },
  { month: 'Jan 2026', income: 1800, expenses: 1100, net: 700 },
  { month: 'Fév 2026', income: 1400, expenses: 1300, net: 100 },
  { month: 'Mar 2026', income: 2000, expenses: 1200, net: 800 },
  { month: 'Avr 2026', income: 1700, expenses: 1500, net: 200 },
]

describe('ProfitLossChart', () => {
  it('renders a responsive chart container when data is present', () => {
    render(<ProfitLossChart data={mockData} />)
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('renders a chart wrapper at the requested height', () => {
    const { container } = render(<ProfitLossChart data={mockData} height={320} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.height).toBe('320px')
  })

  it('shows an empty state when all months have zero activity', () => {
    const empty: MonthlyCashFlow[] = [
      { month: 'Jan 2026', income: 0, expenses: 0, net: 0 },
      { month: 'Fév 2026', income: 0, expenses: 0, net: 0 },
    ]
    render(<ProfitLossChart data={empty} />)
    expect(screen.getByText(/Aucune activité/i)).toBeInTheDocument()
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument()
  })
})
