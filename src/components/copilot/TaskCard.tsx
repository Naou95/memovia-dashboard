import { CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskCardData } from '@/hooks/useCopilot'

const PRIORITY_STYLES: Record<string, string> = {
  haute: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
  normale: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800',
  basse: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
}

const STATUS_STYLES: Record<string, string> = {
  todo: 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border-color)]',
  en_cours: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
}

const STATUS_LABELS: Record<string, string> = { todo: 'À faire', en_cours: 'En cours' }
const PRIORITY_LABELS: Record<string, string> = { haute: 'Haute', normale: 'Normale', basse: 'Basse' }

const ASSIGNEE_INITIALS: Record<string, string> = { naoufel: 'N', emir: 'E' }
const ASSIGNEE_COLORS: Record<string, string> = {
  naoufel: 'bg-[var(--memovia-violet)] text-white',
  emir: 'bg-emerald-600 text-white',
}

export function TaskCard({ data }: { data: TaskCardData }) {
  // Compute effective assignees: use assignees if non-empty, else use assigned_to if non-empty
  const effectiveAssignees = data.assignees && data.assignees.length > 0
    ? data.assignees
    : (data.assigned_to ? [data.assigned_to] : [])

  return (
    <div className="my-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-[var(--memovia-violet)]" strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{data.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', STATUS_STYLES[data.status] ?? STATUS_STYLES.todo)}>
              {STATUS_LABELS[data.status] ?? data.status}
            </span>
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', PRIORITY_STYLES[data.priority] ?? '')}>
              {PRIORITY_LABELS[data.priority] ?? data.priority}
            </span>
            <div className="flex">
              {effectiveAssignees.map((assignee, idx) => (
                <span
                  key={assignee}
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
                    ASSIGNEE_COLORS[assignee] ?? 'bg-[var(--bg-secondary)] text-[var(--text-muted)]',
                    idx > 0 && '-ml-1 ring-1 ring-white'
                  )}
                >
                  {ASSIGNEE_INITIALS[assignee] ?? (assignee[0]?.toUpperCase() || '?')}
                </span>
              ))}
            </div>
            {data.due_date && (
              <span className="text-[10px] text-[var(--text-muted)]">
                {new Date(data.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
