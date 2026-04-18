import { CircleDot, ExternalLink } from 'lucide-react'
import type { GitHubIssue } from '@/types/github'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 60) return `il y a ${minutes}m`
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${days}j`
}

interface Props {
  issues: GitHubIssue[]
}

export function IssueList({ issues }: Props) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <CircleDot size={15} style={{ color: '#22c55e' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Issues ouvertes
        </span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e' }}
        >
          {issues.length}
        </span>
      </div>

      {issues.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Aucune issue ouverte
        </p>
      ) : (
        <ul>
          {issues.map((issue, i) => (
            <li
              key={issue.number}
              className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-black/[0.03]"
              style={
                i < issues.length - 1
                  ? { borderBottom: '1px solid var(--border-color)' }
                  : undefined
              }
            >
              <CircleDot size={14} className="mt-0.5 shrink-0" style={{ color: '#22c55e' }} />
              <div className="min-w-0 flex-1">
                <p
                  className="text-[13px] font-medium leading-snug"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {issue.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    #{issue.number} · {issue.author} · {timeAgo(issue.createdAt)}
                  </span>
                  {issue.labels.map((label) => (
                    <span
                      key={label.name}
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `#${label.color}22`,
                        color: `#${label.color}`,
                        border: `1px solid #${label.color}44`,
                      }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              </div>
              <a
                href={issue.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <ExternalLink size={13} style={{ color: 'var(--text-muted)' }} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
