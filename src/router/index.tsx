import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth } from '@/components/auth/RequireAuth'
import AppLayout from '@/components/layout/AppLayout'

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────
const LoginPage = lazy(() => import('@/components/auth/LoginPage'))
const OverviewPage = lazy(() => import('@/modules/overview/OverviewPage'))
const StripePage = lazy(() => import('@/modules/stripe/StripePage'))
const QontoPage = lazy(() => import('@/modules/qonto/QontoPage'))
const ContractsPage = lazy(() => import('@/modules/contracts/ContractsPage'))
const ProspectionPage = lazy(() => import('@/modules/prospection/ProspectionPage'))
const TasksPage = lazy(() => import('@/modules/tasks/TasksPage'))
const CalendarPage = lazy(() => import('@/modules/calendar/CalendarPage'))
const UtilisateursPage = lazy(() => import('@/modules/utilisateurs/UtilisateursPage'))
const RealtimePage = lazy(() => import('@/modules/realtime/RealtimePage'))
const MonitoringPage = lazy(() => import('@/modules/monitoring/MonitoringPage'))
const RoadmapPage = lazy(() => import('@/modules/roadmap/RoadmapPage'))
const EmailPage = lazy(() => import('@/modules/email/EmailPage'))
const GitHubPage = lazy(() => import('@/modules/github/GitHubPage'))
const SeoPage = lazy(() => import('@/modules/seo/SeoPage'))
const ApiCostsPage = lazy(() => import('@/modules/api-costs/ApiCostsPage'))
const AnalyticsPage = lazy(() => import('@/modules/analytics/AnalyticsPage'))
const CopilotPage = lazy(() => import('@/modules/copilot/CopilotPage'))
const AdminPage = lazy(() => import('@/modules/admin/AdminPage'))

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
      {
        path: 'stripe',
        element: (
          <Suspense fallback={<PageLoader />}>
            <StripePage />
          </Suspense>
        ),
      },
      {
        path: 'qonto',
        element: (
          <Suspense fallback={<PageLoader />}>
            <QontoPage />
          </Suspense>
        ),
      },
      {
        path: 'contracts',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ContractsPage />
          </Suspense>
        ),
      },
      {
        path: 'prospection',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProspectionPage />
          </Suspense>
        ),
      },
      {
        path: 'taches',
        element: (
          <Suspense fallback={<PageLoader />}>
            <TasksPage />
          </Suspense>
        ),
      },
      {
        path: 'calendrier',
        element: (
          <Suspense fallback={<PageLoader />}>
            <CalendarPage />
          </Suspense>
        ),
      },
      {
        path: 'utilisateurs',
        element: (
          <Suspense fallback={<PageLoader />}>
            <UtilisateursPage />
          </Suspense>
        ),
      },
      {
        path: 'realtime',
        element: (
          <Suspense fallback={<PageLoader />}>
            <RealtimePage />
          </Suspense>
        ),
      },
      {
        path: 'monitoring',
        element: (
          <Suspense fallback={<PageLoader />}>
            <MonitoringPage />
          </Suspense>
        ),
      },
      {
        path: 'roadmap',
        element: (
          <Suspense fallback={<PageLoader />}>
            <RoadmapPage />
          </Suspense>
        ),
      },
      {
        path: 'email-drafter',
        element: (
          <Suspense fallback={<PageLoader />}>
            <EmailPage />
          </Suspense>
        ),
      },
      {
        path: 'github',
        element: (
          <Suspense fallback={<PageLoader />}>
            <GitHubPage />
          </Suspense>
        ),
      },
      {
        path: 'seo',
        element: (
          <Suspense fallback={<PageLoader />}>
            <SeoPage />
          </Suspense>
        ),
      },
      {
        path: 'couts-api',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ApiCostsPage />
          </Suspense>
        ),
      },
      {
        path: 'analytics',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AnalyticsPage />
          </Suspense>
        ),
      },
      {
        path: 'copilot',
        element: (
          <Suspense fallback={<PageLoader />}>
            <CopilotPage />
          </Suspense>
        ),
      },
      {
        path: 'admin',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminPage />
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
