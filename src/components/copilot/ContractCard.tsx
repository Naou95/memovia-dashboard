import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContractCardData } from '@/hooks/useCopilot'

const STATUS_STYLES: Record<string, string> = {
  prospect: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  negotiation: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  signe: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  actif: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
}

const STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  negotiation: 'Négociation',
  signe: 'Signé',
  actif: 'Actif',
}

export function ContractCard({ data }: { data: ContractCardData }) {
  return (
    <div className="my-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--memovia-violet)]" strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{data.organization_name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_STYLES[data.status] ?? 'bg-[var(--bg-secondary)] text-[var(--text-muted)]')}>
              {STATUS_LABELS[data.status] ?? data.status}
            </span>
            {data.mrr_eur !== null && (
              <span className="text-[10px] font-medium text-[var(--text-primary)]">
                {data.mrr_eur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/mois
              </span>
            )}
            <span className="text-[10px] text-[var(--text-muted)]">
              {data.license_count} licence{data.license_count > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
