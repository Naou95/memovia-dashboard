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
import type { DailyCost } from '@/types/api-costs'

// ── Formatters ─────────────────────────────────────────────────────────────────

const formatUsd = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(val)

const formatAxis = (val: number) => `$${val.toFixed(3)}`

// ── Custom tooltip ─────────────────────────────────────────────────────────────

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
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0)
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #EDEDF0',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        minWidth: 160,
      }}
    >
      <p style={{ fontSize: 11, color: '#9E9EAB', marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
          <span style={{ fontSize: 12, color: p.color, fontWeight: 500 }}>{p.name}</span>
          <span style={{ fontSize: 12, color: '#0F0F1A', fontWeight: 600 }}>{formatUsd(p.value)}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            marginTop: 6,
            paddingTop: 6,
            borderTop: '1px solid #EDEDF0',
          }}
        >
          <span style={{ fontSize: 12, color: '#6B6B7A', fontWeight: 500 }}>Total</span>
          <span style={{ fontSize: 13, color: '#0F0F1A', fontWeight: 700 }}>{formatUsd(total)}</span>
        </div>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

interface DailyCostChartProps {
  data: DailyCost[]
  showGladia: boolean
}

const PROVIDER_COLORS = {
  openai: '#7C3AED',
  gladia: '#00C9B1',
}

export function DailyCostChart({ data, showGladia }: DailyCostChartProps) {
  const isEmpty = data.every((d) => d.openai === 0 && d.gladia === 0)

  const formatted = data.map((d) => ({
    ...d,
    date: d.date.slice(8), // DD only
  }))

  if (isEmpty) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-[var(--text-muted)]">
        Aucun coût enregistré sur cette période.
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: 8 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="#EDEDF0" strokeOpacity={0.8} />
          <XAxis
            dataKey="date"
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
            width={60}
          />
          <Tooltip cursor={{ fill: 'rgba(124,58,237,0.05)', rx: 6, ry: 6 }} content={<CustomTooltip />} wrapperStyle={{ outline: 'none' }} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => <span style={{ color: '#6B6B7A' }}>{value}</span>}
          />
          <Bar dataKey="openai" name="OpenAI" stackId="a" fill={PROVIDER_COLORS.openai} radius={showGladia ? [0, 0, 0, 0] : [6, 6, 0, 0]} maxBarSize={32} />
          {showGladia && (
            <Bar dataKey="gladia" name="Gladia" stackId="a" fill={PROVIDER_COLORS.gladia} radius={[6, 6, 0, 0]} maxBarSize={32} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
