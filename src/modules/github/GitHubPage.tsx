import { Github, RefreshCw, Star, GitFork, CircleDot, GitPullRequest, Code2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useGithub, invalidateGithubCache } from '@/hooks/useGithub'
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
      className="flex items-center gap-3 rounded-2xl border px-4 py-3"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
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
    <div
      className="rounded-2xl border"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
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
  const { data, isLoading, error } = useGithub()

  const handleRefresh = () => {
    invalidateGithubCache()
    window.location.reload()
  }

  return (
    <motion.div className="flex h-full flex-col gap-4 overflow-y-auto p-6" variants={staggerContainer} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={staggerItem} className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--accent-purple-bg)' }}
          >
            <Github size={20} style={{ color: 'var(--memovia-violet)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              GitHub
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              naou95/memovia-ia-notes
              {data?.stats.description ? ` — ${data.stats.description}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="rounded-lg p-2 transition-colors hover:bg-black/5 disabled:opacity-50"
          title="Rafraîchir"
        >
          <RefreshCw
            size={16}
            style={{ color: 'var(--text-muted)' }}
            className={isLoading ? 'animate-spin' : ''}
          />
        </button>
      </motion.div>

      {/* Error */}
      {error && !isLoading && (
        <motion.div
          variants={staggerItem}
          className="shrink-0 rounded-xl border px-4 py-3 text-sm"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.06)',
            borderColor: 'rgba(239, 68, 68, 0.25)',
            color: '#ef4444',
          }}
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
              className="h-16 skeleton rounded-2xl border"
              style={{ borderColor: 'var(--border-color)' }}
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
        <motion.p variants={staggerItem} className="shrink-0 pb-2 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Données GitHub · mise à jour {new Date(data.fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </motion.p>
      )}
    </motion.div>
  )
}
