import { DollarSign, Users, Landmark, UserMinus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useOverviewKpis } from '@/hooks/useOverviewKpis'
import { KpiCard } from '@/components/shared/KpiCard'

// ── Formatters ─────────────────────────────────────────────────────────────────

/** "12 430" (séparateur de milliers français, pas de décimales) */
const formatEur = (val: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(val)

// ── Page ───────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { user } = useAuth()
  const { stripe, qonto, stripeError, qontoError, isLoading } = useOverviewKpis()

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const firstName = user?.profile.full_name?.split(' ')[0] ?? 'admin'

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          {greeting}, {firstName}
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Voici un aperçu de MEMOVIA AI aujourd'hui.
        </p>
      </header>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="MRR"
          value={stripe ? formatEur(stripe.mrr) : null}
          unit="€"
          accent="violet"
          icon={DollarSign}
          isLoading={isLoading}
          error={stripeError}
        />
        <KpiCard
          label="Abonnés actifs"
          value={stripe ? String(stripe.activeSubscribers) : null}
          accent="cyan"
          icon={Users}
          isLoading={isLoading}
          error={stripeError}
        />
        <KpiCard
          label="Solde Qonto"
          value={qonto ? formatEur(qonto.balance) : null}
          unit="€"
          accent="blue"
          icon={Landmark}
          isLoading={isLoading}
          error={qontoError}
        />
        <KpiCard
          label="Annulations en cours"
          value={stripe ? String(stripe.cancelingAtPeriodEnd) : null}
          accent="red"
          icon={UserMinus}
          isLoading={isLoading}
          error={stripeError}
        />
      </div>
    </div>
  )
}
