import { GitPullRequest, ExternalLink } from 'lucide-react'
import type { GitHubPR } from '@/types/github'

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
  pullRequests: GitHubPR[]
}

export function PullRequestList({ pullRequests }: Props) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[var(--shadow-xs)]">
      <div
        className="flex items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <GitPullRequest size={15} style={{ color: '#a855f7' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Pull Requests
        </span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: 'rgba(168,85,247,0.1)', color: '#a855f7' }}
        >
          {pullRequests.length}
        </span>
      </div>

      {pullRequests.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Aucune PR ouverte
        </p>
      ) : (
        <ul>
          {pullRequests.map((pr, i) => (
            <li
              key={pr.number}
              className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-black/[0.03]"
              style={
                i < pullRequests.length - 1
                  ? { borderBottom: '1px solid var(--border-color)' }
                  : undefined
              }
            >
              <GitPullRequest
                size={14}
                className="mt-0.5 shrink-0"
                style={{ color: pr.draft ? 'var(--text-muted)' : '#a855f7' }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className="truncate text-[13px] font-medium leading-snug"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {pr.title}
                  </p>
                  {pr.draft && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: 'var(--accent-purple-bg)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Draft
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  #{pr.number} · {pr.author} · {timeAgo(pr.createdAt)}
                </p>
              </div>
              <a
                href={pr.url}
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
