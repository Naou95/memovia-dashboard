# Monitoring Sentry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer le module `/monitoring` — une page dashboard qui affiche les issues Sentry non résolues (7 derniers jours) avec KPIs, liste détaillée et notification automatique pour les bugs critiques.

**Architecture:** Edge Function `get-sentry` appelle l'API Sentry REST, mappe les données et notifie en fire-and-forget si des bugs critiques sont détectés. Le hook `useSentry` consomme cette fonction avec un cache 5 min en mémoire (pattern identique à `useGithub`).

**Tech Stack:** React + TypeScript + Vite, Supabase Edge Functions (Deno), Lucide icons, date-fns, Vitest + Testing Library

---

## File Map

| Action | Fichier | Responsabilité |
|--------|---------|---------------|
| Create | `supabase/migrations/00022_sentry_notification_type.sql` | Étendre le check constraint de `dashboard_notifications.type` |
| Create | `src/types/sentry.ts` | Types TypeScript pour les données Sentry |
| Create | `supabase/functions/get-sentry/index.ts` | Edge Function — appel Sentry API + notification critique |
| Create | `src/hooks/useSentry.ts` | Hook React avec cache 5 min |
| Create | `src/test/useSentry.test.ts` | Tests unitaires du hook |
| Create | `src/modules/monitoring/MonitoringPage.tsx` | Page principale — orchestration |
| Create | `src/modules/monitoring/components/MonitoringKPIs.tsx` | 3 KPI cards |
| Create | `src/modules/monitoring/components/IssueList.tsx` | Liste issues + skeleton + empty + error |
| Modify | `src/config/navigation.ts` | Ajouter entrée Monitoring dans groupe Plateforme |
| Modify | `src/router/index.tsx` | Ajouter route `/monitoring` |

---

## Task 1 : Migration SQL — étendre le check constraint

**Files:**
- Create: `supabase/migrations/00022_sentry_notification_type.sql`

La table `dashboard_notifications` utilise un `CHECK` constraint sur le champ `type` (pas un enum PostgreSQL). Il faut dropper et recréer le constraint pour ajouter `sentry_critical`.

- [ ] **Step 1 : Créer le fichier de migration**

```sql
-- supabase/migrations/00022_sentry_notification_type.sql
-- Étend le check constraint dashboard_notifications.type pour inclure sentry_critical

alter table public.dashboard_notifications
  drop constraint if exists dashboard_notifications_type_check;

alter table public.dashboard_notifications
  add constraint dashboard_notifications_type_check
  check (type in ('lead_stale', 'email_critical', 'new_lead', 'stripe_cancel', 'sentry_critical'));
```

- [ ] **Step 2 : Appliquer la migration via MCP Supabase**

Utiliser le tool MCP `apply_migration` avec :
- `project_id`: `mzjzwffpqubpruyaaxew`
- `name`: `add_sentry_notification_type`
- `query`: le contenu SQL ci-dessus

- [ ] **Step 3 : Vérifier que la contrainte est bien en place**

Via MCP `execute_sql` :
```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'dashboard_notifications_type_check';
```
Attendu : la clause `check_clause` contient `sentry_critical`.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/00022_sentry_notification_type.sql
git commit -m "feat(monitoring): migration — ajout sentry_critical dans check constraint notifications"
```

---

## Task 2 : Types TypeScript

**Files:**
- Create: `src/types/sentry.ts`

- [ ] **Step 1 : Créer le fichier de types**

```typescript
// src/types/sentry.ts

export type SentryLevel = 'fatal' | 'error' | 'warning' | 'info'

export interface SentryIssue {
  id: string
  title: string
  level: SentryLevel
  occurrences: number
  usersAffected: number
  firstSeen: string
  lastSeen: string
  permalink: string
  isCritical: boolean
}

export interface SentryStats {
  totalIssues: number
  totalOccurrences: number
  usersAffected: number
}

