import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyRevenue } from '@/types/stripe'

const formatEur = (val: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val)

const formatAxis = (val: number) =>
  new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(val) + ' €'

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #EDEDF0',
        borderRadius: 10,
        padding: '8px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      <p style={{ fontSize: 11, color: '#9E9EAB', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#0F0F1A' }}>
        {formatEur(Number(payload[0]?.value ?? 0))}
      </p>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────
interface RevenueBarChartProps {
  data: MonthlyRevenue[]
  /** full = 12 mois avec YAxis (page /stripe) · mini = 6 mois sans YAxis (overview) */
  variant?: 'full' | 'mini'
  /** top = radius sur le haut des barres (legacy) · capsule = barres arrondies complètes (Adminix-style) */
  rounded?: 'top' | 'capsule'
}

export function RevenueBarChart({
  data,
  variant = 'full',
  rounded = 'top',
}: RevenueBarChartProps) {
  const isMini = variant === 'mini'
  const height = isMini ? 160 : 236
  const maxBarSize = isMini ? 22 : 38
  const barRadius: [number, number, number, number] =
    rounded === 'capsule' ? [999, 999, 999, 999] : [6, 6, 0, 0]

  const isEmpty = data.every((d) => d.revenue === 0)

  if (isEmpty) {
    return (
      <div
        className="flex items-center justify-center text-sm text-[var(--text-muted)]"
        style={{ height }}
      >
        Aucun revenu enregistré sur cette période.
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: isMini ? -20 : 0 }}
          barCategoryGap="35%"
        >
          <CartesianGrid
            vertical={false}
            stroke="#EDEDF0"
            strokeOpacity={0.8}
          />

          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#9E9EAB' }}
            interval="preserveStartEnd"
          />

          {!isMini && (
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#9E9EAB' }}
              tickFormatter={formatAxis}
              width={68}
            />
          )}

          <Tooltip
            cursor={{ fill: 'rgba(124,58,237,0.06)', rx: 6, ry: 6 }}
            content={<CustomTooltip />}
            wrapperStyle={{ outline: 'none' }}
          />

          <Bar
            dataKey="revenue"
            fill="#7C3AED"
            radius={barRadius}
            maxBarSize={maxBarSize}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
