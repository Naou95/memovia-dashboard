import { useAuth } from '@/contexts/AuthContext'

/**
 * Overview page — placeholder dashboard landing page.
 * Module 2 will fill this with real KPIs (MRR, ARR, active users, etc.)
 */
export default function OverviewPage() {
  const { user } = useAuth()

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          {greeting}, {user?.profile.full_name?.split(' ')[0] ?? 'admin'} 👋
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Voici un aperçu de MEMOVIA AI aujourd'hui.
        </p>
      </div>

      {/* Placeholder metric grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLACEHOLDER_METRICS.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      {/* Module 2 placeholder notice */}
      <div className="mt-8 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          Les métriques temps réel arrivent dans le Module 2.
        </p>
      </div>
    </div>
  )
}

// ── Placeholder metrics ────────────────────────────────────────────────────────
const PLACEHOLDER_METRICS = [
  { label: 'MRR', value: '—', unit: '€', trend: null },
  { label: 'ARR', value: '—', unit: '€', trend: null },
  { label: 'Utilisateurs actifs', value: '—', unit: '', trend: null },
  { label: 'NPS', value: '—', unit: '', trend: null },
]

interface MetricCardProps {
  label: string
  value: string
  unit: string
  trend: string | null
}

function MetricCard({ label, value, unit }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-white p-5">
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <p className="text-2xl font-semibold text-[var(--text-primary)]">
        {value}
        {unit && <span className="ml-1 text-base font-normal text-[var(--text-secondary)]">{unit}</span>}
      </p>
    </div>
  )
}
