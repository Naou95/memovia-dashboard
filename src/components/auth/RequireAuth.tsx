import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface RequireAuthProps {
  children: React.ReactNode
}

/**
 * Route guard: redirects to /login if not authenticated.
 * Shows nothing while auth is initializing (isLoading = true).
 * Preserves the intended destination in location state for post-login redirect.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  // Don't flash the login page while restoring session from localStorage
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--memovia-violet)] border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
