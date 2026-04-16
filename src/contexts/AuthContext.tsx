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
import { DEFAULT_ROLE, getRoleFromSession } from '@/types/auth'

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
    // Using getSession().then() in parallel caused a race where the query ran
    // before auth headers were set, returning null → synthesizeProfile fallback.
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
  // Tries to fetch the dashboard_profiles row. If it's missing or the query
  // fails/times out (e.g. the custom_access_token_hook is disabled and RLS
  // can't resolve), we still admit the user with a synthesized profile so the
  // login flow doesn't hang. The session on its own is treated as enough to
  // enter the dashboard — the DB row only enriches the profile.
  async function loadUserProfile(currentSession: Session): Promise<void> {
    if (!isMountedRef.current) return

    const jwtRole = getRoleFromSession(currentSession)

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

    if (profileError) {
      console.warn(
        '[auth] dashboard_profiles query failed — falling back to auth metadata',
        profileError
      )
    }

    // DB profile is source of truth for role; JWT then user_metadata as fallback
    const metaRole = currentSession.user?.user_metadata?.role as DashboardProfile['role'] | undefined
    const effectiveRole = profile?.role ?? jwtRole ?? metaRole ?? DEFAULT_ROLE
    const effectiveProfile: DashboardProfile = profile ?? synthesizeProfile(currentSession, effectiveRole)

    setSession(currentSession)
    setUser({
      supabaseUser: currentSession.user,
      profile: effectiveProfile,
      role: effectiveRole,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function synthesizeProfile(session: Session, role: DashboardProfile['role']): DashboardProfile {
  const { user: authUser } = session
  const fullName =
    (authUser.user_metadata?.full_name as string | undefined) ??
    (authUser.user_metadata?.name as string | undefined) ??
    authUser.email?.split('@')[0] ??
    'Utilisateur'

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    full_name: fullName,
    role,
    avatar_url: (authUser.user_metadata?.avatar_url as string | undefined) ?? null,
    created_at: authUser.created_at ?? new Date().toISOString(),
    updated_at: authUser.updated_at ?? new Date().toISOString(),
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return ctx
}
