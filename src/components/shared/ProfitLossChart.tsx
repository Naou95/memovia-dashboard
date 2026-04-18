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
  new Intl.NumberFormat('fr-FR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(val) + ' €'

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const income = payload.find((p) => p.dataKey === 'income')?.value ?? 0
  const expenses = payload.find((p) => p.dataKey === 'expenses')?.value ?? 0
  const net = income - expenses

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #EDEDF0',
        borderRadius: 10,
        padding: '10px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        minWidth: 140,
      }}
    >
      <p style={{ fontSize: 11, color: '#9E9EAB', marginBottom: 6 }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
          <span style={{ color: 'var(--success)' }}>● Entrées</span>
          <span style={{ fontWeight: 600, color: '#0F0F1A' }}>{formatEur(income)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
          <span style={{ color: 'var(--danger)' }}>● Sorties</span>
          <span style={{ fontWeight: 600, color: '#0F0F1A' }}>{formatEur(expenses)}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: 12,
            borderTop: '1px solid #EDEDF0',
            paddingTop: 4,
            marginTop: 2,
          }}
        >
          <span style={{ color: '#6B6B7A' }}>Net</span>
          <span
            style={{
              fontWeight: 600,
              color: net >= 0 ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {net >= 0 ? '+' : ''}
            {formatEur(net)}
          </span>
        </div>
      </div>
    </div>
  )
}

function renderLegend() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        justifyContent: 'flex-end',
        fontSize: 12,
        color: '#6B6B7A',
        paddingBottom: 8,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: 'var(--success)',
          }}
        />
        Entrées
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: '#FCA5A5',
          }}
        />
        Sorties
      </span>
    </div>
  )
}

interface ProfitLossChartProps {
  data: MonthlyCashFlow[]
  height?: number
}

export function ProfitLossChart({ data, height = 260 }: ProfitLossChartProps) {
  const isEmpty = data.every((d) => d.income === 0 && d.expenses === 0)

  if (isEmpty) {
    return (
      <div
        className="flex items-center justify-center text-sm text-[var(--text-muted)]"
        style={{ height }}
      >
        Aucune activité enregistrée sur cette période.
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          barCategoryGap="30%"
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
            width={56}
          />

          <Tooltip
            cursor={{ fill: 'rgba(124,58,237,0.04)', rx: 6, ry: 6 }}
            content={<CustomTooltip />}
            wrapperStyle={{ outline: 'none' }}
          />

          <Legend content={renderLegend} verticalAlign="top" />

          <Bar
            dataKey="income"
            fill="var(--success)"
            radius={[999, 999, 999, 999]}
            maxBarSize={16}
          />
          <Bar
            dataKey="expenses"
            fill="#FCA5A5"
            radius={[999, 999, 999, 999]}
            maxBarSize={16}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
