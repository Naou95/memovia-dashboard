import { GitCommit, ExternalLink } from 'lucide-react'
import type { GitHubCommit } from '@/types/github'

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
  commits: GitHubCommit[]
}

export function CommitList({ commits }: Props) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[var(--shadow-xs)]">
      <div
        className="flex items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <GitCommit size={15} style={{ color: 'var(--memovia-violet)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Commits récents
        </span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: 'var(--accent-purple-bg)', color: 'var(--memovia-violet)' }}
        >
          {commits.length}
        </span>
      </div>

      {commits.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Aucun commit
        </p>
      ) : (
        <ul>
          {commits.map((commit, i) => (
            <li
              key={commit.sha}
              className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-black/[0.03]"
              style={
                i < commits.length - 1
                  ? { borderBottom: '1px solid var(--border-color)' }
                  : undefined
              }
            >
              <code
                className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-mono"
                style={{
                  backgroundColor: 'var(--accent-purple-bg)',
                  color: 'var(--memovia-violet)',
                }}
              >
                {commit.sha}
              </code>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[13px] font-medium leading-snug"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {commit.message}
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {commit.author} · {timeAgo(commit.date)}
                </p>
              </div>
              <a
                href={commit.url}
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
