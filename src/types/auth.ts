import type { User, Session } from '@supabase/supabase-js'

export type UserRole = 'admin_full' | 'admin_bizdev'

/** Fallback role when neither the JWT nor the DB profile provides one. */
export const DEFAULT_ROLE: UserRole = 'admin_bizdev'

export interface DashboardProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface AuthUser {
  supabaseUser: User
  profile: DashboardProfile
  role: UserRole
}

export interface AuthContextValue {
  user: AuthUser | null
  session: Session | null
  isLoading: boolean
  error: string | null
  signInWithPassword: (email: string, password: string) => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

/**
 * Extract the dashboard role from the JWT's app_metadata.
 * Supports both `dashboard_role` (current custom_access_token_hook convention)
 * and `role` (legacy). Returns null when the hook is disabled or the claim is
 * missing — callers must fall back to the DB profile or DEFAULT_ROLE.
 */
export function getRoleFromSession(session: Session | null): UserRole | null {
  if (!session) return null
  const appMeta = session.user?.app_metadata as
    | { dashboard_role?: UserRole; role?: UserRole }
    | undefined
  return appMeta?.dashboard_role ?? appMeta?.role ?? null
}
