import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { VisitorDataPoint } from '@/types/analytics'

interface Props {
  data: VisitorDataPoint[]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

interface TooltipPayload {
  value: number
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 shadow-lg">
      <p className="text-[12px] text-[var(--text-muted)]">{label}</p>
      <p className="text-[14px] font-semibold text-[var(--memovia-violet)]">
        {payload[0].value.toLocaleString('fr-FR')} visiteurs
      </p>
    </div>
  )
}

export function VisitorsChart({ data }: Props) {
  const formatted = data.map((d) => ({ ...d, label: formatDate(d.date) }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={formatted} barSize={28} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border-color)" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--accent-purple-bg)' }} />
        <Bar
          dataKey="visitors"
          fill="var(--memovia-violet)"
          radius={[6, 6, 0, 0]}
          opacity={0.85}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
