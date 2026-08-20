import { ExternalLink, Landmark, TrendingUp, UserPlus, UserMinus } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { KpiCard } from '@/components/shared/KpiCard'
import { useStripeFinance } from '@/hooks/useStripeFinance'
import { useQontoFinance } from '@/hooks/useQontoFinance'
import { TransactionTable } from '@/modules/qonto/components/TransactionTable'
import { TransactionList } from '@/modules/stripe/components/TransactionList'

const fmtEur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

function freshness(ts: number | null): string {
  if (!ts) return ''
  const min = Math.round((Date.now() - ts) / 60000)
  return min <= 1 ? 'à jour il y a < 1 min' : `à jour il y a ${min} min`
}

/**
 * Argent (refonte v2 Phase 4) : Stripe + Qonto fusionnés en un écran.
 * Chaque bloc est un point de lecture ; l'action se fait dans l'outil natif
 * (deep links). Snapshot horodaté, jamais de donnée périmée silencieuse.
 */
export default function ArgentPage() {
  const stripe = useStripeFinance()
  const qonto = useQontoFinance()

  // Runway = solde / burn net moyen des 3 derniers mois. Un burn positif (on
  // gagne de l'argent) n'a pas de runway : on affiche « — ».
  let runway: string | null = null
  if (qonto.data) {
    const flows = qonto.data.monthlyCashFlow.slice(-3)
    const avgNet = flows.length
      ? flows.reduce((s, f) => s + (f.income - f.expenses), 0) / flows.length
      : 0
    runway = avgNet < 0 ? `${Math.floor(qonto.data.balance / -avgNet)} mois` : '—'
  }

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.header variants={staggerItem} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Argent</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Trésorerie et revenus. Pour agir : Qonto ou Stripe directement.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          <a
            href="https://app.qonto.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[var(--memovia-violet)] hover:underline"
          >
            Qonto <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[var(--memovia-violet)] hover:underline"
          >
            Stripe <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </motion.header>

      {/* KPI : est-ce que ça rentre ? */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Solde Qonto"
          value={qonto.data ? fmtEur(qonto.data.balance) : null}
          accent="violet"
          icon={Landmark}
          isLoading={qonto.isLoading}
          error={qonto.error}
        />
        <KpiCard
          label="MRR (Stripe + contrats)"
          value={stripe.data ? fmtEur(stripe.data.mrr_total) : null}
          accent="green"
          icon={TrendingUp}
          isLoading={stripe.isLoading}
          error={stripe.error}
        />
        <KpiCard
          label="Runway (burn 3 mois)"
          value={runway}
          accent="cyan"
          icon={Landmark}
          isLoading={qonto.isLoading}
          error={qonto.error}
        />
        <KpiCard
          label="Abos ce mois (+ / −)"
          value={
            stripe.data ? `+${stripe.data.newThisMonth} / −${stripe.data.churnsThisMonth}` : null
          }
          accent={stripe.data && stripe.data.churnsThisMonth > stripe.data.newThisMonth ? 'red' : 'blue'}
          icon={stripe.data && stripe.data.churnsThisMonth > stripe.data.newThisMonth ? UserMinus : UserPlus}
          isLoading={stripe.isLoading}
          error={stripe.error}
        />
      </motion.div>

      {/* Horodatage : l'honnêteté de la fraîcheur prime sur la fraîcheur */}
      <motion.p variants={staggerItem} className="text-[11px] tabular-nums text-[var(--text-muted)]">
        {[
          qonto.lastFetchedAt ? `Qonto ${freshness(qonto.lastFetchedAt)}` : null,
          stripe.lastFetchedAt ? `Stripe ${freshness(stripe.lastFetchedAt)}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </motion.p>

      {/* Mouvements */}
      <motion.div variants={staggerItem} className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
            Mouvements Qonto
          </h2>
          {qonto.data ? (
            <TransactionTable transactions={qonto.data.transactions} />
          ) : qonto.error ? (
            <p className="text-[13px] text-[var(--danger)]">{qonto.error}</p>
          ) : (
            <div className="h-40 animate-pulse rounded-lg bg-[var(--border-color)]" />
          )}
        </section>
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
            Paiements Stripe
          </h2>
          {stripe.data ? (
            <TransactionList transactions={stripe.data.recentTransactions} />
          ) : stripe.error ? (
            <p className="text-[13px] text-[var(--danger)]">{stripe.error}</p>
          ) : (
            <div className="h-40 animate-pulse rounded-lg bg-[var(--border-color)]" />
          )}
        </section>
      </motion.div>
    </motion.div>
  )
}
