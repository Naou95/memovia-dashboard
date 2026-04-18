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
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {stat.label}
          </p>
          <p className="mt-1 text-2xl font-bold" style={{ color: stat.color }}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}
