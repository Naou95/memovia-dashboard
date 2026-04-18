/**
 * Tests Module 4 — Qonto Trésorerie
 * Couvre : QontoPage rendering, TransactionTable filtres, AlertThresholdConfig.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TransactionTable } from '@/modules/qonto/components/TransactionTable'
import { AlertThresholdConfig } from '@/modules/qonto/components/AlertThresholdConfig'
import QontoPage from '@/modules/qonto/QontoPage'
import { invalidateQontoFinanceCache } from '@/hooks/useQontoFinance'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockInvoke = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

// Fixtures
const mockData = {
  balance: 12430.5,
  currency: 'EUR',
  transactions: [
    {
      id: 'tx-1',
      label: 'OVH Cloud',
      amount: 29.99,
      side: 'debit' as const,
      category: 'software_subscriptions',
      settledAt: new Date().toISOString(),
      status: 'completed' as const,
    },
  ],
  monthlyCashFlow: [
    { month: 'Nov 2025', income: 0, expenses: 0, net: 0 },
    { month: 'Déc 2025', income: 500, expenses: 200, net: 300 },
    { month: 'Jan 2026', income: 1200, expenses: 400, net: 800 },
    { month: 'Fév 2026', income: 900, expenses: 350, net: 550 },
    { month: 'Mar 2026', income: 1100, expenses: 500, net: 600 },
    { month: 'Avr 2026', income: 1500, expenses: 800, net: 700 },
  ],
  fetchedAt: new Date().toISOString(),
}

// Helper Supabase from() mock chainable
function makeSupabaseChain(resolveValue: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: resolveValue, error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  // Invalider le cache du hook entre tests pour éviter les effets de bord
  invalidateQontoFinanceCache()
  // Par défaut : pas de seuil configuré
  mockFrom.mockReturnValue(makeSupabaseChain(null))
})

// ── Tests QontoPage ───────────────────────────────────────────────────────────

describe('QontoPage', () => {
  it('affiche un skeleton de chargement initialement', () => {
    mockInvoke.mockReturnValue(new Promise(() => {})) // never resolves
    render(
      <MemoryRouter>
        <QontoPage />
      </MemoryRouter>
    )
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('affiche le solde après chargement', async () => {
    mockInvoke.mockResolvedValueOnce({ data: mockData, error: null })
    render(
      <MemoryRouter>
        <QontoPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      // 12 430,50 € — le chiffre "12" est dans le texte formaté
      expect(screen.getByText(/12/)).toBeInTheDocument()
    })
  })

  it("affiche un message d'erreur si le fetch échoue", async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('502') })
    render(
      <MemoryRouter>
        <QontoPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/impossible de charger/i)).toBeInTheDocument()
    })
  })
})

// ── Tests TransactionTable ─────────────────────────────────────────────────────

describe('TransactionTable', () => {
  const transactions = [
    {
      id: 'tx-1',
      label: 'OVH Cloud',
      amount: 29.99,
      side: 'debit' as const,
      category: 'software_subscriptions',
      settledAt: new Date().toISOString(),
      status: 'completed' as const,
    },
    {
      id: 'tx-2',
      label: 'Virement client',
      amount: 360,
      side: 'credit' as const,
      category: 'income',
      settledAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed' as const,
    },
    {
      id: 'tx-3',
      label: 'Vieux paiement',
      amount: 50,
      side: 'debit' as const,
      category: 'other',
      settledAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed' as const,
    },
  ]

  it('affiche toutes les transactions sans filtre', () => {
    render(<TransactionTable transactions={transactions} />)
    expect(screen.getByText('OVH Cloud')).toBeInTheDocument()
    expect(screen.getByText('Virement client')).toBeInTheDocument()
    expect(screen.getByText('Vieux paiement')).toBeInTheDocument()
  })

  it('filtre les transactions sur 7 derniers jours', () => {
    render(<TransactionTable transactions={transactions} />)

    const select = screen.getByDisplayValue('Toutes les périodes')
    fireEvent.change(select, { target: { value: '7d' } })

    // OVH Cloud est aujourd'hui — visible
    expect(screen.getByText('OVH Cloud')).toBeInTheDocument()
    // Virement il y a 10j — pas visible sur 7j
    expect(screen.queryByText('Virement client')).not.toBeInTheDocument()
  })

  it('filtre les transactions par catégorie', () => {
    render(<TransactionTable transactions={transactions} />)

    const select = screen.getByDisplayValue('Toutes les catégories')
    fireEvent.change(select, { target: { value: 'income' } })

    expect(screen.getByText('Virement client')).toBeInTheDocument()
    expect(screen.queryByText('OVH Cloud')).not.toBeInTheDocument()
  })

  it('affiche un empty state si aucune transaction après combinaison de filtres', () => {
    render(<TransactionTable transactions={transactions} />)

    // Filtre 7j : seul OVH est dans la fenêtre
    const periodSelect = screen.getByDisplayValue('Toutes les périodes')
    fireEvent.change(periodSelect, { target: { value: '7d' } })

    // Puis filtre par catégorie "income" — aucun résultat dans les 7j
    const catSelect = screen.getByDisplayValue('Toutes les catégories')
    fireEvent.change(catSelect, { target: { value: 'income' } })

    expect(screen.getByText(/aucune transaction pour ces filtres/i)).toBeInTheDocument()
  })

  it('affiche null category comme "Autre"', () => {
    const txsWithNull = [{ ...transactions[0], category: null }]
    render(<TransactionTable transactions={txsWithNull} />)
    // "Autre" apparaît dans le badge de la ligne ET dans l'option du filtre catégorie
    const autreEls = screen.getAllByText('Autre')
    expect(autreEls.length).toBeGreaterThanOrEqual(1)
  })
})

// ── Tests AlertThresholdConfig ─────────────────────────────────────────────────

describe('AlertThresholdConfig', () => {
  it('charge le seuil existant depuis Supabase au montage', async () => {
    const chain = makeSupabaseChain({ value: '5000' })
    mockFrom.mockReturnValue(chain)

    const onSaved = vi.fn()
    render(<AlertThresholdConfig onSaved={onSaved} />)

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/ex : 5000/i) as HTMLInputElement
      expect(input.value).toBe('5000')
    })
  })

  it('sauvegarde le seuil et appelle onSaved', async () => {
    const chain = makeSupabaseChain(null)
    mockFrom.mockReturnValue(chain)

    const onSaved = vi.fn()
    render(<AlertThresholdConfig onSaved={onSaved} />)

    await waitFor(() => screen.getByPlaceholderText(/ex : 5000/i))

    const input = screen.getByPlaceholderText(/ex : 5000/i)
    fireEvent.change(input, { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /sauvegarder/i }))

    await waitFor(() => {
      expect(chain.upsert).toHaveBeenCalled()
      expect(onSaved).toHaveBeenCalledWith(3000)
    })
  })
})

// Suppress console noise during tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
