import { CheckCircle2, Clock, AlertTriangle, ListChecks } from 'lucide-react'
import type { Task } from '@/types/tasks'

interface TaskStatsProps {
  tasks: Task[]
  isLoading: boolean
}

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  accent: string
  isLoading: boolean
}

function StatCard({ label, value, icon, accent, isLoading }: StatCardProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 shadow-[var(--shadow-xs)]"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `color-mix(in oklab, ${accent} 12%, var(--bg-primary))`, color: accent }}
      >
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-label)]">
          {label}
        </p>
        {isLoading ? (
          <div className="mt-1 h-5 w-8 animate-pulse rounded bg-[var(--border-color)]" />
        ) : (
          <p className="text-[20px] font-semibold leading-tight text-[var(--text-primary)]">
            {value}
          </p>
        )}
      </div>
    </div>
  )
}

export function TaskStats({ tasks, isLoading }: TaskStatsProps) {
  const total = tasks.length
  const enCours = tasks.filter((t) => t.status === 'en_cours').length
  const done = tasks.filter((t) => t.status === 'done').length
  const overdue = tasks.filter(
    (t) =>
      t.due_date != null &&
      t.status !== 'done' &&
      new Date(t.due_date) < new Date()
  ).length

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        label="Total"
        value={total}
        icon={<ListChecks className="h-4 w-4" />}
        accent="var(--text-secondary)"
        isLoading={isLoading}
      />
      <StatCard
        label="En cours"
        value={enCours}
        icon={<Clock className="h-4 w-4" />}
        accent="var(--memovia-violet)"
        isLoading={isLoading}
      />
      <StatCard
        label="En retard"
        value={overdue}
        icon={<AlertTriangle className="h-4 w-4" />}
        accent={overdue > 0 ? 'var(--danger)' : 'var(--text-label)'}
        isLoading={isLoading}
      />
      <StatCard
        label="Terminées"
        value={done}
        icon={<CheckCircle2 className="h-4 w-4" />}
        accent="var(--success)"
        isLoading={isLoading}
      />
    </div>
  )
}
