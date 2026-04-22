import { Bug, RefreshCw, AlertTriangle } from 'lucide-react'
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
      className="flex flex-col gap-5 p-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Bug className="h-5 w-5" style={{ color: 'var(--memovia-violet)' }} />
          <div>
            <h1 className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              Monitoring Sentry
            </h1>
            <CacheFreshness timestamp={lastFetchedAt} className="text-[11px]" />
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--bg-primary)] disabled:opacity-50"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Rafraîchir
        </button>
      </motion.div>

      {/* Error state */}
      {error && (
        <motion.div
          variants={staggerItem}
          className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-[13px] text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={refresh}
            className="ml-auto text-[12px] font-medium text-red-600 underline-offset-2 hover:underline dark:text-red-400"
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
