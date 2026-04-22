import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { CountUp } from '@/components/motion/CountUp'
import { Sparkline } from '@/components/shared/Sparkline'
import { usePrivacy } from '@/contexts/PrivacyContext'

export type AccentKey = 'violet' | 'cyan' | 'blue' | 'red' | 'green'

export interface KpiCardProps {
  label: string
  /** Pre-formatted display value (fallback when rawValue is not provided) */
  value: string | null
  /** Raw numeric value — enables count-up animation when provided */
  rawValue?: number
  /** Custom formatter for the count-up animation */
  formatter?: (n: number) => string
  unit?: string
  accent: AccentKey
  icon: React.ElementType
  isLoading: boolean
  error: string | null
  /** Variation vs previous month, e.g. 12 = +12%, -5 = -5% */
  delta?: number
  /** Optional time-series for a sparkline rendered below the value */
  trend?: number[]
  /** Mask value with •••• when privacy mode is active */
  sensitive?: boolean
  /** Small text rendered below the value (e.g. "dont 360€ B2B") */
  footer?: React.ReactNode
}

export const ACCENT_MAP: Record<AccentKey, { bg: string; fg: string }> = {
  violet: { bg: 'var(--accent-purple-bg)', fg: 'var(--accent-purple)' },
  cyan:   { bg: 'var(--accent-blue-bg)',   fg: 'var(--accent-blue)' },
  blue:   { bg: 'var(--accent-blue-bg)',   fg: 'var(--accent-blue)' },
  red:    { bg: 'var(--danger-bg)',         fg: 'var(--danger)' },
  green:  { bg: 'var(--success-bg)',        fg: 'var(--success)' },
}

const frFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

export function KpiCard({
  label,
  value,
  rawValue,
  formatter,
  unit,
  accent,
  icon: Icon,
  isLoading,
  error,
  delta,
  trend,
  sensitive = false,
  footer,
}: KpiCardProps) {
  const { isPrivate } = usePrivacy()
  const masked = sensitive && isPrivate
  const colors = ACCENT_MAP[accent]
  const hasPositiveDelta = delta !== undefined && delta > 0
  const hasNegativeDelta = delta !== undefined && delta < 0

  const resolvedFormatter = formatter ?? ((n: number) => frFormatter.format(n))

  return (
    <motion.article
      className="rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)] transition-shadow duration-200 hover:shadow-[var(--shadow-sm)]"
      whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 20 }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.bg }}
          >
            <Icon className="h-4 w-4" style={{ color: colors.fg }} strokeWidth={2.25} />
          </div>
          <span className="text-[13px] font-medium text-[var(--text-secondary)]">
            {label}
          </span>
        </div>

        {error && !isLoading && (
          <div title={error}>
            <AlertCircle className="h-4 w-4 text-[var(--danger)]" />
          </div>
        )}
      </div>

      {/* Value — skeleton shimmer → error → count-up or static */}
      {isLoading ? (
        <div className="skeleton h-8 w-28 rounded-md" />
      ) : error ? (
        <p className="text-sm text-[var(--text-muted)]">Indisponible</p>
      ) : (
        <div className="flex items-end justify-between gap-2">
          <p className="text-[28px] font-bold leading-none tracking-tight text-[var(--text-primary)] tabular-nums">
            {masked ? (
              <span className="tracking-widest text-[var(--text-muted)]">••••</span>
            ) : rawValue !== undefined ? (
              <CountUp to={rawValue} formatter={resolvedFormatter} />
            ) : (
              value
            )}
            {!masked && unit && (
              <span className="ml-1 text-base font-normal text-[var(--text-muted)]">{unit}</span>
            )}
          </p>

        </div>
      )}

      {!isLoading && !error && delta !== undefined && (
        <div className="mt-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
            style={{
              backgroundColor: hasPositiveDelta
                ? '#F0FDF4'
                : hasNegativeDelta
                ? '#FEF2F2'
                : 'var(--bg-primary)',
              color: hasPositiveDelta
                ? '#16A34A'
                : hasNegativeDelta
                ? '#DC2626'
                : 'var(--text-muted)',
            }}
          >
            {hasPositiveDelta ? (
              <TrendingUp className="h-3 w-3" strokeWidth={2.5} />
            ) : hasNegativeDelta ? (
              <TrendingDown className="h-3 w-3" strokeWidth={2.5} />
            ) : null}
            {delta > 0 ? '+' : ''}{delta}% vs M-1
          </span>
        </div>
      )}

      {!isLoading && !error && footer && (
        <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">{footer}</p>
      )}

      {/* Sparkline — rendered only when trend series is provided (≥2 values) */}
      {!isLoading && !error && trend && trend.length >= 2 && (
        <div className="mt-3" data-testid="kpi-sparkline">
          <Sparkline
            data={trend}
            width={120}
            height={28}
            color={colors.fg}
            filled
            className="w-full"
          />
        </div>
      )}
    </motion.article>
  )
}
