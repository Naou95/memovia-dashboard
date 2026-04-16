/**
 * Sidebar component tests.
 * Covers: RBAC filtering, active state, "soon" items not navigable.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'

const mockUseAuth = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderSidebar(role: 'admin_full' | 'admin_bizdev', path = '/overview') {
  mockUseAuth.mockReturnValue({
    user: {
      profile: { full_name: 'Test User', email: 'test@memovia.io', role },
      role,
    },
  })

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>
  )
}

describe('Sidebar', () => {
  it('renders Overview nav item for admin_full', () => {
    renderSidebar('admin_full')
    expect(screen.getByText('Overview')).toBeInTheDocument()
  })

  it('renders Overview nav item for admin_bizdev', () => {
    renderSidebar('admin_bizdev')
    expect(screen.getByText('Overview')).toBeInTheDocument()
  })

  it('admin_full sees Gestion admins', () => {
    renderSidebar('admin_full')
    expect(screen.getByText('Gestion admins')).toBeInTheDocument()
  })

  it('admin_bizdev does NOT see Gestion admins', () => {
    renderSidebar('admin_bizdev')
    expect(screen.queryByText('Gestion admins')).not.toBeInTheDocument()
  })

  it('active item has aria-current="page"', () => {
    renderSidebar('admin_full', '/overview')
    const overviewEl = screen.getByText('Overview').closest('[aria-current="page"]')
    expect(overviewEl).not.toBeNull()
  })

  it('"soon" items are not wrapped in links', () => {
    renderSidebar('admin_full')
    // Stripe est maintenant actif (Module 3). Qonto est encore "soon".
    const qontoEl = screen.getByText('Qonto Trésorerie')
    const anchor = qontoEl.closest('a')
    expect(anchor).toBeNull()
  })

  it('stripe is now active and wrapped in a link', () => {
    renderSidebar('admin_full')
    const stripeEl = screen.getByText('Stripe & Finance')
    const anchor = stripeEl.closest('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe('/stripe')
  })
})
