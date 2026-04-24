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

// ─── Constants ────────────────────────────────────────────────────────────────
const GET_SESSION_TIMEOUT_MS = 5000
const PROFILE_QUERY_TIMEOUT_MS = 12000

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

    // ── Safety timeout: if onAuthStateChange never fires (network issue) ──
    const timeoutId = setTimeout(() => {
      if (!isMountedRef.current) return
      setIsLoading(false)
      toast.error('Impossible de restaurer la session. Vérifiez votre connexion.')
    }, GET_SESSION_TIMEOUT_MS)

    // ── Single auth listener — handles INITIAL_SESSION + future changes ────
    // onAuthStateChange fires AFTER the SDK has applied the session internally,
    // so DB queries inside loadUserProfile have the correct auth headers.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!isMountedRef.current) return
        clearTimeout(timeoutId)

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
  // Fetches the dashboard_profiles row. If missing or query fails/times out,
  // access is denied (fail closed). Only users with an explicit DB profile
  // are admitted to the dashboard.
  async function loadUserProfile(currentSession: Session): Promise<void> {
    if (!isMountedRef.current) return

    // Bounded profile query: never let a stuck request block the login flow.
    const profilePromise = supabase
      .from('dashboard_profiles')
      .select('*')
      .eq('id', currentSession.user.id)
      .maybeSingle()

    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(
        () =>
          resolve({
            data: null,
            error: new Error('dashboard_profiles query timed out'),
          }),
        PROFILE_QUERY_TIMEOUT_MS
      )
    )

    const { data: profileData, error: profileError } = await Promise.race([
      profilePromise,
      timeoutPromise,
    ])

    if (!isMountedRef.current) return

    const profile = (profileData as DashboardProfile | null) ?? null

    if (profileError || !profile) {
      console.error(
        '[auth] dashboard_profiles query failed or profile missing — denying access',
        profileError
      )
      setError('Profil introuvable. Accès refusé.')
      await supabase.auth.signOut()
      setSession(null)
      setUser(null)
      setIsLoading(false)
      return
    }

    setSession(currentSession)
    setUser({
      supabaseUser: currentSession.user,
      profile,
      role: profile.role,
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
