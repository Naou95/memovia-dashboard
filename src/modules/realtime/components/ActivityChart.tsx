import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HourlyBucket } from '@/hooks/useRealtimePresence'

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
        {payload[0]?.value ?? 0} connexion{(payload[0]?.value ?? 0) !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

interface ActivityChartProps {
  data: HourlyBucket[]
  isLoading: boolean
}

export function ActivityChart({ data, isLoading }: ActivityChartProps) {
  const isEmpty = data.every((d) => d.count === 0)

  return (
    <div
      className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5"
    >
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
          Activité — dernières 24 heures
        </h3>
        <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
          Connexions par heure (basé sur last_sign_in_at)
        </p>
      </div>

      {isLoading ? (
        <div className="h-[160px] animate-pulse rounded-xl bg-[var(--bg-primary)]" />
      ) : isEmpty ? (
        <div className="flex h-[160px] items-center justify-center text-sm text-[var(--text-muted)]">
          Aucune activité enregistrée sur les dernières 24 heures.
        </div>
      ) : (
        <div style={{ width: '100%', height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
              barCategoryGap="30%"
            >
              <CartesianGrid vertical={false} stroke="#EDEDF0" strokeOpacity={0.8} />
              <XAxis
                dataKey="hour"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: '#9E9EAB' }}
                interval={3}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: '#9E9EAB' }}
                allowDecimals={false}
                width={24}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,229,204,0.08)', rx: 6, ry: 6 }}
                content={<CustomTooltip />}
                wrapperStyle={{ outline: 'none' }}
              />
              <Bar
                dataKey="count"
                fill="#00E5CC"
                radius={[5, 5, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
