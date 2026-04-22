import { Workflow, ExternalLink, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'
import type { GitHubWorkflowRun } from '@/types/github'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 60) return `il y a ${minutes}m`
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${days}j`
}

function RunStatus({ run }: { run: GitHubWorkflowRun }) {
  if (run.status === 'in_progress' || run.status === 'queued' || run.status === 'waiting') {
    return (
      <div className="flex items-center gap-1.5">
        <Loader2 size={13} className="animate-spin" style={{ color: '#f59e0b' }} />
        <span className="text-[11px] font-medium" style={{ color: '#f59e0b' }}>
          {run.status === 'in_progress' ? 'En cours' : 'En attente'}
        </span>
      </div>
    )
  }
  if (run.conclusion === 'success') {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
        <span className="text-[11px] font-medium" style={{ color: '#22c55e' }}>
          Succès
        </span>
      </div>
    )
  }
  if (run.conclusion === 'failure') {
    return (
      <div className="flex items-center gap-1.5">
        <XCircle size={13} style={{ color: '#ef4444' }} />
        <span className="text-[11px] font-medium" style={{ color: '#ef4444' }}>
          Échec
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <Clock size={13} style={{ color: 'var(--text-muted)' }} />
      <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
        {run.conclusion ?? 'Annulé'}
      </span>
    </div>
  )
}

interface Props {
  runs: GitHubWorkflowRun[]
}

export function WorkflowRuns({ runs }: Props) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[var(--shadow-xs)]">
      <div
        className="flex items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <Workflow size={15} style={{ color: '#f59e0b' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          CI/CD — GitHub Actions
        </span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}
        >
          {runs.length}
        </span>
      </div>

      {runs.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Aucun workflow trouvé
        </p>
      ) : (
        <ul>
          {runs.map((run, i) => (
            <li
              key={run.id}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.03]"
              style={
                i < runs.length - 1
                  ? { borderBottom: '1px solid var(--border-color)' }
                  : undefined
              }
            >
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[13px] font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {run.name}
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {run.branch} · {timeAgo(run.createdAt)}
                </p>
              </div>
              <RunStatus run={run} />
              <a
                href={run.url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
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
