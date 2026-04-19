import { DollarSign, TrendingUp, UserPlus, UserMinus, BarChart2, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import { useStripeFinance, invalidateStripeFinanceCache } from '@/hooks/useStripeFinance'
import { KpiCard } from '@/components/shared/KpiCard'
import { MrrChart } from './components/MrrChart'
import { SubscriptionTable } from './components/SubscriptionTable'
import { TransactionList } from './components/TransactionList'
import { CancellationSection } from './components/CancellationSection'
import { staggerContainer, staggerItem, cardGridContainer, staggerCard } from '@/lib/motion'

// ── Formatters ─────────────────────────────────────────────────────────────────

const frNum = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const formatEur = (val: number) => frNum.format(val)

// ── Page ───────────────────────────────────────────────────────────────────────

export default function StripePage() {
  const { data, isLoading, error } = useStripeFinance()

  function handleRefresh() {
    invalidateStripeFinanceCache()
    window.location.reload()
  }

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.header variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Stripe & Finance
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Revenus, abonnements et transactions.
            {data?.fetchedAt && (
              <span className="ml-2 tabular-nums text-[var(--text-muted)]">
                Mis à jour {new Date(data.fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--memovia-violet-light)] hover:text-[var(--memovia-violet)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Rafraîchir les données Stripe"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Rafraîchir
        </button>
      </motion.header>

      {/* 5 KPI cards */}
      <motion.div
        variants={cardGridContainer}
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5"
      >
        <motion.div variants={staggerCard}>
          <KpiCard
            label="MRR"
            value={data ? formatEur(data.mrr) : null}
            rawValue={data?.mrr}
            formatter={formatEur}
            unit="€"
            accent="violet"
            icon={DollarSign}
            isLoading={isLoading}
            error={error}
            sensitive
          />
        </motion.div>
        <motion.div variants={staggerCard}>
          <KpiCard
            label="ARR"
            value={data ? formatEur(data.arr) : null}
            rawValue={data?.arr}
            formatter={formatEur}
            unit="€"
            accent="cyan"
            icon={TrendingUp}
            isLoading={isLoading}
            error={error}
            sensitive
          />
        </motion.div>
        <motion.div variants={staggerCard}>
          <KpiCard
            label="Nouveaux ce mois"
            value={data ? String(data.newThisMonth) : null}
            rawValue={data?.newThisMonth}
            accent="green"
            icon={UserPlus}
            isLoading={isLoading}
            error={error}
          />
        </motion.div>
        <motion.div variants={staggerCard}>
          <KpiCard
            label="Churns ce mois"
            value={data ? String(data.churnsThisMonth) : null}
            rawValue={data?.churnsThisMonth}
            accent="red"
            icon={UserMinus}
            isLoading={isLoading}
            error={error}
          />
        </motion.div>
        <motion.div variants={staggerCard}>
          <KpiCard
            label="Revenus 12 mois"
            value={data ? formatEur(data.totalRevenue12mo) : null}
            rawValue={data?.totalRevenue12mo}
            formatter={formatEur}
            unit="€"
            accent="blue"
            icon={BarChart2}
            isLoading={isLoading}
            error={error}
            sensitive
          />
        </motion.div>
      </motion.div>

      {/* Graphique — Revenus facturés 12 mois */}
      <motion.section
        variants={staggerItem}
        className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5"
      >
        <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">
          Revenus facturés — 12 derniers mois
        </h3>
        {isLoading ? (
          <div className="skeleton h-[220px] rounded-xl" />
        ) : error ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-[var(--text-muted)]">
            Données indisponibles
          </div>
        ) : (
          <MrrChart data={data!.revenueByMonth} />
        )}
      </motion.section>

      {/* Annulations en cours */}
      {data && (
        <motion.div variants={staggerItem}>
          <CancellationSection subscriptions={data.subscriptions} />
        </motion.div>
      )}

      {/* Abonnements actifs */}
      <motion.section
        variants={staggerItem}
        className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Abonnements actifs
          </h3>
          {data && (() => {
            const activeCount = data.subscriptions.filter(s => !s.cancelAtPeriodEnd).length
            const cancelingCount = data.subscriptions.filter(s => s.cancelAtPeriodEnd).length
            return (
              <span className="text-[13px] text-[var(--text-muted)]">
                {activeCount} actifs
                {cancelingCount > 0 && (
                  <span className="text-[var(--danger)]"> · {cancelingCount} annulation{cancelingCount > 1 ? 's' : ''} en cours</span>
                )}
              </span>
            )
          })()}
        </div>
        {isLoading ? (
          <SkeletonTable rows={4} />
        ) : error ? (
          <div className="flex h-24 items-center justify-center text-sm text-[var(--text-muted)]">
            Données indisponibles
          </div>
        ) : (
          <SubscriptionTable subscriptions={data!.subscriptions} />
        )}
      </motion.section>

      {/* Transactions récentes */}
      <motion.section
        variants={staggerItem}
        className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Transactions récentes
          </h3>
          <span className="text-[13px] text-[var(--text-muted)]">20 dernières</span>
        </div>
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : error ? (
          <div className="flex h-24 items-center justify-center text-sm text-[var(--text-muted)]">
            Données indisponibles
          </div>
        ) : (
          <TransactionList transactions={data!.recentTransactions} />
        )}
      </motion.section>
    </motion.div>
  )
}

// ── Skeleton table ──────────────────────────────────────────────────────────────

function SkeletonTable({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="skeleton h-4 flex-1 rounded" />
          <div className="skeleton h-4 w-1/4 rounded" />
          <div className="skeleton h-4 w-1/6 rounded" />
        </div>
      ))}
    </div>
  )
}
