import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'

export type AccentKey = 'violet' | 'cyan' | 'blue' | 'red' | 'green'

export interface KpiCardProps {
  label: string
  /** null = données non encore disponibles (afficher skeleton) */
  value: string | null
  unit?: string
  accent: AccentKey
  icon: React.ElementType
  isLoading: boolean
  error: string | null
  /** Variation vs mois précédent, ex: 12 = +12%, -5 = -5%. Optionnel. */
  delta?: number
}

export const ACCENT_MAP: Record<AccentKey, { bg: string; fg: string }> = {
  violet: { bg: 'var(--accent-purple-bg)', fg: 'var(--accent-purple)' },
  cyan:   { bg: 'color-mix(in oklab, var(--memovia-cyan) 20%, white)', fg: 'var(--memovia-cyan)' },
  blue:   { bg: 'var(--accent-blue-bg)', fg: 'var(--accent-blue)' },
  red:    { bg: 'var(--trend-down-bg)', fg: 'var(--trend-down-text)' },
  green:  { bg: 'color-mix(in oklab, var(--success) 15%, white)', fg: 'var(--success)' },
}

export function KpiCard({ label, value, unit, accent, icon: Icon, isLoading, error, delta }: KpiCardProps) {
  const colors = ACCENT_MAP[accent]
  const hasPositiveDelta = delta !== undefined && delta > 0
  const hasNegativeDelta = delta !== undefined && delta < 0

  return (
    <article className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
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

        {/* Indicateur d'erreur discret */}
        {error && !isLoading && (
          <div title={error}>
            <AlertCircle className="h-4 w-4 text-[var(--danger)]" />
          </div>
        )}
      </div>

      {/* Valeur : skeleton → erreur → vraie valeur */}
      {isLoading ? (
        <div className="h-8 w-28 animate-pulse rounded-md bg-[var(--border-color)]" />
      ) : error ? (
        <p className="text-sm text-[var(--text-muted)]">Indisponible</p>
      ) : (
        <div className="flex items-end justify-between gap-2">
          <p className="text-[26px] font-semibold leading-none tracking-tight text-[var(--text-primary)] tabular-nums">
            {value}
            {unit && (
              <span className="ml-1 text-base font-normal text-[var(--text-muted)]">{unit}</span>
            )}
          </p>

          {/* Delta badge (optionnel) */}
          {delta !== undefined && (
            <span
              className="mb-0.5 flex items-center gap-0.5 text-[12px] font-medium"
              style={{
                color: hasPositiveDelta
                  ? 'var(--success)'
                  : hasNegativeDelta
                  ? 'var(--trend-down-text)'
                  : 'var(--text-muted)',
              }}
            >
              {hasPositiveDelta && <TrendingUp className="h-3 w-3" />}
              {hasNegativeDelta && <TrendingDown className="h-3 w-3" />}
              {delta > 0 ? '+' : ''}{delta}%
            </span>
          )}
        </div>
      )}
    </article>
  )
}
