import { ArrowRight, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeadCardData } from '@/hooks/useCopilot'

const STATUS_STYLES: Record<string, string> = {
  nouveau: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  contacte: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  en_discussion: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
  proposition: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  gagne: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  perdu: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
}

const STATUS_LABELS: Record<string, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  en_discussion: 'En discussion',
  proposition: 'Proposition',
  gagne: 'Gagné',
  perdu: 'Perdu',
}

const TYPE_LABELS: Record<string, string> = { ecole: 'École', cfa: 'CFA', entreprise: 'Entreprise', autre: 'Autre' }

export function LeadCard({ data }: { data: LeadCardData }) {
  return (
    <div className="my-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-[var(--memovia-violet)]" strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{data.name}</p>
            <span className="shrink-0 rounded-full bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
              {TYPE_LABELS[data.type] ?? data.type}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_STYLES[data.old_status] ?? 'bg-[var(--bg-secondary)] text-[var(--text-muted)]')}>
              {STATUS_LABELS[data.old_status] ?? data.old_status}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_STYLES[data.new_status] ?? 'bg-[var(--bg-secondary)] text-[var(--text-muted)]')}>
              {STATUS_LABELS[data.new_status] ?? data.new_status}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
