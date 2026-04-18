/**
 * Tests Module 5 — Contrats B2B
 * Couvre : ContractsPage rendering, filtres, modal création.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Contract } from '@/types/contracts'
import type { UseContractsResult } from '@/hooks/useContracts'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useContracts', () => ({
  useContracts: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

// Suppress console noise
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

import ContractsPage from '@/modules/contracts/ContractsPage'
import { useContracts } from '@/hooks/useContracts'
import { useAuth } from '@/contexts/AuthContext'

const mockUseContracts = vi.mocked(useContracts)
const mockUseAuth = vi.mocked(useAuth)

// ── Fixtures ─────────────────────────────────────────────────────────────────

const mockContracts: Contract[] = [
  {
    id: 'uuid-1',
    organization_name: 'CFA Compagnons du Devoir',
    organization_type: 'cfa',
    status: 'actif',
    license_count: 30,
    contact_name: 'Antoaneta',
    contact_email: null,
    contact_phone: null,
    mrr_eur: 360,
    renewal_date: '2026-09-01',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
  },
  {
    id: 'uuid-2',
    organization_name: 'École Nationale',
    organization_type: 'ecole',
    status: 'prospect',
    license_count: 10,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    mrr_eur: null,
    renewal_date: null,
    notes: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    created_by: null,
  },
]

function makeHookResult(overrides: Partial<UseContractsResult> = {}): UseContractsResult {
  return {
    contracts: mockContracts,
    isLoading: false,
    error: null,
    createContract: vi.fn().mockResolvedValue(undefined),
    updateContract: vi.fn().mockResolvedValue(undefined),
    deleteContract: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeAuthResult(role: 'admin_full' | 'admin_bizdev' = 'admin_full') {
  return {
    user: {
      role,
      supabaseUser: {} as never,
      profile: {} as never,
    },
    session: null,
    isLoading: false,
    error: null,
    signInWithPassword: vi.fn(),
    signInWithMagicLink: vi.fn(),
    signOut: vi.fn(),
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ContractsPage />
    </MemoryRouter>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ContractsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(makeAuthResult())
  })

  it('affiche les KPI cards', () => {
    mockUseContracts.mockReturnValue(makeHookResult())
    renderPage()

    expect(screen.getByText('Total contrats')).toBeInTheDocument()
    expect(screen.getByText('Contrats actifs')).toBeInTheDocument()
    expect(screen.getByText('Licences totales')).toBeInTheDocument()
    expect(screen.getByText('MRR total')).toBeInTheDocument()
  })

  it("affiche l'état vide quand aucun contrat", () => {
    mockUseContracts.mockReturnValue(makeHookResult({ contracts: [] }))
    renderPage()

    expect(screen.getByText('Aucun contrat trouvé')).toBeInTheDocument()
  })

  it('filtre les contrats par statut', () => {
    mockUseContracts.mockReturnValue(makeHookResult())
    renderPage()

    // Both contracts visible initially
    expect(screen.getByText('CFA Compagnons du Devoir')).toBeInTheDocument()
    expect(screen.getByText('École Nationale')).toBeInTheDocument()

    // Click "Actif" filter pill
    fireEvent.click(screen.getByRole('button', { name: 'Actif' }))

    // Only actif contract should be visible
    expect(screen.getByText('CFA Compagnons du Devoir')).toBeInTheDocument()
    expect(screen.queryByText('École Nationale')).not.toBeInTheDocument()
  })

  it('ouvre la modale de création', () => {
    mockUseContracts.mockReturnValue(makeHookResult())
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /nouveau contrat/i }))

    // The dialog title and the form field should be present
    expect(screen.getAllByText('Nouveau contrat').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByLabelText(/nom de l'organisation/i)).toBeInTheDocument()
  })
})
