/**
 * Sidebar component tests.
 * Covers: RBAC filtering, active state, "soon" items not navigable, collapse.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    // Stripe item is "soon" — should not have an <a> element
    const stripeEl = screen.getByText('Stripe & Revenus')
    const anchor = stripeEl.closest('a')
    expect(anchor).toBeNull()
  })

  it('collapse button toggles icon-only mode', () => {
    renderSidebar('admin_full')
    const collapseBtn = screen.getByRole('button', { name: /collapse sidebar/i })
    fireEvent.click(collapseBtn)
    // After collapse, label text should no longer be visible
    expect(screen.queryByText('Principal')).not.toBeInTheDocument()
  })
})
