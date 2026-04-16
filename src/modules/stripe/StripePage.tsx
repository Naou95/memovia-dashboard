import { DollarSign, TrendingUp, UserPlus, UserMinus, BarChart2, RefreshCw } from 'lucide-react'
import { useStripeFinance, invalidateStripeFinanceCache } from '@/hooks/useStripeFinance'
import { KpiCard } from '@/components/shared/KpiCard'
import { MrrChart } from './components/MrrChart'
import { SubscriptionTable } from './components/SubscriptionTable'
import { TransactionList } from './components/TransactionList'

// ── Formatters ─────────────────────────────────────────────────────────────────

const formatEur = (val: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(val)

// ── Page ───────────────────────────────────────────────────────────────────────

export default function StripePage() {
  const { data, isLoading, error } = useStripeFinance()

  function handleRefresh() {
    invalidateStripeFinanceCache()
    // Force re-mount du hook en remontant la page — simple et fiable
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Stripe & Finance
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Revenus, abonnements et transactions.
            {data?.fetchedAt && (
              <span className="ml-2 text-[var(--text-muted)]">
                Mis à jour {new Date(data.fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent-purple-bg)] hover:text-[var(--memovia-violet)]"
          title="Rafraîchir les données"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Rafraîchir
        </button>
      </header>

      {/* 5 KPI cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="MRR"
          value={data ? formatEur(data.mrr) : null}
          unit="€"
          accent="violet"
          icon={DollarSign}
          isLoading={isLoading}
          error={error}
        />
        <KpiCard
          label="ARR"
          value={data ? formatEur(data.arr) : null}
          unit="€"
          accent="cyan"
          icon={TrendingUp}
          isLoading={isLoading}
          error={error}
        />
        <KpiCard
          label="Nouveaux ce mois"
          value={data ? String(data.newThisMonth) : null}
          accent="green"
          icon={UserPlus}
          isLoading={isLoading}
          error={error}
        />
        <KpiCard
          label="Churns ce mois"
          value={data ? String(data.churnsThisMonth) : null}
          accent="red"
          icon={UserMinus}
          isLoading={isLoading}
          error={error}
        />
        <KpiCard
          label="Revenus 12 mois"
          value={data ? formatEur(data.totalRevenue12mo) : null}
          unit="€"
          accent="blue"
          icon={BarChart2}
          isLoading={isLoading}
          error={error}
        />
      </div>

      {/* Graphique — Revenus facturés 12 mois */}
      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
        <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">
          Revenus facturés — 12 derniers mois
        </h3>
        {isLoading ? (
          <div className="h-[220px] animate-pulse rounded-xl bg-[var(--border-color)]" />
        ) : error ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-[var(--text-muted)]">
            Données indisponibles
          </div>
        ) : (
          <MrrChart data={data!.revenueByMonth} />
        )}
      </section>

      {/* Abonnements actifs */}
      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Abonnements actifs
          </h3>
          {data && (
            <span className="text-[13px] text-[var(--text-muted)]">
              {data.subscriptions.length} abonné{data.subscriptions.length > 1 ? 's' : ''}
            </span>
          )}
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
      </section>

      {/* Transactions récentes */}
      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
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
      </section>
    </div>
  )
}

// ── Skeleton table ──────────────────────────────────────────────────────────────

function SkeletonTable({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-4 flex-1 animate-pulse rounded bg-[var(--border-color)]" />
          <div className="h-4 w-1/4 animate-pulse rounded bg-[var(--border-color)]" />
          <div className="h-4 w-1/6 animate-pulse rounded bg-[var(--border-color)]" />
        </div>
      ))}
    </div>
  )
}
