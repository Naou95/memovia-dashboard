/**
 * RequireAuth component tests.
 * Covers: redirect when unauthed, spinner while loading, children when authed.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/components/auth/RequireAuth'

// Mock useAuth hook
const mockUseAuth = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderWithRouter(initialPath = '/overview') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/overview"
          element={
            <RequireAuth>
              <div>Protected Content</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('RequireAuth', () => {
  it('shows spinner while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true })
    renderWithRouter()
    // Spinner element present (it has animate-spin class)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).not.toBeNull()
  })

  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: {
        supabaseUser: { id: 'uuid' },
        profile: { full_name: 'Naoufel', email: 'naoufel@memovia.io', role: 'admin_full' },
        role: 'admin_full',
      },
      isLoading: false,
    })
    renderWithRouter()
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects to /login when user is null and not loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false })
    renderWithRouter()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})
