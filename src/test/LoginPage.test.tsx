/**
 * LoginPage component tests.
 * Covers: form rendering, password submit, magic link submit, error states, expired link banner.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '@/components/auth/LoginPage'

// Navigation mock
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Auth mock
const mockSignInWithPassword = vi.fn()
const mockSignInWithMagicLink = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderLoginPage(searchParams = '') {
  return render(
    <MemoryRouter initialEntries={[`/login${searchParams}`]}>
      <LoginPage />
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockSignInWithPassword.mockReset()
    mockSignInWithMagicLink.mockReset()
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      signInWithPassword: mockSignInWithPassword,
      signInWithMagicLink: mockSignInWithMagicLink,
    })
  })

  it('renders password form by default', () => {
    renderLoginPage()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument()
  })

  it('shows expired link banner when error=link_expired', () => {
    renderLoginPage('?error=link_expired')
    expect(screen.getByText(/ce lien de connexion a expiré/i)).toBeInTheDocument()
  })

  it('calls signInWithPassword on password form submit', async () => {
    const user = userEvent.setup()
    mockSignInWithPassword.mockResolvedValue(undefined)
    renderLoginPage()

    await user.type(screen.getByLabelText(/email/i), 'naoufel@memovia.io')
    await user.type(screen.getByLabelText(/mot de passe/i), 'password123')
    await user.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith('naoufel@memovia.io', 'password123')
    })
  })

  it('shows loading state while signing in', async () => {
    const user = userEvent.setup()
    // Never resolves
    mockSignInWithPassword.mockImplementation(() => new Promise(() => {}))
    renderLoginPage()

    await user.type(screen.getByLabelText(/email/i), 'naoufel@memovia.io')
    await user.type(screen.getByLabelText(/mot de passe/i), 'password123')
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(screen.getByText(/connexion/i)).toBeInTheDocument()
    })
  })

  it('switches to magic link mode', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: /lien magique/i }))
    expect(screen.getByRole('button', { name: /envoyer un lien/i })).toBeInTheDocument()
  })

  it('shows "check inbox" screen after magic link sent', async () => {
    const user = userEvent.setup()
    mockSignInWithMagicLink.mockResolvedValue(undefined)
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: /lien magique/i }))
    await user.type(screen.getByLabelText(/email/i), 'naoufel@memovia.io')
    await user.click(screen.getByRole('button', { name: /envoyer un lien/i }))

    await waitFor(() => {
      expect(screen.getByText(/vérifiez vos emails/i)).toBeInTheDocument()
    })
  })

  it('does not call signIn when fields are empty (HTML5 required)', async () => {
    renderLoginPage()
    // Try clicking submit with empty fields — HTML5 required blocks it
    const submitBtn = screen.getByRole('button', { name: /se connecter/i })
    fireEvent.click(submitBtn)
    expect(mockSignInWithPassword).not.toHaveBeenCalled()
  })
})