export interface SentryData {
  stats: SentryStats
  issues: SentryIssue[]
  fetchedAt: string
}
```

- [ ] **Step 2 : Commit**

```bash
git add src/types/sentry.ts
git commit -m "feat(monitoring): types TypeScript SentryData/SentryIssue/SentryStats"
```

---

## Task 3 : Edge Function `get-sentry`

**Files:**
- Create: `supabase/functions/get-sentry/index.ts`

- [ ] **Step 1 : Créer l'Edge Function**

```typescript
// supabase/functions/get-sentry/index.ts
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult
  const { user } = authResult

  const token = Deno.env.get('SENTRY_AUTH_TOKEN')
  const org = Deno.env.get('SENTRY_ORG')
  const project = Deno.env.get('SENTRY_PROJECT')

  if (!token || !org || !project) {
    return errorResponse('sentry_not_configured', 500)
  }

  try {
    const sentryRes = await fetch(
      `https://sentry.io/api/0/projects/${org}/${project}/issues/?query=is:unresolved&statsPeriod=7d&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!sentryRes.ok) {
      return errorResponse(`sentry_api_error: ${sentryRes.status}`, 502)
    }

    const raw: any[] = await sentryRes.json()

    const issues = raw.map((issue) => {
      const occurrences = issue.times_seen ?? 0
      const usersAffected = issue.userCount ?? issue.users?.count ?? 0
      const level = issue.level ?? 'error'
      const isCritical = (level === 'error' || level === 'fatal') && occurrences > 5

      return {
        id: issue.id,
        title: issue.title,
        level,
        occurrences,
        usersAffected,
        firstSeen: issue.firstSeen,
        lastSeen: issue.lastSeen,
        permalink: issue.permalink,
        isCritical,
      }
    })

    const stats = {
      totalIssues: issues.length,
      totalOccurrences: issues.reduce((sum, i) => sum + i.occurrences, 0),
      usersAffected: issues.reduce((sum, i) => sum + i.usersAffected, 0),
    }

    // Fire-and-forget notifications for critical issues
    const criticalIssues = issues.filter((i) => i.isCritical)
    if (criticalIssues.length > 0) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      for (const issue of criticalIssues) {
        fetch(`${supabaseUrl}/functions/v1/create-notification`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: user.id,
            type: 'sentry_critical',
            title: 'Bug critique détecté',
            message: `${issue.title} — ${issue.occurrences} occurrences`,
          }),
        }).catch(() => {}) // truly fire-and-forget
      }
    }

    return Response.json(
      { stats, issues, fetchedAt: new Date().toISOString() },
      { headers: corsHeaders },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return errorResponse(message, 502)
  }
})
```

- [ ] **Step 2 : Déployer la fonction**

```bash
npx supabase functions deploy get-sentry --project-ref mzjzwffpqubpruyaaxew
```

Attendu : `Deployed function get-sentry`

- [ ] **Step 3 : Tester manuellement (optionnel mais recommandé)**

Via le dashboard Supabase → Edge Functions → `get-sentry` → Invoke, ou :
```bash
curl -X POST https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/get-sentry \
  -H "Authorization: Bearer <ton-JWT-dashboard>" \
  -H "Content-Type: application/json"
```
Attendu : JSON avec `stats`, `issues`, `fetchedAt`.

- [ ] **Step 4 : Commit**

```bash
git add supabase/functions/get-sentry/index.ts
git commit -m "feat(monitoring): edge function get-sentry — Sentry API + notification critique"
```

---

## Task 4 : Hook `useSentry` + tests

**Files:**
- Create: `src/hooks/useSentry.ts`
- Create: `src/test/useSentry.test.ts`

- [ ] **Step 1 : Écrire le test en premier**

```typescript
// src/test/useSentry.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { mockInvoke } = vi.hoisted(() => {
  const mockInvoke = vi.fn()
  return { mockInvoke }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
  },
}))

// Import APRÈS le mock
import { useSentry, invalidateSentryCache } from '@/hooks/useSentry'
import type { SentryData } from '@/types/sentry'

const mockData: SentryData = {
  stats: { totalIssues: 2, totalOccurrences: 15, usersAffected: 3 },
  issues: [
    {
      id: 'abc123',
      title: 'TypeError: Cannot read property of undefined',
      level: 'error',
      occurrences: 10,
      usersAffected: 2,
      firstSeen: '2026-04-12T10:00:00Z',
      lastSeen: '2026-04-19T08:00:00Z',
      permalink: 'https://memovia-ai.sentry.io/issues/abc123/',
      isCritical: true,
    },
    {
      id: 'def456',
      title: 'Warning: undefined behavior in hook',
      level: 'warning',
      occurrences: 5,
      usersAffected: 1,
      firstSeen: '2026-04-15T12:00:00Z',
      lastSeen: '2026-04-18T20:00:00Z',
      permalink: 'https://memovia-ai.sentry.io/issues/def456/',
      isCritical: false,
    },
  ],
  fetchedAt: '2026-04-19T09:00:00Z',
}

describe('useSentry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateSentryCache()
  })

  it('démarre avec isLoading=true et data=null', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useSentry())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('charge les données avec succès', async () => {
    mockInvoke.mockResolvedValue({ data: mockData, error: null })
    const { result } = renderHook(() => useSentry())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
  })

  it('gère les erreurs de la fonction Edge', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('invoke failed') })
    const { result } = renderHook(() => useSentry())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('Impossible de charger les données Sentry')
  })

  it('utilise le cache si données récentes', async () => {
    mockInvoke.mockResolvedValue({ data: mockData, error: null })
    const { result: r1 } = renderHook(() => useSentry())
    await waitFor(() => expect(r1.current.isLoading).toBe(false))

    const { result: r2 } = renderHook(() => useSentry())
    await waitFor(() => expect(r2.current.isLoading).toBe(false))

    // invoke appelé une seule fois (2e hook utilise le cache)
    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(r2.current.data).toEqual(mockData)
  })

  it('refresh() invalide le cache et re-fetche', async () => {
    mockInvoke.mockResolvedValue({ data: mockData, error: null })
    const { result } = renderHook(() => useSentry())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockInvoke.mockResolvedValue({ data: { ...mockData, fetchedAt: '2026-04-19T10:00:00Z' }, error: null })
    result.current.refresh()
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(mockInvoke).toHaveBeenCalledTimes(2)
    expect(result.current.data?.fetchedAt).toBe('2026-04-19T10:00:00Z')
  })
})
```

- [ ] **Step 2 : Lancer le test — vérifier qu'il échoue**

```bash
npm test -- useSentry
```

Attendu : FAIL — `useSentry` et `invalidateSentryCache` ne sont pas définis.

- [ ] **Step 3 : Implémenter le hook**

```typescript
// src/hooks/useSentry.ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { SentryData } from '@/types/sentry'

const CACHE_TTL = 5 * 60 * 1000
let cache: { data: SentryData; ts: number } | null = null

export interface UseSentryResult {
  data: SentryData | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useSentry(): UseSentryResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<SentryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      setData(cache.data)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    supabase.functions
      .invoke<SentryData>('get-sentry')
      .then(({ data: d, error: e }) => {
        if (cancelled) return
        if (e || !d) {
          setError('Impossible de charger les données Sentry')
        } else {
          cache = { data: d, ts: Date.now() }
          setData(d)
        }
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  const refresh = useCallback(() => {
    cache = null
    setTick((t) => t + 1)
  }, [])

  return { data, isLoading, error, refresh }
}

export function invalidateSentryCache(): void {
  cache = null
}
```

- [ ] **Step 4 : Lancer le test — vérifier qu'il passe**

```bash
npm test -- useSentry
```

Attendu : PASS — 5 tests verts.

- [ ] **Step 5 : Commit**

```bash
git add src/hooks/useSentry.ts src/test/useSentry.test.ts
git commit -m "feat(monitoring): hook useSentry avec cache 5min + tests"
```

---

## Task 5 : Composant `MonitoringKPIs`

**Files:**
- Create: `src/modules/monitoring/components/MonitoringKPIs.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// src/modules/monitoring/components/MonitoringKPIs.tsx
import { Bug, RefreshCw, Users } from 'lucide-react'
import type { SentryStats } from '@/types/sentry'

interface Props {
  stats: SentryStats
}

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: number
  accent: string
}

function KpiCard({ icon, label, value, accent }: KpiCardProps) {
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
          {value.toLocaleString('fr-FR')}
        </p>
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
      </div>
    </div>
  )
}

export function MonitoringKPIsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border px-4 py-3"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
        >
          <div className="h-9 w-9 skeleton rounded-xl" />
          <div className="space-y-1.5">
            <div className="h-5 w-10 skeleton rounded" />
            <div className="h-3 w-24 skeleton rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MonitoringKPIs({ stats }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard
        icon={<Bug className="h-4.5 w-4.5" />}
        label="Bugs actifs"
        value={stats.totalIssues}
        accent="#EF4444"
      />
      <KpiCard
        icon={<RefreshCw className="h-4.5 w-4.5" />}
        label="Occurrences 7 derniers jours"
        value={stats.totalOccurrences}
        accent="#F97316"
      />
      <KpiCard
        icon={<Users className="h-4.5 w-4.5" />}
        label="Utilisateurs affectés"
        value={stats.usersAffected}
        accent="var(--memovia-violet)"
      />
    </div>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add src/modules/monitoring/components/MonitoringKPIs.tsx
git commit -m "feat(monitoring): composant MonitoringKPIs — 3 cartes stat"
```

---

## Task 6 : Composant `IssueList`

**Files:**
- Create: `src/modules/monitoring/components/IssueList.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
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
        Tout est clean — aucun bug actif sur les 7 derniers jours.
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
```

- [ ] **Step 2 : Commit**

```bash
git add src/modules/monitoring/components/IssueList.tsx
git commit -m "feat(monitoring): composant IssueList — badges niveau, dates relatives, lien Sentry"
```

---

## Task 7 : Page `MonitoringPage`

**Files:**
- Create: `src/modules/monitoring/MonitoringPage.tsx`

- [ ] **Step 1 : Créer la page**

```tsx
// src/modules/monitoring/MonitoringPage.tsx
import { Bug, RefreshCw, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useSentry } from '@/hooks/useSentry'
import { MonitoringKPIs, MonitoringKPIsSkeleton } from './components/MonitoringKPIs'
import { IssueList, IssueListSkeleton } from './components/IssueList'

export default function MonitoringPage() {
  const { data, isLoading, error, refresh } = useSentry()

  return (
    <motion.div
      className="flex flex-col gap-5 p-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Bug className="h-5 w-5" style={{ color: 'var(--memovia-violet)' }} />
          <h1 className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Monitoring Sentry
          </h1>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--bg-primary)] disabled:opacity-50"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Rafraîchir
        </button>
      </motion.div>

      {/* Error state */}
      {error && (
        <motion.div
          variants={staggerItem}
          className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-[13px] text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={refresh}
            className="ml-auto text-[12px] font-medium text-red-600 underline-offset-2 hover:underline dark:text-red-400"
          >
            Réessayer
          </button>
        </motion.div>
      )}

      {/* KPI Cards */}
      <motion.div variants={staggerItem}>
        {isLoading ? (
          <MonitoringKPIsSkeleton />
        ) : data ? (
          <MonitoringKPIs stats={data.stats} />
        ) : null}
      </motion.div>

      {/* Issues list */}
      <motion.div variants={staggerItem}>
        {isLoading ? (
          <IssueListSkeleton />
        ) : data ? (
          <IssueList issues={data.issues} />
        ) : null}
      </motion.div>
    </motion.div>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add src/modules/monitoring/MonitoringPage.tsx
git commit -m "feat(monitoring): MonitoringPage — header, KPIs, liste issues, états loading/error"
```

---

## Task 8 : Navigation + Router

**Files:**
- Modify: `src/config/navigation.ts`
- Modify: `src/router/index.tsx`

- [ ] **Step 1 : Ajouter l'import `Bug` dans navigation.ts**

Dans `src/config/navigation.ts`, modifier la ligne d'imports Lucide :

```typescript
import {
  LayoutDashboard,
  CreditCard,
  Landmark,
  FileText,
  Users2,
  KanbanSquare,
  Calendar,
  UsersRound,
  Zap,
  Map,
  Mail,
  Github,
  BarChart3,
  BarChart2,
  UserCog,
  Receipt,
  Bug,
} from 'lucide-react'
```

- [ ] **Step 2 : Ajouter l'entrée Monitoring dans le groupe `platform`**

Dans `src/config/navigation.ts`, modifier le tableau `items` du groupe `platform` (id: `'platform'`). Ajouter après `realtime` et avant `roadmap` :

```typescript
{
  id: 'platform',
  label: 'Plateforme',
  items: [
    {
      id: 'users',
      label: 'Utilisateurs MEMOVIA',
      path: '/utilisateurs',
      icon: UsersRound,
      status: 'active',
      allowedRoles: [],
    },
    {
      id: 'realtime',
      label: 'Realtime',
      path: '/realtime',
      icon: Zap,
      status: 'active',
      allowedRoles: [],
    },
    {
      id: 'monitoring',
      label: 'Monitoring',
      path: '/monitoring',
      icon: Bug,
      status: 'active',
      allowedRoles: [],
    },
    {
      id: 'roadmap',
      label: 'Roadmap & Feedback',
      path: '/roadmap',
      icon: Map,
      status: 'active',
      allowedRoles: [],
    },
  ],
},
```

- [ ] **Step 3 : Ajouter le lazy import et la route dans `src/router/index.tsx`**

Ajouter l'import lazy après la ligne `RealtimePage` :

```typescript
const MonitoringPage = lazy(() => import('@/modules/monitoring/MonitoringPage'))
```

Ajouter la route après la route `realtime` dans le tableau `children` :

```typescript
{
  path: 'monitoring',
  element: (
    <Suspense fallback={<PageLoader />}>
      <MonitoringPage />
    </Suspense>
  ),
},
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'il n'y a pas de régression**

```bash
npm test
```

Attendu : tous les tests passent (aucune régression sur Sidebar, navigation, etc.).

- [ ] **Step 5 : Commit**

```bash
git add src/config/navigation.ts src/router/index.tsx
git commit -m "feat(monitoring): ajout route /monitoring et entrée sidebar groupe Plateforme"
```

---

## Task 9 : Push final

- [ ] **Step 1 : Vérifier que tous les tests passent**

```bash
npm test
```

Attendu : PASS sur tous les suites (useSentry + suites existantes).

- [ ] **Step 2 : Vérifier le build**

```bash
npm run build
```

Attendu : build sans erreur TypeScript.

- [ ] **Step 3 : Push**

```bash
git push origin main
```

---

## Self-Review

**Couverture du spec :**
- ✅ Edge Function `get-sentry` avec appel Sentry API (Task 3)
- ✅ Issues : titre, niveau, occurrences, utilisateurs, firstSeen, lastSeen, permalink (Task 3 + 6)
- ✅ Stats globales : totalIssues, totalOccurrences, usersAffected (Task 3)
- ✅ 3 KPI cards (Task 5)
- ✅ Badge niveau : fatal/error/warning/info (Task 6)
- ✅ Bouton "Voir sur Sentry" avec lien externe (Task 6)
- ✅ Bouton "Rafraîchir" (Task 7)
- ✅ Notifications in-app si bug critique (Task 3)
- ✅ Migration SQL `sentry_critical` (Task 1)
- ✅ Déploiement Edge Function (Task 3)
- ✅ Sidebar groupe Plateforme, icône Bug (Task 8)
- ✅ Route `/monitoring` (Task 8)

**Placeholders :** aucun TBD dans le plan.

**Cohérence des types :**
- `SentryData`, `SentryIssue`, `SentryStats`, `SentryLevel` définis en Task 2, utilisés de manière cohérente dans Tasks 4, 5, 6, 7.
- `invalidateSentryCache` exporté dans Task 4, utilisé dans les tests.
- `MonitoringKPIsSkeleton` exporté dans Task 5, utilisé dans Task 7.
- `IssueListSkeleton` exporté dans Task 6, utilisé dans Task 7.
