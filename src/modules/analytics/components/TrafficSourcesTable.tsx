import type { TrafficSource } from '@/types/analytics'

interface Props {
  sources: TrafficSource[]
  total: number
}

function formatSource(source: string): string {
  if (!source || source === '' || source === 'Direct') return 'Direct'
  try {
    const u = new URL(source.startsWith('http') ? source : `https://${source}`)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return source
  }
}

export function TrafficSourcesTable({ sources, total }: Props) {
  if (!sources.length) {
    return (
      <p className="py-6 text-center text-sm text-[var(--text-muted)]">Aucune donnée disponible</p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border-color)]">
            <th className="pb-2 text-left font-medium text-[var(--text-muted)]">Source</th>
            <th className="pb-2 text-right font-medium text-[var(--text-muted)]">Sessions</th>
            <th className="pb-2 text-right font-medium text-[var(--text-muted)]">Part</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s, i) => {
            const pct = total > 0 ? Math.round((s.count / total) * 100) : 0
            return (
              <tr key={i} className="border-b border-[var(--border-color)] last:border-0">
                <td className="py-2.5 pr-4 text-[var(--text-primary)]">
                  {formatSource(s.source)}
                </td>
                <td className="py-2.5 text-right font-medium tabular-nums text-[var(--text-primary)]">
                  {s.count.toLocaleString('fr-FR')}
                </td>
                <td className="py-2.5 pl-4 text-right">
                  <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                    style={{
                      backgroundColor: 'var(--accent-purple-bg)',
                      color: 'var(--memovia-violet)',
                    }}
                  >
                    {pct}%
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
