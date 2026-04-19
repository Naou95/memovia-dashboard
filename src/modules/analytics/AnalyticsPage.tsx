import { RefreshCw, Users, Eye, UserPlus, Sparkles, Activity, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem, cardGridContainer, staggerCard } from '@/lib/motion'
import { usePostHogApp, useAnalyticsSupabase, invalidateAllAnalyticsCache } from '@/hooks/useAnalytics'
import { KpiCard } from '@/components/shared/KpiCard'
import { VisitorsChart } from './components/VisitorsChart'
import { TopPagesTable } from './components/TopPagesTable'
import { TrafficSourcesTable } from './components/TrafficSourcesTable'

const POSTHOG_URL = 'https://eu.posthog.com/project/162131'

export default function AnalyticsPage() {
  const { data, isLoading, error } = usePostHogApp()
  const { data: supabaseData, isLoading: supabaseLoading, error: supabaseError } = useAnalyticsSupabase()

  const combinedLoading = isLoading || supabaseLoading
  const combinedError = error ?? supabaseError ?? null

  function handleRefresh() {
    invalidateAllAnalyticsCache()
    window.location.reload()
  }

  const totalSessions = data?.trafficSources.reduce((s, src) => s + src.count, 0) ?? 0

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      {/* Header */}
      <motion.header variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tighter text-[var(--text-primary)]">
            Analytics
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Trafic et événements PostHog — 7 derniers jours.
            {data?.fetchedAt && (
              <span className="ml-2 text-[var(--text-muted)]">
                Mis à jour à{' '}
                {new Date(data.fetchedAt).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={POSTHOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent-purple-bg)] hover:text-[var(--memovia-violet)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Voir dans PostHog
          </a>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent-purple-bg)] hover:text-[var(--memovia-violet)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Rafraîchir
          </button>
        </div>
      </motion.header>

      {/* Error */}
      {combinedError && (
        <motion.div
          variants={staggerItem}
          className="rounded-xl border border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_8%,white)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          {combinedError}
        </motion.div>
      )}

      {/* KPI cards */}
      <motion.div variants={cardGridContainer} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <motion.div variants={staggerCard}>
          <KpiCard
            label="Visiteurs uniques 7j"
            value={data ? data.uniqueVisitors7d.toLocaleString('fr-FR') : null}
            rawValue={data?.uniqueVisitors7d}
            accent="violet"
            icon={Users}
            isLoading={isLoading}
            error={error}
            trend={data?.visitorsDaily.map((d) => d.visitors)}
          />
        </motion.div>
        <motion.div variants={staggerCard}>
          <KpiCard
            label="Pageviews 7j"
            value={data ? data.pageviews7d.toLocaleString('fr-FR') : null}
            rawValue={data?.pageviews7d}
            accent="cyan"
            icon={Eye}
            isLoading={isLoading}
            error={error}
          />
        </motion.div>
        <motion.div variants={staggerCard}>
          <KpiCard
            label="Inscriptions 7j"
            value={supabaseData ? supabaseData.inscriptions.total7d.toLocaleString('fr-FR') : null}
            rawValue={supabaseData?.inscriptions.total7d}
            accent="green"
            icon={UserPlus}
            isLoading={supabaseLoading}
            error={supabaseError}
          />
        </motion.div>
        <motion.div variants={staggerCard}>
          <KpiCard
            label="Générations 7j"
            value={supabaseData ? supabaseData.generations.total7d.toLocaleString('fr-FR') : null}
            rawValue={supabaseData?.generations.total7d}
            accent="blue"
            icon={Sparkles}
            isLoading={supabaseLoading}
            error={supabaseError}
          />
        </motion.div>
      </motion.div>

      {/* Sessions today chip */}
      {!combinedLoading && data !== null && (
        <motion.div variants={staggerItem} className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium"
            style={{
              backgroundColor: 'var(--accent-purple-bg)',
              color: 'var(--memovia-violet)',
            }}
          >
            <Activity className="h-3.5 w-3.5" />
            {data.sessionsToday.toLocaleString('fr-FR')} session{data.sessionsToday !== 1 ? 's' : ''} aujourd'hui
          </div>
        </motion.div>
      )}

      {/* Visitors chart */}
      <motion.section
        variants={staggerItem}
        className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5"
      >
        <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">
          Évolution des visiteurs uniques — 7 jours
        </h3>
        {isLoading ? (
          <div className="h-[220px] skeleton rounded-xl" />
        ) : data?.visitorsDaily.length ? (
          <VisitorsChart data={data.visitorsDaily} />
        ) : (
          <div className="flex h-[220px] items-center justify-center text-sm text-[var(--text-muted)]">
            Données indisponibles
          </div>
        )}
      </motion.section>

      {/* Tables row */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top pages */}
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
          <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">
            Top pages
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-8 rounded-lg" />
              ))}
            </div>
          ) : (
            <TopPagesTable pages={data?.topPages ?? []} />
          )}
        </section>

        {/* Traffic sources */}
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
          <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">
            Sources de trafic
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-8 rounded-lg" />
              ))}
            </div>
          ) : (
            <TrafficSourcesTable sources={data?.trafficSources ?? []} total={totalSessions} />
          )}
        </section>
      </motion.div>
    </motion.div>
  )
}
