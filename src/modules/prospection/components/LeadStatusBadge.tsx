import type { LeadStatus } from '@/types/leads'
import { LEAD_STATUS_LABELS } from '@/types/leads'

interface LeadStatusBadgeProps {
  status: LeadStatus
}

const STATUS_STYLES: Record<LeadStatus, React.CSSProperties> = {
  nouveau: {
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
  },
  contacte: {
    backgroundColor: 'var(--accent-blue-bg)',
    color: 'var(--accent-blue)',
  },
  en_discussion: {
    backgroundColor: 'color-mix(in oklab, var(--memovia-violet) 12%, var(--bg-primary))',
    color: 'var(--memovia-violet)',
  },
  proposition: {
    backgroundColor: 'color-mix(in oklab, #f59e0b 12%, var(--bg-primary))',
    color: '#b45309',
  },
  gagne: {
    backgroundColor: 'color-mix(in oklab, var(--success) 15%, var(--bg-primary))',
    color: 'var(--success)',
  },
  perdu: {
    backgroundColor: 'var(--trend-down-bg)',
    color: 'var(--trend-down-text)',
  },
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium"
      style={STATUS_STYLES[status]}
    >
      {LEAD_STATUS_LABELS[status]}
    </span>
  )
}
