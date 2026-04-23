import type { CSSProperties } from 'react'
import { leadScoreColor, type LeadScoreColor } from '@/lib/leadScoring'

interface LeadScoreBadgeProps {
  score: number
  size?: 'sm' | 'md'
  title?: string
}

const COLOR_STYLES: Record<LeadScoreColor, CSSProperties> = {
  red: {
    backgroundColor: 'color-mix(in oklab, var(--danger) 12%, var(--bg-primary))',
    color: 'var(--danger)',
    border: '1px solid color-mix(in oklab, var(--danger) 30%, var(--bg-primary))',
  },
  orange: {
    backgroundColor: '#fef3c7',
    color: '#d97706',
    border: '1px solid #fde68a',
  },
  green: {
    backgroundColor: 'color-mix(in oklab, var(--success) 15%, var(--bg-primary))',
    color: 'var(--success)',
    border: '1px solid color-mix(in oklab, var(--success) 30%, var(--bg-primary))',
  },
}

export function LeadScoreBadge({ score, size = 'md', title }: LeadScoreBadgeProps) {
  const color = leadScoreColor(score)
  const sizeClasses =
    size === 'sm'
      ? 'px-1.5 py-0 text-[10px] min-w-[26px]'
      : 'px-2 py-0.5 text-[11px] min-w-[32px]'

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold tabular-nums ${sizeClasses}`}
      style={COLOR_STYLES[color]}
      title={title ?? `Score ${score}/100`}
      aria-label={`Score ${score} sur 100`}
    >
      {score}
    </span>
  )
}
