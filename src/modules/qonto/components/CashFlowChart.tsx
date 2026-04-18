import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyCashFlow } from '@/types/qonto'

const formatEur = (val: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(val)

const formatAxis = (val: number) =>
  new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(val) + ' €'

// ── Custom tooltip ──────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
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
        minWidth: 140,
      }}
    >
      <p style={{ fontSize: 11, color: '#9E9EAB', marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span style={{ fontSize: 12, color: p.color }}>{p.name}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0F0F1A' }}>
            {formatEur(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

interface CashFlowChartProps {
  data: MonthlyCashFlow[]
}

const barRadius: [number, number, number, number] = [6, 6, 0, 0]

export function CashFlowChart({ data }: CashFlowChartProps) {
  const isEmpty = data.every((d) => d.income === 0 && d.expenses === 0)

  if (isEmpty) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-[var(--text-muted)]">
        Aucune transaction sur cette période.
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          barCategoryGap="35%"
          barGap={4}
        >
          <CartesianGrid vertical={false} stroke="#EDEDF0" strokeOpacity={0.8} />

          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#9E9EAB' }}
            interval="preserveStartEnd"
          />

          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#9E9EAB' }}
            tickFormatter={formatAxis}
            width={68}
          />

          <Tooltip
            cursor={{ fill: 'rgba(124,58,237,0.06)', rx: 6, ry: 6 }}
            content={<CustomTooltip />}
            wrapperStyle={{ outline: 'none' }}
          />

          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
          />

          <Bar
            dataKey="income"
            name="Entrées"
            fill="#10B981"
            radius={barRadius}
            maxBarSize={24}
          />
          <Bar
            dataKey="expenses"
            name="Sorties"
            fill="#EF4444"
            radius={barRadius}
            maxBarSize={24}
          />
          <Bar
            dataKey="net"
            name="Net"
            fill="#7C3AED"
            radius={barRadius}
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
