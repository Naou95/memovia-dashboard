import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth } from '@/components/auth/RequireAuth'
import AppLayout from '@/components/layout/AppLayout'

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────
const LoginPage = lazy(() => import('@/components/auth/LoginPage'))
const OverviewPage = lazy(() => import('@/modules/overview/OverviewPage'))

// ── Loading fallback ───────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-[var(--memovia-violet)] border-t-transparent" />
    </div>
  )
}

// ── Router ─────────────────────────────────────────────────────────────────────
export const router = createBrowserRouter([
  // Public routes
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    ),
  },

  // Protected routes — wrapped in RequireAuth + AppLayout
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      // Root redirects to /overview
      {
        index: true,
        element: <Navigate to="/overview" replace />,
      },
      {
        path: 'overview',
        element: (
          <Suspense fallback={<PageLoader />}>
            <OverviewPage />
          </Suspense>
        ),
      },
    ],
  },

  // Catch-all — redirect unknown routes to /overview (auth will gate)
  {
    path: '*',
    element: <Navigate to="/overview" replace />,
  },
])
