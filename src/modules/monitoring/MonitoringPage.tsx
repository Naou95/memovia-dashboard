import { RefreshCw, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useSentry } from '@/hooks/useSentry'
import { CacheFreshness } from '@/components/shared/CacheFreshness'
import { MonitoringKPIs, MonitoringKPIsSkeleton } from './components/MonitoringKPIs'
import { IssueList, IssueListSkeleton } from './components/IssueList'

export default function MonitoringPage() {
  const { data, isLoading, error, refresh, lastFetchedAt } = useSentry()

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Monitoring Sentry
          </h2>
          <CacheFreshness timestamp={lastFetchedAt} className="mt-1 text-[12px]" />
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 text-[12px] font-medium text-[var(--text-secondary)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Rafraîchir
        </button>
      </motion.div>

      {/* Error state */}
      {error && (
        <motion.div
          variants={staggerItem}
          className="flex items-center gap-3 rounded-[8px] border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-3"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--danger)]" />
          <p className="text-[13px] text-[var(--danger)]">{error}</p>
          <button
            onClick={refresh}
            className="ml-auto text-[12px] font-medium text-[var(--danger)] underline-offset-2 hover:underline"
          >
            Réessayer
          </button>
        </motion.div>
      )}

      {/* KPI Cards */}
      <motion.div variants={staggerItem}>
        {isLoading ? (
          <MonitoringKPIsSkeleton />
        ) : data ? (
          <MonitoringKPIs stats={data.stats} />
        ) : null}
      </motion.div>

      {/* Issues list */}
      <motion.div variants={staggerItem}>
        {isLoading ? (
          <IssueListSkeleton />
        ) : data ? (
          <IssueList issues={data.issues} />
        ) : null}
      </motion.div>
    </motion.div>
  )
}
