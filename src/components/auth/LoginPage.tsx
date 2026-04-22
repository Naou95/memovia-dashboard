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
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/overview'

  useEffect(() => {
    if (!isLoading && user) {
      navigate(from, { replace: true })
    }
  }, [user, isLoading, navigate, from])

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsPending(true)
    try {
      await signInWithPassword(email, password)
    } catch {
      // toast in AuthContext
    } finally {
      setIsPending(false)
    }
  }

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsPending(true)
    try {
      await signInWithMagicLink(email)
      setMagicLinkState('sent')
    } catch {
      // toast in AuthContext
    } finally {
      setIsPending(false)
    }
  }

  // ── Magic link sent state ──────────────────────────────────────────────────
  if (mode === 'magic-link' && magicLinkState === 'sent') {
    return (
      <LoginShell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[8px] bg-[var(--memovia-violet-light)]">
            <Mail className="h-7 w-7 text-[var(--memovia-violet)]" />
          </div>
          <h2 className="mb-2 text-[22px] font-bold tracking-tight text-[var(--text-primary)]">
            Vérifiez vos emails
          </h2>
          <p className="mb-6 text-[13px] text-[var(--text-secondary)]">
            Un lien de connexion a été envoyé à <strong>{email}</strong>.
            <br />
            Le lien expire dans 60 minutes.
          </p>
          <button
            type="button"
            onClick={() => {
              setMagicLinkState('idle')
              setMode('password')
            }}
            className="text-[13px] font-medium text-[var(--memovia-violet)] hover:underline"
          >
            Retour à la connexion
          </button>
        </div>
      </LoginShell>
    )
  }

  return (
    <LoginShell>
      {/* Logo + title */}
      <div className="mb-8 flex items-center gap-2.5">
        <svg
          width="24"
          height="24"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <path
            d="M2 17V4.5a1.5 1.5 0 0 1 2.56-1.06L10 8.88l5.44-5.44A1.5 1.5 0 0 1 18 4.5V17"
            stroke="#7C3AED"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="15.5" r="1.3" fill="#7C3AED" />
        </svg>
        <span className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
          MEMOVIA
        </span>
      </div>

      <div className="mb-8">
        <h1 className="text-[24px] font-bold tracking-tight text-[var(--text-primary)]">
          Bon retour <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
          Accès réservé aux administrateurs MEMOVIA.
        </p>
      </div>

      {/* Expired link banner */}
      {linkExpired && (
        <div className="mb-6 rounded-[8px] border border-[var(--warning)]/20 bg-[var(--warning-bg)] px-4 py-3 text-[13px] text-[var(--warning)]">
          Ce lien de connexion a expiré. Demandez-en un nouveau ci-dessous.
        </div>
      )}

      {/* Password form */}
      {mode === 'password' ? (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[13px] font-medium text-[var(--text-primary)]">
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
                className="pl-10 h-10 rounded-[8px]"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[13px] font-medium text-[var(--text-primary)]">
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
                className="pl-10 pr-10 h-10 rounded-[8px]"
                disabled={isPending}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                tabIndex={-1}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="h-10 w-full rounded-[8px] bg-[var(--text-primary)] text-white hover:bg-[var(--text-primary)]/90"
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

          <button
            type="button"
            onClick={() => setMode('magic-link')}
            className="mt-3 block w-full text-center text-[12px] text-[var(--text-secondary)] transition-colors hover:text-[var(--memovia-violet)]"
          >
            Recevoir un lien magique à la place
          </button>
        </form>
      ) : (
        /* Magic link form */
        <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="magic-email" className="text-[13px] font-medium text-[var(--text-primary)]">
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
                className="pl-10 h-10 rounded-[8px]"
                disabled={isPending}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="h-10 w-full rounded-[8px] bg-[var(--text-primary)] text-white hover:bg-[var(--text-primary)]/90"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi…
              </>
            ) : (
              'Envoyer un lien magique'
            )}
          </Button>

          <button
            type="button"
            onClick={() => setMode('password')}
            className="mt-3 block w-full text-center text-[12px] text-[var(--text-secondary)] transition-colors hover:text-[var(--memovia-violet)]"
          >
            Se connecter avec un mot de passe
          </button>
        </form>
      )}
    </LoginShell>
  )
}

// ── Shell layout : 2 colonnes 55/45 ─────────────────────────────────────────────
function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Left column — form */}
      <div className="flex w-full items-center justify-center px-6 py-12 md:w-[55%] md:px-12">
        <div className="w-full max-w-[380px]">{children}</div>
      </div>

      {/* Right column — visual/quote (hidden on mobile) */}
      <div className="hidden md:flex md:w-[45%] md:items-center md:justify-center md:bg-[var(--bg-primary)] md:px-12">
        <div className="max-w-[420px]">
          <div className="mb-6 inline-flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--memovia-violet-light)]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                d="M2 17V4.5a1.5 1.5 0 0 1 2.56-1.06L10 8.88l5.44-5.44A1.5 1.5 0 0 1 18 4.5V17"
                stroke="#7C3AED"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="10" cy="15.5" r="1.3" fill="#7C3AED" />
            </svg>
          </div>
          <p className="text-[20px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
            Le dashboard qui centralise tout
            <span className="text-[var(--memovia-violet)]"> MEMOVIA AI</span>.
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">
            Finance, commercial, produit, plateforme et IA — une seule vue pour piloter
            l'entreprise au quotidien.
          </p>

          <div className="mt-8 space-y-3 text-[13px] text-[var(--text-secondary)]">
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--memovia-violet)]" />
              Métriques finance temps réel (Stripe, Qonto)
            </div>
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--memovia-violet)]" />
              CRM, contrats B2B, tâches et calendriers
            </div>
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--memovia-violet)]" />
              Monitoring, analytics et copilote IA
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
