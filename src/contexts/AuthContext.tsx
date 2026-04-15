import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AuthContextValue, AuthUser, DashboardProfile } from '@/types/auth'
import { getRoleFromSession } from '@/types/auth'

// ─── Constants ────────────────────────────────────────────────────────────────
const GET_SESSION_TIMEOUT_MS = 5000

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // isMounted guard — prevents state updates after unmount (React StrictMode safe)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    // ── Bootstrap: restore session from localStorage ───────────────────────
    // Race against a 5s timeout. If Supabase never responds (e.g. offline at
    // hard-reload), we bail out instead of spinning forever.
    let didRespond = false

    const timeoutId = setTimeout(() => {
      if (!isMountedRef.current) return
      if (!didRespond) {
        setIsLoading(false)
        toast.error('Impossible de restaurer la session. Vérifiez votre connexion.')
      }
    }, GET_SESSION_TIMEOUT_MS)

    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      didRespond = true
      clearTimeout(timeoutId)

      if (!isMountedRef.current) return

      if (sessionError) {
        setError(sessionError.message)
        setIsLoading(false)
        return
      }

      if (data.session) {
        await loadUserProfile(data.session)
      } else {
        setIsLoading(false)
      }
    })

    // ── Real-time auth state listener ──────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!isMountedRef.current) return

        if (newSession) {
          await loadUserProfile(newSession)
        } else {
          setSession(null)
          setUser(null)
          setIsLoading(false)
        }
      }
    )

    return () => {
      isMountedRef.current = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  // ── loadUserProfile ──────────────────────────────────────────────────────
  // Fetches dashboard_profiles row to validate this auth user is a registered
  // dashboard admin. If no profile row exists, force-signs out with a message.
  async function loadUserProfile(currentSession: Session): Promise<void> {
    if (!isMountedRef.current) return

    const role = getRoleFromSession(currentSession)

    const { data: profileData, error: profileError } = await supabase
      .from('dashboard_profiles')
      .select('*')
      .eq('id', currentSession.user.id)
      .single()

    // Cast to DashboardProfile — Supabase generic narrowing can fail in composite builds
    const profile = profileData as DashboardProfile | null

    if (!isMountedRef.current) return

    if (profileError || !profile) {
      // User exists in auth.users but has no dashboard_profiles row
      // This is the "No access" failsafe
      await supabase.auth.signOut()
      if (isMountedRef.current) {
        toast.error("Aucun accès — contactez l'administrateur.")
        setSession(null)
        setUser(null)
        setIsLoading(false)
      }
      return
    }

    setSession(currentSession)
    setUser({
      supabaseUser: currentSession.user,
      profile,
      // Prefer JWT role (from hook) over DB role — they should match, but
      // the JWT is the authoritative source for RBAC
      role: role ?? profile.role,
    })
    setIsLoading(false)
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async function signInWithPassword(email: string, password: string): Promise<void> {
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      let message = 'Identifiants incorrects. Réessayez.'
      if (signInError.status === 429) {
        message = 'Trop de tentatives. Compte temporairement bloqué.'
      } else if (signInError.message?.toLowerCase().includes('network')) {
        message = 'Erreur réseau. Vérifiez votre connexion.'
      }
      setError(message)
      toast.error(message)
      throw signInError
    }
    // Session is set via onAuthStateChange
  }

  async function signInWithMagicLink(email: string): Promise<void> {
    setError(null)
    const { error: magicError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    })

    if (magicError) {
      let message = 'Impossible d\'envoyer le lien. Réessayez.'
      if (magicError.message?.toLowerCase().includes('redirect')) {
        message = 'URL de redirection non autorisée. Vérifiez la config Supabase.'
      }
      toast.error(message)
      throw magicError
    }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
    // State is cleared via onAuthStateChange
  }

  return (
    <AuthContext.Provider
      value={{ user, session, isLoading, error, signInWithPassword, signInWithMagicLink, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return ctx
}
