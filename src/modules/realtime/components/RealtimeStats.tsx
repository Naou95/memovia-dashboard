import { Activity, Clock, CalendarDays, Users } from 'lucide-react'
import { KpiCard } from '@/components/shared/KpiCard'
import type { RealtimeStats, ActiveUser } from '@/hooks/useRealtimePresence'
import type { Period } from './ActivityChart'

interface RealtimeStatsProps {
  stats: RealtimeStats | null
  users: ActiveUser[]
  period: Period
  isLoading: boolean
  error: string | null
}

function getPeriodStart(period: Period): Date {
  const today = new Date()
  if (period === 'today') return new Date(Date.now() - 24 * 60 * 60_000)
  if (period === 'week') {
    const dow = today.getDay()
    const daysFromMonday = dow === 0 ? 6 : dow - 1
    const monday = new Date(today)
    monday.setDate(today.getDate() - daysFromMonday)
    monday.setHours(0, 0, 0, 0)
    return monday
  }
  return new Date(today.getFullYear(), today.getMonth(), 1)
}

const PERIOD_KPI: Record<Period, { label: string }> = {
  today: { label: 'Actifs — 24 heures' },
  week: { label: 'Actifs — cette semaine' },
  month: { label: 'Actifs — ce mois' },
}

export function RealtimeStats({ stats, users, period, isLoading, error }: RealtimeStatsProps) {
  const periodCount = users.filter(
    (u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= getPeriodStart(period)
  ).length

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
        label={PERIOD_KPI[period].label}
        value={!isLoading ? String(periodCount) : null}
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
