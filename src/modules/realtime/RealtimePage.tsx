import { RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useRealtimePresence } from '@/hooks/useRealtimePresence'
import { RealtimeStats } from './components/RealtimeStats'
import { ActivityChart } from './components/ActivityChart'
import { ActivityFeed } from './components/ActivityFeed'

function formatTime(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function RealtimePage() {
  const { stats, recentUsers, hourlyData, isLoading, error, lastRefresh, isConnected, refresh } =
    useRealtimePresence()

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <motion.header variants={staggerItem} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tighter text-[var(--text-primary)]">
              Realtime
            </h2>
            {/* Live indicator */}
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
              style={{
                backgroundColor: isConnected
                  ? 'color-mix(in oklab, #22c55e 15%, white)'
                  : 'var(--bg-primary)',
                color: isConnected ? '#16a34a' : 'var(--text-muted)',
                border: `1px solid ${isConnected ? '#bbf7d0' : 'var(--border-color)'}`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: isConnected ? '#22c55e' : 'var(--text-muted)',
                  animation: isConnected ? 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' : 'none',
                }}
              />
              {isConnected ? 'Live' : 'Polling'}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Connexions live sur app.memovia.io — rafraîchissement toutes les 30s.
          </p>
        </div>

        {/* Refresh + last sync */}
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[12px] text-[var(--text-muted)]">
              Mis à jour {formatTime(lastRefresh)}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-primary)] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
              strokeWidth={2}
            />
            Rafraîchir
          </button>
        </div>
      </motion.header>

      {/* ── Error ─────────────────────────────────────────────────────────────── */}
      {error && !isLoading && (
        <motion.div variants={staggerItem} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </motion.div>
      )}

      {/* ── KPI Stats ─────────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem}>
        <RealtimeStats stats={stats} isLoading={isLoading} error={error} />
      </motion.div>

      {/* ── Hourly Chart ──────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem}>
        <ActivityChart data={hourlyData} isLoading={isLoading} />
      </motion.div>

      {/* ── Activity Feed ─────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem}>
        <ActivityFeed users={recentUsers} isLoading={isLoading} />
      </motion.div>

      {/* ── Footer note ───────────────────────────────────────────────────────── */}
      {!isLoading && (
        <motion.p variants={staggerItem} className="text-center text-[12px] text-[var(--text-muted)]">
          Basé sur last_sign_in_at · données Supabase Auth · lecture seule
        </motion.p>
      )}
    </motion.div>
  )
}
