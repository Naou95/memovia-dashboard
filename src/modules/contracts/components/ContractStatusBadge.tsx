import type { ContractStatus } from '@/types/contracts'
import { CONTRACT_STATUS_LABELS } from '@/types/contracts'

interface ContractStatusBadgeProps {
  status: ContractStatus
}

const STATUS_STYLES: Record<ContractStatus, React.CSSProperties> = {
  prospect: {
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
  },
  negotiation: {
    backgroundColor: 'var(--accent-blue-bg)',
    color: 'var(--accent-blue)',
  },
  signe: {
    backgroundColor: 'var(--accent-blue-bg)',
    color: 'var(--memovia-cyan)',
  },
  actif: {
    backgroundColor: 'color-mix(in oklab, var(--success) 15%, var(--bg-primary))',
    color: 'var(--success)',
  },
  resilie: {
    backgroundColor: 'var(--trend-down-bg)',
    color: 'var(--trend-down-text)',
  },
}

export function ContractStatusBadge({ status }: ContractStatusBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium"
      style={STATUS_STYLES[status]}
    >
      {CONTRACT_STATUS_LABELS[status]}
    </span>
  )
}
