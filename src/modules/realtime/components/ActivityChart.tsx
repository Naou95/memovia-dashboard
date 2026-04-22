import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ActiveUser } from '@/hooks/useRealtimePresence'

export type Period = 'today' | 'week' | 'month'

interface Bucket { label: string; count: number }

function buildTodayBuckets(users: ActiveUser[]): Bucket[] {
  const now = new Date()
  return Array.from({ length: 24 }, (_, i) => {
    const hourStart = new Date(now)
    hourStart.setMinutes(0, 0, 0)
    hourStart.setHours(hourStart.getHours() - (23 - i))
    const hourEnd = new Date(hourStart.getTime() + 3_600_000)
    const count = users.filter((u) => {
      if (!u.last_sign_in_at) return false
      const t = new Date(u.last_sign_in_at)
      return t >= hourStart && t < hourEnd
    }).length
    return { label: `${hourStart.getHours()}h`, count }
  })
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function buildWeekBuckets(users: ActiveUser[]): Bucket[] {
  const today = new Date()
  const dow = today.getDay()
  const daysFromMonday = dow === 0 ? 6 : dow - 1
  return Array.from({ length: daysFromMonday + 1 }, (_, i) => {
    const dayStart = new Date(today)
    dayStart.setDate(today.getDate() - (daysFromMonday - i))
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)
    const count = users.filter((u) => {
      if (!u.last_sign_in_at) return false
      const t = new Date(u.last_sign_in_at)
      return t >= dayStart && t < dayEnd
    }).length
    const d = dayStart.getDay()
    return { label: DAY_LABELS[d === 0 ? 6 : d - 1], count }
  })
}

function buildMonthBuckets(users: ActiveUser[]): Bucket[] {
  const today = new Date()
  return Array.from({ length: today.getDate() }, (_, i) => {
    const dayStart = new Date(today.getFullYear(), today.getMonth(), i + 1)
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)
    const count = users.filter((u) => {
      if (!u.last_sign_in_at) return false
      const t = new Date(u.last_sign_in_at)
      return t >= dayStart && t < dayEnd
    }).length
    return { label: `${i + 1}`, count }
  })
}

const CHART_META: Record<Period, { title: string; subtitle: string; emptyMsg: string; xInterval: number }> = {
  today: {
    title: 'Activité — dernières 24 heures',
    subtitle: 'Connexions par heure (basé sur last_sign_in_at)',
    emptyMsg: 'Aucune activité sur les dernières 24 heures.',
    xInterval: 3,
  },
  week: {
    title: 'Activité — cette semaine',
    subtitle: 'Connexions par jour (lundi → aujourd\'hui)',
    emptyMsg: 'Aucune activité cette semaine.',
    xInterval: 0,
  },
  month: {
    title: 'Activité — ce mois',
    subtitle: 'Connexions par jour',
    emptyMsg: 'Aucune activité ce mois.',
    xInterval: 4,
  },
}

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
  users: ActiveUser[]
  period: Period
  isLoading: boolean
}

export function ActivityChart({ users, period, isLoading }: ActivityChartProps) {
  const meta = CHART_META[period]

  const data =
    period === 'today'
      ? buildTodayBuckets(users)
      : period === 'week'
        ? buildWeekBuckets(users)
        : buildMonthBuckets(users)

  const isEmpty = data.every((d) => d.count === 0)

  return (
    <div className="rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]">
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{meta.title}</h3>
        <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{meta.subtitle}</p>
      </div>

      {isLoading ? (
        <div className="h-[160px] animate-pulse rounded-md bg-[var(--bg-primary)]" />
      ) : isEmpty ? (
        <div className="flex h-[160px] items-center justify-center text-sm text-[var(--text-muted)]">
          {meta.emptyMsg}
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
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: '#9E9EAB' }}
                interval={meta.xInterval}
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
