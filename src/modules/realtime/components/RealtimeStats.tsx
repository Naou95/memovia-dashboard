import { Activity, Clock, CalendarDays, Users } from 'lucide-react'
import { KpiCard } from '@/components/shared/KpiCard'
import type { RealtimeStats } from '@/hooks/useRealtimePresence'

interface RealtimeStatsProps {
  stats: RealtimeStats | null
  isLoading: boolean
  error: string | null
}

export function RealtimeStats({ stats, isLoading, error }: RealtimeStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Actifs — 30 min"
        value={stats ? String(stats.activeLast30m) : null}
        accent="green"
        icon={Activity}
        isLoading={isLoading}
        error={error}
      />
      <KpiCard
        label="Actifs — 1 heure"
        value={stats ? String(stats.activeLast1h) : null}
        accent="cyan"
        icon={Clock}
        isLoading={isLoading}
        error={error}
      />
      <KpiCard
        label="Actifs — 24 heures"
        value={stats ? String(stats.activeLast24h) : null}
        accent="violet"
        icon={CalendarDays}
        isLoading={isLoading}
        error={error}
      />
      <KpiCard
        label="Inscrits (total)"
        value={stats ? String(stats.totalUsers) : null}
        accent="blue"
        icon={Users}
        isLoading={isLoading}
        error={error}
      />
    </div>
  )
}
