import type { FeedbackItemWithVotes } from '@/types/feedback'

interface RoadmapStatsProps {
  items: FeedbackItemWithVotes[]
}

export function RoadmapStats({ items }: RoadmapStatsProps) {
  const totalVotes = items.reduce((sum, i) => sum + i.vote_count, 0)
  const enDev = items.filter((i) => i.status === 'en_dev').length
  const livre = items.filter((i) => i.status === 'livre').length

  const stats = [
    { label: 'Idées totales', value: items.length, color: 'var(--memovia-violet)' },
    { label: 'Votes cumulés', value: totalVotes, color: '#3b82f6' },
    { label: 'En développement', value: enDev, color: '#f59e0b' },
    { label: 'Livrées', value: livre, color: '#10b981' },
  ]

  return (
    <div className="grid auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
        >
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-label)]">
            {stat.label}
          </p>
          <p className="mt-2 text-[28px] font-bold leading-none tracking-tight tabular-nums" style={{ color: stat.color }}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}
