import { Bug, RefreshCw, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SentryStats } from '@/types/sentry'

interface Props {
  stats: SentryStats
}

interface KpiCardProps {
  icon: ReactNode
  label: string
  value: number
  accent: string
}

function KpiCard({ icon, label, value, accent }: KpiCardProps) {
  const isCssVar = accent.startsWith('var(')
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border px-4 py-3"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={
          isCssVar
            ? { backgroundColor: 'var(--memovia-violet-light)' }
            : { backgroundColor: `${accent}18` }
        }
      >
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div>
        <p className="text-lg font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
          {value.toLocaleString('fr-FR')}
        </p>
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
      </div>
    </div>
  )
}

export function MonitoringKPIsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border px-4 py-3"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
        >
          <div className="h-9 w-9 skeleton rounded-xl" />
          <div className="space-y-1.5">
            <div className="h-5 w-10 skeleton rounded" />
            <div className="h-3 w-24 skeleton rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MonitoringKPIs({ stats }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard
        icon={<Bug className="h-4 w-4" />}
        label="Bugs actifs"
        value={stats.totalIssues}
        accent="#EF4444"
      />
      <KpiCard
        icon={<RefreshCw className="h-4 w-4" />}
        label="Occurrences 14 derniers jours"
        value={stats.totalOccurrences}
        accent="#F97316"
      />
      <KpiCard
        icon={<Users className="h-4 w-4" />}
        label="Utilisateurs affectés"
        value={stats.usersAffected}
        accent="var(--memovia-violet)"
      />
    </div>
  )
}
