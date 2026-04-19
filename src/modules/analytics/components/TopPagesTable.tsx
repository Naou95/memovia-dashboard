import type { PageEntry } from '@/types/analytics'

interface Props {
  pages: PageEntry[]
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname + (u.search ? u.search : '')
  } catch {
    return url
  }
}

export function TopPagesTable({ pages }: Props) {
  if (!pages.length) {
    return (
      <p className="py-6 text-center text-sm text-[var(--text-muted)]">Aucune donnée disponible</p>
    )
  }

  const max = pages[0]?.count ?? 1

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border-color)]">
            <th className="pb-2 text-left font-medium text-[var(--text-muted)]">Page</th>
            <th className="pb-2 text-right font-medium text-[var(--text-muted)]">Vues</th>
            <th className="w-32 pb-2" />
          </tr>
        </thead>
        <tbody>
          {pages.map((p, i) => (
            <tr key={i} className="border-b border-[var(--border-color)] last:border-0">
              <td className="py-2.5 pr-4">
                <span
                  className="max-w-[280px] truncate block text-[var(--text-primary)]"
                  title={p.url}
                >
                  {shortenUrl(p.url)}
                </span>
              </td>
              <td className="py-2.5 text-right font-medium tabular-nums text-[var(--text-primary)]">
                {p.count.toLocaleString('fr-FR')}
              </td>
              <td className="py-2.5 pl-4">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-color)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round((p.count / max) * 100)}%`,
                      backgroundColor: 'var(--memovia-violet)',
                      opacity: 0.7,
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
