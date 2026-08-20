/**
 * TopNav component tests (nav v2, remplace Sidebar.test.tsx).
 * Covers: les 5 entrées, active state, "soon" non navigable.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TopNav } from '@/components/layout/TopNav'

const mockUseAuth = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderTopNav(role: 'admin_full' | 'admin_bizdev', path = '/leads') {
  mockUseAuth.mockReturnValue({
    user: {
      profile: { full_name: 'Test User', email: 'test@memovia.io', role },
      role,
    },
  })

  return render(
    <MemoryRouter initialEntries={[path]}>
      <TopNav />
    </MemoryRouter>
  )
}

describe('TopNav', () => {
  it('affiche les 5 sections v2 pour admin_full', () => {
    renderTopNav('admin_full')
    for (const label of ['Leads', 'RDV', 'Financements', 'Argent', 'Bugs']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('affiche les 5 sections v2 pour admin_bizdev', () => {
    renderTopNav('admin_bizdev')
    for (const label of ['Leads', 'RDV', 'Financements', 'Argent', 'Bugs']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('les anciens modules ne sont plus affichés', () => {
    renderTopNav('admin_full')
    for (const dead of ['Overview', 'Stripe & Finance', 'Qonto Trésorerie', 'GitHub', 'SEO & Blog']) {
      expect(screen.queryByText(dead)).not.toBeInTheDocument()
    }
  })

  it('active item has aria-current="page"', () => {
    renderTopNav('admin_full', '/leads')
    const leadsEl = screen.getByText('Leads').closest('[aria-current="page"]')
    expect(leadsEl).not.toBeNull()
  })

  it('une sous-route garde sa section active', () => {
    renderTopNav('admin_full', '/rdv/quelconque')
    const rdvEl = screen.getByText('RDV').closest('[aria-current="page"]')
    expect(rdvEl).not.toBeNull()
  })

  it('Financements est actif : lien vers /financements', () => {
    renderTopNav('admin_full')
    const anchor = screen.getByText('Financements').closest('a')
    expect(anchor).not.toBeNull()
    expect(anchor).toHaveAttribute('href', '/financements')
  })

  it('Leads est actif : lien vers /leads', () => {
    renderTopNav('admin_full')
    const anchor = screen.getByText('Leads').closest('a')
    expect(anchor).not.toBeNull()
    expect(anchor).toHaveAttribute('href', '/leads')
  })
})
