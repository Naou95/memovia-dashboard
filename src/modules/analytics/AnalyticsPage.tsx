import { useState } from 'react'
import { RefreshCw, Users, Eye, UserPlus, Sparkles, Activity, ExternalLink, Megaphone } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem, cardGridContainer, staggerCard } from '@/lib/motion'
import {
  usePostHogApp,
  usePostHogWeb,
  useAnalyticsSupabase,
  invalidateAllAnalyticsCache,
} from '@/hooks/useAnalytics'
import { KpiCard } from '@/components/shared/KpiCard'
import { VisitorsChart } from './components/VisitorsChart'
import { GenerationsChart } from './components/GenerationsChart'
import { TopPagesTable } from './components/TopPagesTable'
import { TrafficSourcesTable } from './components/TrafficSourcesTable'

const POSTHOG_URL = 'https://eu.posthog.com/project/162131'

type TabId = 'app' | 'web'

// Inner component — all hooks live here, remounts on refreshKey change
function AnalyticsContent({
  activeTab,
}: {
  activeTab: TabId
}) {
  // Load all three hooks unconditionally so data prefetches in background
  const { data: appData, isLoading: appLoading, error: appError } = usePostHogApp()
  const { data: webData, isLoading: webLoading, error: webError } = usePostHogWeb()
  const { data: supabaseData, isLoading: supabaseLoading, error: supabaseError } = useAnalyticsSupabase()

  // Per-tab derived values
  const appTotalSessions = appData?.trafficSources.reduce((s, src) => s + src.count, 0) ?? 0
  const webTotalSessions = webData?.trafficSources.reduce((s, src) => s + src.count, 0) ?? 0

  // Active tab error / loading
  const activeError = activeTab === 'app'
    ? (appError ?? supabaseError ?? null)
    : (webError ?? null)

  return (
    <>
      {/* Error banner for active tab */}
      {activeError && (
        <motion.div
          variants={staggerItem}
          className="rounded-xl border border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_8%,white)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          {activeError}
        </motion.div>
      )}

      {/* ── Tab 1 — app.memovia.io ───────────────────────────────────────────── */}
      {activeTab === 'app' && (
        <>
          {/* KPI cards */}
          <motion.div variants={cardGridContainer} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <motion.div variants={staggerCard}>
              <KpiCard
                label="Visiteurs uniques 7j"
                value={appData ? appData.uniqueVisitors7d.toLocaleString('fr-FR') : null}
                rawValue={appData?.uniqueVisitors7d}
                accent="violet"
                icon={Users}
                isLoading={appLoading}
                error={appError}
                trend={appData?.visitorsDaily.map((d) => d.visitors)}
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
          {!appLoading && appData !== null && (
            <motion.div variants={staggerItem} className="flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium"
                style={{
                  backgroundColor: 'var(--accent-purple-bg)',
                  color: 'var(--memovia-violet)',
                }}
              >
                <Activity className="h-3.5 w-3.5" />
                {appData.sessionsToday.toLocaleString('fr-FR')} session{appData.sessionsToday !== 1 ? 's' : ''} aujourd'hui
              </div>
            </motion.div>
          )}

          {/* Generations chart */}
          <motion.section
            variants={staggerItem}
            className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5"
          >
            <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">
              Générations par jour — 7 jours
            </h3>
            {supabaseLoading ? (
              <div className="h-[220px] skeleton rounded-xl" />
            ) : supabaseData?.generations.byDay.length ? (
              <GenerationsChart data={supabaseData.generations.byDay} />
            ) : (
              <div className="flex h-[220px] items-center justify-center text-sm text-[var(--text-muted)]">
                Données indisponibles
              </div>
            )}
          </motion.section>

          {/* Tables row */}
          <motion.div variants={staggerItem} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
              <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">Top pages</h3>
              {appLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton h-8 rounded-lg" />
                  ))}
                </div>
              ) : (
                <TopPagesTable pages={appData?.topPages ?? []} />
              )}
            </section>
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
              <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">Sources de trafic</h3>
              {appLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton h-8 rounded-lg" />
                  ))}
                </div>
              ) : (
                <TrafficSourcesTable sources={appData?.trafficSources ?? []} total={appTotalSessions} />
              )}
            </section>
          </motion.div>
        </>
      )}

      {/* ── Tab 2 — memovia.io ───────────────────────────────────────────────── */}
      {activeTab === 'web' && (
        <>
          {/* KPI cards */}
          <motion.div variants={cardGridContainer} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <motion.div variants={staggerCard}>
              <KpiCard
                label="Visiteurs uniques 7j"
                value={webData ? webData.uniqueVisitors7d.toLocaleString('fr-FR') : null}
                rawValue={webData?.uniqueVisitors7d}
                accent="violet"
                icon={Users}
                isLoading={webLoading}
                error={webError}
                trend={webData?.visitorsDaily.map((d) => d.visitors)}
              />
            </motion.div>
            <motion.div variants={staggerCard}>
              <KpiCard
                label="Pageviews 7j"
                value={webData ? webData.pageviews7d.toLocaleString('fr-FR') : null}
                rawValue={webData?.pageviews7d}
                accent="cyan"
                icon={Eye}
                isLoading={webLoading}
                error={webError}
              />
            </motion.div>
          </motion.div>

          {/* Événements marketing */}
          <motion.section variants={staggerItem}>
            <h3 className="mb-3 text-[14px] font-semibold text-[var(--text-primary)]">
              Événements marketing
            </h3>
            {webLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-16 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: 'var(--accent-purple-bg)' }}
                  >
                    <Megaphone className="h-4 w-4" style={{ color: 'var(--memovia-violet)' }} />
                  </div>
                  <div>
                    <p className="text-[13px] text-[var(--text-secondary)]">Démos demandées</p>
                    <p className="text-[18px] font-semibold tabular-nums text-[var(--text-primary)]">
                      {(webData?.events.demo_demandee ?? 0).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: 'color-mix(in oklab, var(--accent-cyan, #06b6d4) 12%, transparent)' }}
                  >
                    <Eye className="h-4 w-4" style={{ color: 'var(--accent-cyan, #06b6d4)' }} />
                  </div>
                  <div>
                    <p className="text-[13px] text-[var(--text-secondary)]">Tarifs consultés</p>
                    <p className="text-[18px] font-semibold tabular-nums text-[var(--text-primary)]">
                      {(webData?.events.tarifs_vus ?? 0).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: 'color-mix(in oklab, var(--accent-green, #22c55e) 12%, transparent)' }}
                  >
                    <Activity className="h-4 w-4" style={{ color: 'var(--accent-green, #22c55e)' }} />
                  </div>
                  <div>
                    <p className="text-[13px] text-[var(--text-secondary)]">Articles lus</p>
                    <p className="text-[18px] font-semibold tabular-nums text-[var(--text-primary)]">
                      {(webData?.events.article_lu ?? 0).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.section>

          {/* Visitors chart */}
          <motion.section
            variants={staggerItem}
            className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5"
          >
            <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">
              Évolution des visiteurs uniques — 7 jours
            </h3>
            {webLoading ? (
              <div className="h-[220px] skeleton rounded-xl" />
            ) : webData?.visitorsDaily.length ? (
              <VisitorsChart data={webData.visitorsDaily} />
            ) : (
              <div className="flex h-[220px] items-center justify-center text-sm text-[var(--text-muted)]">
                Données indisponibles
              </div>
            )}
          </motion.section>

          {/* Tables row */}
          <motion.div variants={staggerItem} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
              <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">Top pages</h3>
              {webLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton h-8 rounded-lg" />
                  ))}
                </div>
              ) : (
                <TopPagesTable pages={webData?.topPages ?? []} />
              )}
            </section>
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
              <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">Sources de trafic</h3>
              {webLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton h-8 rounded-lg" />
                  ))}
                </div>
              ) : (
                <TrafficSourcesTable sources={webData?.trafficSources ?? []} total={webTotalSessions} />
              )}
            </section>
          </motion.div>
        </>
      )}
    </>
  )
}

export default function AnalyticsPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState<TabId>('app')

  function handleRefresh() {
    invalidateAllAnalyticsCache()
    setRefreshKey((k) => k + 1)
  }

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      {/* Header */}
      <motion.header variants={staggerItem} className="flex flex-wrap items-center gap-4">
        {/* Title */}
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-semibold tracking-tighter text-[var(--text-primary)]">
            Analytics
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Trafic et événements PostHog — 7 derniers jours.
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-1">
          <button
            onClick={() => setActiveTab('app')}
            className={`flex-1 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
              activeTab === 'app'
                ? 'bg-[var(--memovia-violet)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            app.memovia.io
          </button>
          <button
            onClick={() => setActiveTab('web')}
            className={`flex-1 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
              activeTab === 'web'
                ? 'bg-[var(--memovia-violet)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            memovia.io
          </button>
        </div>

        {/* Actions */}
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

      {/* Content — remounts on refresh via key change */}
      <AnalyticsContent key={refreshKey} activeTab={activeTab} />
    </motion.div>
  )
}
