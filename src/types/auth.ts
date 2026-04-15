import type { User, Session } from '@supabase/supabase-js'

export type UserRole = 'admin_full' | 'admin_bizdev'

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

// Helper: extract role from JWT app_metadata (injected by custom_access_token_hook)
export function getRoleFromSession(session: Session | null): UserRole | null {
  if (!session) return null
  const appMeta = session.user?.app_metadata as { role?: UserRole } | undefined
  return appMeta?.role ?? null
}
