import { ExternalLink, Landmark, TrendingUp, UserPlus, UserMinus, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { KpiCard } from '@/components/shared/KpiCard'
import { useStripeFinance } from '@/hooks/useStripeFinance'
import { useQontoFinance } from '@/hooks/useQontoFinance'
import { TransactionTable } from '@/modules/qonto/components/TransactionTable'
import { CashFlowChart } from '@/modules/qonto/components/CashFlowChart'
import { CategoryDonut } from '@/modules/qonto/components/CategoryDonut'
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
  // Le rouge est réservé aux vrais problèmes — un runway court en est un :
  // rouge sous 3 mois, cyan sinon.
  let runway: string | null = null
  let runwayMois: number | null = null
  if (qonto.data) {
    const flows = qonto.data.monthlyCashFlow.slice(-3)
    const avgNet = flows.length
      ? flows.reduce((s, f) => s + (f.income - f.expenses), 0) / flows.length
      : 0
    if (avgNet < 0) {
      runwayMois = Math.floor(qonto.data.balance / -avgNet)
      runway = `${runwayMois} mois`
    } else {
      runway = '—'
    }
  }
  const runwayCritique = runwayMois !== null && runwayMois < 3

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
          accent={runwayCritique ? 'red' : 'cyan'}
          icon={runwayCritique ? AlertTriangle : Landmark}
          isLoading={qonto.isLoading}
          error={qonto.error}
        />
        <KpiCard
          label="Abos du mois"
          value={
            stripe.data ? `+${stripe.data.newThisMonth} · −${stripe.data.churnsThisMonth}` : null
          }
          accent={stripe.data && stripe.data.churnsThisMonth > stripe.data.newThisMonth ? 'red' : 'blue'}
          icon={stripe.data && stripe.data.churnsThisMonth > stripe.data.newThisMonth ? UserMinus : UserPlus}
          isLoading={stripe.isLoading}
          error={stripe.error}
        />
      </motion.div>

      {/* Corps (maquette Naoufel 22/08) : zone d'analyse à gauche (donut
          catégories + carte totaux sombre + courbe in/out + table Qonto),
          flux Stripe en rail droit — panneaux standard partout */}
      <motion.div variants={staggerItem} className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_230px]">
            <section className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]">
              <h2 className="mb-3 font-display text-[17px] font-bold text-[var(--text-primary)]">
                Dépenses par catégorie
              </h2>
              {qonto.data ? (
                <CategoryDonut transactions={qonto.data.transactions} days={90} />
              ) : (
                <div className="h-[180px] animate-pulse rounded-lg bg-[var(--border-color)]" />
              )}
            </section>
            {/* Carte totaux — l'accent sombre assumé de la maquette, violet uni */}
            <section
              className="flex flex-col justify-between gap-3 rounded-[var(--radius-card)] p-5 text-white"
              style={{ backgroundColor: '#2E1065', boxShadow: 'var(--shadow-sm)' }}
              aria-label="Totaux sur 3 mois"
            >
              {(() => {
                const flows = qonto.data?.monthlyCashFlow.slice(-3) ?? []
                const tin = flows.reduce((s, f) => s + f.income, 0)
                const tout = flows.reduce((s, f) => s + f.expenses, 0)
                return (
                  <>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-white/60">Entrées 3 mois</p>
                      <p className="tabular-nums text-[22px] font-bold">{qonto.data ? fmtEur(tin) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-white/60">Sorties 3 mois</p>
                      <p className="tabular-nums text-[22px] font-bold">{qonto.data ? fmtEur(tout) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-white/60">Net</p>
                      <p className="tabular-nums text-[22px] font-bold">{qonto.data ? fmtEur(tin - tout) : '—'}</p>
                    </div>
                  </>
                )
              })()}
            </section>
          </div>

          <section className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]">
            <h2 className="mb-3 font-display text-[17px] font-bold text-[var(--text-primary)]">
              Entrées &amp; sorties par mois
            </h2>
            {qonto.data ? (
              <CashFlowChart data={qonto.data.monthlyCashFlow} />
            ) : (
              <div className="h-[260px] animate-pulse rounded-lg bg-[var(--border-color)]" />
            )}
          </section>

          <section className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">
                Mouvements Qonto
              </h2>
              {qonto.lastFetchedAt && (
                <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                  {freshness(qonto.lastFetchedAt)}
                </span>
              )}
            </div>
            {qonto.data ? (
              <TransactionTable transactions={qonto.data.transactions} />
            ) : qonto.error ? (
              <p className="text-[13px] text-[var(--danger)]">{qonto.error}</p>
            ) : (
              <div className="h-40 animate-pulse rounded-lg bg-[var(--border-color)]" />
            )}
          </section>
        </div>

        <section className="min-w-0 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">
              Paiements Stripe
            </h2>
            {stripe.lastFetchedAt && (
              <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                {freshness(stripe.lastFetchedAt)}
              </span>
            )}
          </div>
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
