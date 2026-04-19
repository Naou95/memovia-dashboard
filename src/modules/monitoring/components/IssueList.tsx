// src/modules/monitoring/components/IssueList.tsx
import { ExternalLink, RefreshCw, Users, CheckCircle2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { SentryIssue, SentryLevel } from '@/types/sentry'

// ── Level badge ──────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<SentryLevel, { label: string; bg: string; text: string }> = {
  fatal:   { label: 'Fatal',   bg: '#7F1D1D', text: '#FCA5A5' },
  error:   { label: 'Error',   bg: '#FEE2E2', text: '#DC2626' },
  warning: { label: 'Warning', bg: '#FFF7ED', text: '#EA580C' },
  info:    { label: 'Info',    bg: '#EFF6FF', text: '#2563EB' },
}

function LevelBadge({ level }: { level: SentryLevel }) {
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.error
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function IssueListSkeleton() {
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
        <div className="h-4 w-40 skeleton rounded" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3"
          style={i < 7 ? { borderBottom: '1px solid var(--border-color)' } : undefined}
        >
          <div className="h-5 w-14 skeleton rounded-md" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-3/4 skeleton rounded" />
            <div className="h-3 w-1/2 skeleton rounded" />
          </div>
          <div className="h-7 w-24 skeleton rounded-lg" />
        </div>
      ))}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-12">
      <CheckCircle2 className="h-10 w-10" style={{ color: '#22C55E' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        Aucune issue non résolue
      </p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Tout est clean — aucun bug actif sur les 14 derniers jours.
      </p>
    </div>
  )
}

// ── Issue row ─────────────────────────────────────────────────────────────────

function IssueRow({ issue, isLast }: { issue: SentryIssue; isLast: boolean }) {
  const lastSeen = formatDistanceToNow(new Date(issue.lastSeen), { addSuffix: true, locale: fr })
  const firstSeen = formatDistanceToNow(new Date(issue.firstSeen), { addSuffix: true, locale: fr })

  return (
    <div
      className="flex items-start gap-3 px-4 py-3"
      style={!isLast ? { borderBottom: '1px solid var(--border-color)' } : undefined}
    >
      <LevelBadge level={issue.level} />
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[13px] font-medium"
          style={{ color: 'var(--text-primary)' }}
          title={issue.title}
        >
          {issue.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            {issue.occurrences} occurrence{issue.occurrences > 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {issue.usersAffected} utilisateur{issue.usersAffected > 1 ? 's' : ''}
          </span>
          <span>Première vue : {firstSeen}</span>
          <span>Dernière vue : {lastSeen}</span>
        </div>
      </div>
      <a
        href={issue.permalink}
        target="_blank"
        rel="noopener noreferrer"
        className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-[var(--bg-primary)]"
        style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
      >
        <ExternalLink className="h-3 w-3" />
        Voir sur Sentry
      </a>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  issues: SentryIssue[]
}

export function IssueList({ issues }: Props) {
  const sorted = [...issues].sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
  )

  return (
    <div
      className="rounded-2xl border"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Issues non résolues
        </span>
        <span
          className="rounded-full px-2 py-px text-[11px] font-medium"
          style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}
        >
          {issues.length}
        </span>
      </div>
      {sorted.length === 0 ? (
        <EmptyState />
      ) : (
        sorted.map((issue, idx) => (
          <IssueRow key={issue.id} issue={issue} isLast={idx === sorted.length - 1} />
        ))
      )}
    </div>
  )
}
