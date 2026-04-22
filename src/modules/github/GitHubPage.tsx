import { RefreshCw, Star, GitFork, CircleDot, GitPullRequest, Code2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useGithub, invalidateGithubCache } from '@/hooks/useGithub'
import { CacheFreshness } from '@/components/shared/CacheFreshness'
import { CommitList } from './components/CommitList'
import { IssueList } from './components/IssueList'
import { PullRequestList } from './components/PullRequestList'
import { WorkflowRuns } from './components/WorkflowRuns'

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  accent: string
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 shadow-[var(--shadow-xs)]"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${accent}18` }}
      >
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div>
        <p className="text-lg font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
          {value}
        </p>
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
      </div>
    </div>
  )
}

function SkeletonCard({ lines = 4 }: { lines?: number }) {
  return (
    <div className="rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[var(--shadow-xs)]">
      <div
        className="flex items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="h-4 w-4 skeleton rounded" />
        <div className="h-4 w-28 skeleton rounded" />
      </div>
      <div className="space-y-0">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3" style={i < lines - 1 ? { borderBottom: '1px solid var(--border-color)' } : undefined}>
            <div className="mt-0.5 h-4 w-12 skeleton rounded" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 skeleton rounded" />
              <div className="h-2.5 w-1/3 skeleton rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GitHubPage() {
  const { data, isLoading, error, lastFetchedAt } = useGithub()

  const handleRefresh = () => {
    invalidateGithubCache()
    window.location.reload()
  }

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            GitHub
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            naou95/memovia-ia-notes
            {data?.stats.description ? ` — ${data.stats.description}` : ''}
            {lastFetchedAt && <> · <CacheFreshness timestamp={lastFetchedAt} /></>}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 text-[12px] font-medium text-[var(--text-secondary)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
          aria-label="Rafraîchir les données GitHub"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Rafraîchir
        </button>
      </motion.div>

      {/* Error */}
      {error && !isLoading && (
        <motion.div
          variants={staggerItem}
          role="alert"
          className="rounded-[8px] border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          {error} — Vérifiez le secret Supabase GITHUB_TOKEN
        </motion.div>
      )}

      {/* Stats row skeleton */}
      {isLoading && (
        <motion.div variants={staggerItem} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 skeleton rounded-[8px] border border-[var(--border-color)]"
            />
          ))}
        </motion.div>
      )}

      {/* Stats row */}
      {data && (
        <motion.div variants={staggerItem} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard icon={<Star size={16} />} label="Stars" value={data.stats.stars} accent="#f59e0b" />
          <StatCard icon={<GitFork size={16} />} label="Forks" value={data.stats.forks} accent="#3b82f6" />
          <StatCard icon={<CircleDot size={16} />} label="Issues ouvertes" value={data.stats.openIssues} accent="#22c55e" />
          <StatCard icon={<GitPullRequest size={16} />} label="Pull Requests" value={data.stats.openPRs} accent="#a855f7" />
          <StatCard
            icon={<Code2 size={16} />}
            label="Langage"
            value={data.stats.language ?? '—'}
            accent="var(--memovia-violet)"
          />
        </motion.div>
      )}

      {/* Main content skeleton */}
      {isLoading && (
        <motion.div variants={staggerItem} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <SkeletonCard lines={8} />
            <SkeletonCard lines={4} />
          </div>
          <div className="flex flex-col gap-4">
            <SkeletonCard lines={5} />
            <SkeletonCard lines={3} />
          </div>
        </motion.div>
      )}

      {/* Main content */}
      {data && (
        <motion.div variants={staggerItem} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <CommitList commits={data.commits} />
            <WorkflowRuns runs={data.workflowRuns} />
          </div>
          <div className="flex flex-col gap-4">
            <IssueList issues={data.issues} />
            <PullRequestList pullRequests={data.pullRequests} />
          </div>
        </motion.div>
      )}

      {/* Fetch time */}
      {data && (
        <motion.p variants={staggerItem} className="shrink-0 pb-2 text-center text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
          Données GitHub · mise à jour {new Date(data.fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </motion.p>
      )}
    </motion.div>
  )
}
