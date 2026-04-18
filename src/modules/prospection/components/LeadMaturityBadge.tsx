// src/modules/prospection/components/LeadMaturityBadge.tsx
import type { LeadMaturity } from '@/types/leads'
import { LEAD_MATURITY_LABELS } from '@/types/leads'

interface LeadMaturityBadgeProps {
  maturity: LeadMaturity
}

const MATURITY_STYLES: Record<LeadMaturity, React.CSSProperties> = {
  froid: {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-label)',
    border: '1px solid var(--border-color)',
  },
  tiede: {
    backgroundColor: '#fef3c7',
    color: '#d97706',
    border: '1px solid #fde68a',
  },
  chaud: {
    backgroundColor: 'color-mix(in oklab, var(--success) 15%, white)',
    color: 'var(--success)',
    border: '1px solid color-mix(in oklab, var(--success) 30%, white)',
  },
}

export function LeadMaturityBadge({ maturity }: LeadMaturityBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={MATURITY_STYLES[maturity]}
    >
      {LEAD_MATURITY_LABELS[maturity]}
    </span>
  )
}
