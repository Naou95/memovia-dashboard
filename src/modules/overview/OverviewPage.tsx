import { DollarSign, Users, Landmark, UserMinus, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useOverviewKpis } from '@/hooks/useOverviewKpis'

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

// ── KPI card ───────────────────────────────────────────────────────────────────
type AccentKey = 'violet' | 'cyan' | 'blue' | 'red'

interface KpiCardProps {
  label: string
  /** null = données non encore disponibles (afficher skeleton) */
  value: string | null
  unit?: string
  accent: AccentKey
  icon: React.ElementType
  isLoading: boolean
  error: string | null
}

const ACCENT_MAP: Record<AccentKey, { bg: string; fg: string }> = {
  violet: { bg: 'var(--accent-purple-bg)', fg: 'var(--accent-purple)' },
  cyan: { bg: 'color-mix(in oklab, var(--memovia-cyan) 20%, white)', fg: 'var(--memovia-cyan)' },
  blue: { bg: 'var(--accent-blue-bg)', fg: 'var(--accent-blue)' },
  red: { bg: 'var(--trend-down-bg)', fg: 'var(--trend-down-text)' },
}

function KpiCard({ label, value, unit, accent, icon: Icon, isLoading, error }: KpiCardProps) {
  const colors = ACCENT_MAP[accent]

  return (
    <article className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.bg }}
          >
            <Icon className="h-4 w-4" style={{ color: colors.fg }} strokeWidth={2.25} />
          </div>
          <span className="text-[13px] font-medium text-[var(--text-secondary)]">
            {label}
          </span>
        </div>

        {/* Indicateur d'erreur discret */}
        {error && !isLoading && (
          <div title={error}>
            <AlertCircle className="h-4 w-4 text-[var(--danger)]" />
          </div>
        )}
      </div>

      {/* Valeur : skeleton → erreur → vraie valeur */}
      {isLoading ? (
        <div className="h-8 w-28 animate-pulse rounded-md bg-[var(--border-color)]" />
      ) : error ? (
        <p className="text-sm text-[var(--text-muted)]">Indisponible</p>
      ) : (
        <p className="text-[26px] font-semibold leading-none tracking-tight text-[var(--text-primary)] tabular-nums">
          {value}
          {unit && (
            <span className="ml-1 text-base font-normal text-[var(--text-muted)]">{unit}</span>
          )}
        </p>
      )}
    </article>
  )
}
