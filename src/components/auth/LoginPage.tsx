import { useEffect, useState } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'

type LoginMode = 'password' | 'magic-link'
type MagicLinkState = 'idle' | 'sent'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { signInWithPassword, signInWithMagicLink, user, isLoading } = useAuth()

  const [mode, setMode] = useState<LoginMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [magicLinkState, setMagicLinkState] = useState<MagicLinkState>('idle')

  const linkExpired = searchParams.get('error') === 'link_expired'
  // Where to send user after login (supports post-login redirect)
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/overview'

  // Redirect once the AuthContext reports an authenticated user. Done in an
  // effect (not during render) so we never trigger a router transition while
  // rendering, and so login works the instant loadUserProfile resolves —
  // even without a JWT role claim.
  useEffect(() => {
    if (!isLoading && user) {
      navigate(from, { replace: true })
    }
  }, [user, isLoading, navigate, from])

  // ── Password submit ────────────────────────────────────────────────────────
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsPending(true)
    try {
      await signInWithPassword(email, password)
      // Redirect is handled by the useEffect above once the session
      // propagates to `user` via onAuthStateChange → loadUserProfile.
    } catch {
      // Error is toasted inside AuthContext
    } finally {
      setIsPending(false)
    }
  }

  // ── Magic link submit ──────────────────────────────────────────────────────
  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsPending(true)
    try {
      await signInWithMagicLink(email)
      setMagicLinkState('sent')
    } catch {
      // Error is toasted inside AuthContext
    } finally {
      setIsPending(false)
    }
  }

  // ── Magic link sent state ──────────────────────────────────────────────────
  if (mode === 'magic-link' && magicLinkState === 'sent') {
    return (
      <LoginShell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--memovia-violet-light)]">
            <Mail className="h-7 w-7 text-[var(--memovia-violet)]" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-[var(--text-primary)]">
            Vérifiez vos emails
          </h2>
          <p className="mb-6 text-sm text-[var(--text-secondary)]">
            Un lien de connexion a été envoyé à <strong>{email}</strong>.
            <br />
            Le lien expire dans 60 minutes.
          </p>
          <Button
            variant="ghost"
            className="text-sm text-[var(--text-secondary)]"
            onClick={() => {
              setMagicLinkState('idle')
              setMode('password')
            }}
          >
            Retour à la connexion
          </Button>
        </div>
      </LoginShell>
    )
  }

  return (
    <LoginShell>
      {/* Expired link banner */}
      {linkExpired && (
        <div className="mb-6 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-3 text-sm text-[var(--warning)]">
          Ce lien de connexion a expiré. Demandez-en un nouveau ci-dessous.
        </div>
      )}

      {/* Logo + title */}
      <div className="mb-8 text-center">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          MEMOVIA Dashboard
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Accès réservé aux administrateurs
        </p>
      </div>

      {/* Mode toggle */}
      <div className="mb-6 flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-1">
        <button
          type="button"
          onClick={() => setMode('password')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
            mode === 'password'
              ? 'bg-white text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Mot de passe
        </button>
        <button
          type="button"
          onClick={() => setMode('magic-link')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
            mode === 'magic-link'
              ? 'bg-white text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Lien magique
        </button>
      </div>

      {/* Password form */}
      {mode === 'password' ? (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-[var(--text-primary)]">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="vous@memovia.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium text-[var(--text-primary)]">
              Mot de passe
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                disabled={isPending}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="brand"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connexion…
              </>
            ) : (
              'Se connecter'
            )}
          </Button>
        </form>
      ) : (
        /* Magic link form */
        <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="magic-email" className="text-sm font-medium text-[var(--text-primary)]">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                id="magic-email"
                type="email"
                required
                autoComplete="email"
                placeholder="vous@memovia.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                disabled={isPending}
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="brand"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi…
              </>
            ) : (
              'Envoyer un lien de connexion'
            )}
          </Button>
        </form>
      )}
    </LoginShell>
  )
}

// ── Shell layout ───────────────────────────────────────────────────────────────
function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-[var(--border-color)] bg-white p-8 shadow-sm">
          {children}
        </div>
        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
          MEMOVIA AI — Dashboard interne
        </p>
      </div>
    </div>
  )
}
