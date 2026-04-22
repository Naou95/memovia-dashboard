import { useEffect, useMemo, useState } from 'react'
import {
  DollarSign, Users, Landmark, UserMinus, Bot, AlertTriangle, Activity,
  Calendar, Mail, CheckSquare, Phone, UserPlus, CreditCard, Sun, ArrowRight, RefreshCw,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useOverviewKpis } from '@/hooks/useOverviewKpis'
import { useStripeFinance } from '@/hooks/useStripeFinance'
import { useQontoFinance } from '@/hooks/useQontoFinance'
import { useTasks } from '@/hooks/useTasks'
import { useLeads } from '@/hooks/useLeads'
import { useContracts } from '@/hooks/useContracts'
import { useIaBriefing } from '@/hooks/useIaBriefing'
import { useCalendar } from '@/hooks/useCalendar'
import { useEmail } from '@/hooks/useEmail'
import { useMemoviaUsers } from '@/hooks/useMemoviaUsers'
import { KpiCard } from '@/components/shared/KpiCard'
import { RevenueBarChart } from '@/components/shared/RevenueBarChart'
import { ProfitLossChart } from '@/components/shared/ProfitLossChart'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { staggerContainer, staggerItem, cardGridContainer, staggerCard } from '@/lib/motion'
import { TaskDetailModal } from '@/modules/tasks/components/TaskDetailModal'
import { TaskForm } from '@/modules/tasks/components/TaskForm'
import type { Task, TaskUpdate } from '@/types/tasks'

// ── Formatters ─────────────────────────────────────────────────────────────────

const frNum = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const formatEur = (val: number) => frNum.format(val)

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return "à l'instant"
  if (mins < 60) return `il y a ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${Math.floor(hours / 24)}j`
}

function toLocalDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Status labels ───────────────────────────────────────────────────────────────

const TASK_STATUS: Record<string, string> = {
  todo: 'À faire',
  en_cours: 'En cours',
  done: 'Terminé',
}
const LEAD_STATUS: Record<string, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  en_discussion: 'En discussion',
  proposition: 'Proposition',
  gagne: 'Gagné',
  perdu: 'Perdu',
}
const CONTRACT_STATUS: Record<string, string> = {
  prospect: 'Prospect',
  negotiation: 'Négociation',
  signe: 'Signé',
  actif: 'Actif',
  resilie: 'Résilié',
}

const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', b2b: 'B2B' }
const PLAN_COLOR: Record<string, string> = {
  free: 'bg-gray-50 text-gray-600 border-gray-200',
  pro: 'bg-violet-50 text-violet-700 border-violet-200',
  b2b: 'bg-blue-50 text-blue-700 border-blue-200',
}

// ── Day item shape ──────────────────────────────────────────────────────────────

interface DayItem {
  key: string
  Icon: React.ElementType
  iconBg: string
  iconColor: string
  label: string
  subtitle?: string
  badge?: string
  badgeClass?: string
  href: string
}

// ── Alert row — actionable ────────────────────────────────────────────────────

interface AlertRowProps {
  color: string
  icon: React.ElementType
  label: string
  onClick: () => void
}

function AlertRow({ color, icon: Icon, label, onClick }: AlertRowProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-r-md bg-[var(--bg-secondary)] px-4 py-3"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`, color }}
      >
        <Icon size={14} strokeWidth={2.25} />
      </span>
      <span className="flex-1 text-[13px] text-[var(--text-primary)]">{label}</span>
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      >
        Voir <ArrowRight size={12} />
      </button>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [deferSecondary, setDeferSecondary] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  useEffect(() => {
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(() => setDeferSecondary(true))
      return () => cancelIdleCallback(id)
    }
    const t = setTimeout(() => setDeferSecondary(true), 100)
    return () => clearTimeout(t)
  }, [])

  // ── Existing data hooks ──
  const { stripe, stripeError, isLoading: stripeKpiLoading } = useOverviewKpis()
  const { data: stripeFinance, isLoading: stripeFinanceLoading } = useStripeFinance()
  const { data: qontoFinance, isLoading: qontoFinanceLoading, error: qontoError } = useQontoFinance()
  const { tasks, isLoading: tasksLoading, updateTask, deleteTask } = useTasks()
  const { leads, isLoading: leadsLoading } = useLeads()
  const { contracts, isLoading: contractsLoading } = useContracts()

  // ── New data hooks ──
  const { data: calendarData, isLoading: calendarLoading } = useCalendar(new Date(), { enabled: deferSecondary })
  const { alerts: emailAlerts, isLoading: emailLoading, loadEmails } = useEmail()

  const since24h = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), [])
  const { users: newUsers24h, isLoading: newUsersLoading } = useMemoviaUsers(deferSecondary ? since24h : null, { enabled: deferSecondary })

  useEffect(() => {
    if (deferSecondary) loadEmails()
  }, [deferSecondary, loadEmails])

  // ── Greeting ──
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const firstName = user?.profile.full_name?.split(' ')[0] ?? 'admin'

  const revenueLast6Months = stripeFinance?.revenueByMonth?.slice(-6) ?? []
  const mrrTrend = revenueLast6Months.map((m) => m.revenue)

  // Delta MoM approximatif basé sur le chiffre d'affaires facturé des 2 derniers mois
  const mrrDeltaMoM = useMemo<number | undefined>(() => {
    const series = stripeFinance?.revenueByMonth ?? []
    if (series.length < 2) return undefined
    const curr = series[series.length - 1]?.revenue ?? 0
    const prev = series[series.length - 2]?.revenue ?? 0
    if (prev <= 0) return undefined
    return Math.round(((curr - prev) / prev) * 100)
  }, [stripeFinance])

  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  // ── Derive which assignee key maps to the current user ──
  const myAssignee = useMemo(() => {
    const name = (user?.profile.full_name ?? '').toLowerCase()
    const email = (user?.profile.email ?? '').toLowerCase()
    if (name.includes('naoufel') || email.includes('naoufel')) return 'naoufel'
    if (name.includes('emir') || email.includes('emir')) return 'emir'
    return null
  }, [user])

  // ── Existing derived data ──
  const overdueTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.status !== 'done' && t.due_date && t.due_date < today),
    [tasks, today],
  )

  const overdueLeads = useMemo(
    () =>
      (leads ?? []).filter(
        (l) =>
          l.follow_up_date &&
          l.follow_up_date < today &&
          l.status !== 'gagne' &&
          l.status !== 'perdu',
      ),
    [leads, today],
  )

  const recentActivity = useMemo(() => {
    const items = [
      ...(tasks ?? []).map((t) => ({
        id: t.id,
        type: 'task' as const,
        label: t.title,
        status: TASK_STATUS[t.status] ?? t.status,
        updatedAt: t.updated_at,
      })),
      ...(leads ?? []).map((l) => ({
        id: l.id,
        type: 'lead' as const,
        label: l.name,
        status: LEAD_STATUS[l.status] ?? l.status,
        updatedAt: l.updated_at,
      })),
      ...(contracts ?? []).map((c) => ({
        id: c.id,
        type: 'contract' as const,
        label: c.organization_name,
        status: CONTRACT_STATUS[c.status] ?? c.status,
        updatedAt: c.updated_at,
      })),
    ]
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
  }, [tasks, leads, contracts])

  // ── "Votre journée" — items aggregated per user ──
  const myTodayTasks = useMemo(
    () =>
      (tasks ?? []).filter(
        (t) =>
          t.status !== 'done' &&
          t.due_date != null &&
          t.due_date <= today &&
          (myAssignee === null || t.assigned_to === myAssignee),
      ),
    [tasks, today, myAssignee],
  )

  const myUrgentLeads = useMemo(
    () =>
      (leads ?? []).filter(
        (l) =>
          l.status !== 'gagne' &&
          l.status !== 'perdu' &&
          (myAssignee === null || l.assigned_to === myAssignee) &&
          (
            l.status === 'en_discussion' ||
            l.status === 'proposition' ||
            (!!l.follow_up_date && l.follow_up_date <= today)
          ),
      ),
    [leads, today, myAssignee],
  )

  const todayCalendarEvents = useMemo(() => {
    if (!calendarData?.events) return []
    return calendarData.events
      .filter((e) => toLocalDate(e.start) === today)
      .sort((a, b) => a.start.localeCompare(b.start))
  }, [calendarData, today])

  const myDayItems = useMemo<DayItem[]>(() => {
    const items: DayItem[] = []

    for (const t of myTodayTasks) {
      const overdue = t.due_date! < today
      items.push({
        key: `task-${t.id}`,
        Icon: CheckSquare,
        iconBg: 'bg-violet-50',
        iconColor: 'text-violet-600',
        label: t.title,
        badge: overdue ? 'En retard' : "Aujourd'hui",
        badgeClass: overdue
          ? 'bg-red-50 text-red-700 border border-red-200'
          : 'bg-orange-50 text-orange-700 border border-orange-200',
        href: '/taches',
      })
    }

    for (const l of myUrgentLeads) {
      const isOverdue = !!l.follow_up_date && l.follow_up_date < today
      const isHot = l.status === 'proposition'
      items.push({
        key: `lead-${l.id}`,
        Icon: Phone,
        iconBg: isHot ? 'bg-amber-50' : 'bg-cyan-50',
        iconColor: isHot ? 'text-amber-600' : 'text-cyan-600',
        label: l.name,
        subtitle: l.next_action ?? undefined,
        badge: isOverdue ? 'Relance' : (LEAD_STATUS[l.status] ?? l.status),
        badgeClass: isOverdue
          ? 'bg-red-50 text-red-700 border border-red-200'
          : isHot
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-cyan-50 text-cyan-700 border border-cyan-200',
        href: '/prospection',
      })
    }

    for (const e of todayCalendarEvents) {
      const startTime = e.allDay
        ? 'Toute la journée'
        : new Date(e.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      items.push({
        key: `cal-${e.id}`,
        Icon: Calendar,
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        label: e.title,
        badge: startTime,
        badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
        href: '/calendrier',
      })
    }

    for (const a of (Array.isArray(emailAlerts) ? emailAlerts : [])) {
      items.push({
        key: `email-${a.uid}`,
        Icon: Mail,
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
        label: a.subject || `De : ${a.from?.name ?? a.from?.address ?? '?'}`,
        badge: `+${Math.round(a.hoursUnread ?? 0)}h`,
        badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
        href: '/email-drafter',
      })
    }

    return items
  }, [myTodayTasks, myUrgentLeads, todayCalendarEvents, emailAlerts, today])

  // Fallback: if no items for today, show next 3 assigned tasks (any due date)
  const myFallbackTasks = useMemo(
    () => {
      if (myDayItems.length > 0) return []
      return (tasks ?? [])
        .filter((t) => t.status !== 'done' && (myAssignee === null || t.assigned_to === myAssignee))
        .slice(0, 3)
    },
    [myDayItems, tasks, myAssignee],
  )

  const dayLoading = tasksLoading || leadsLoading || calendarLoading || emailLoading

  // ── "Actus MEMOVIA 24h" — new signups + Stripe ──
  const newStripe24h = useMemo(() => {
    if (!stripeFinance?.subscriptions) return []
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return stripeFinance.subscriptions.filter(
      (s) => new Date(s.startDate).getTime() >= cutoff,
    )
  }, [stripeFinance])

  // ── IA Briefing ──
  const briefingEnabled = !stripeKpiLoading && !tasksLoading && !leadsLoading
  const { briefing, isLoading: briefingLoading, isStreaming: briefingStreaming, regenerate: regenerateBriefing } = useIaBriefing({
    enabled: briefingEnabled,
    mrr: stripe?.mrr ?? null,
    qontoBalance: qontoFinance?.balance ?? null,
    cancelingCount: stripe?.cancelingAtPeriodEnd ?? 0,
    overdueTasks: overdueTasks.length,
    overdueLeads: overdueLeads.length,
  })

  const hasAlerts =
    (stripe?.cancelingAtPeriodEnd ?? 0) > 0 ||
    overdueTasks.length > 0 ||
    overdueLeads.length > 0

  const dataLoading = tasksLoading || leadsLoading || stripeKpiLoading

  const plTotal = useMemo(() => {
    if (!qontoFinance) return null
    return (qontoFinance.monthlyCashFlow ?? []).reduce((sum, m) => sum + m.net, 0)
  }, [qontoFinance])

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* ── Greeting header ── */}
      <motion.header variants={staggerItem}>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          {greeting}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Voici un aperçu de MEMOVIA AI aujourd'hui.
        </p>
      </motion.header>

      {/* ── Votre journée ── */}
      <ErrorBoundary>
      <motion.div
        variants={staggerItem}
        className="overflow-hidden rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      >
        <div className="mb-4 flex items-center gap-2">
          <Sun size={15} className="text-amber-500" />
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Votre journée</h3>
          {(myDayItems.length > 0 || myFallbackTasks.length > 0) && (
            <span className="rounded-full bg-[var(--memovia-violet)] px-2 py-0.5 text-[11px] font-semibold text-white">
              {myDayItems.length || myFallbackTasks.length}
            </span>
          )}
        </div>

        {dayLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-9 rounded-md" />
            ))}
          </div>
        ) : myDayItems.length > 0 ? (
          <div className="divide-y divide-[var(--border-color)]">
            {myDayItems.map((item) => {
              const isTaskItem = item.key.startsWith('task-')
              const taskId = isTaskItem ? item.key.slice(5) : null
              const innerContent = (
                <>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`shrink-0 rounded-lg p-1.5 ${item.iconBg}`}>
                      <item.Icon size={13} className={item.iconColor} />
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate text-[13px] text-[var(--text-primary)]">
                        {item.label}
                      </span>
                      {item.subtitle && (
                        <span className="block truncate text-[11px] text-[var(--text-muted)]">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-2">
                    {item.badge && (
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.badgeClass}`}>
                        {item.badge}
                      </span>
                    )}
                    <ArrowRight size={12} className="text-[var(--text-muted)]" />
                  </div>
                </>
              )
              if (isTaskItem) {
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      const task = tasks.find((t) => t.id === taskId)
                      if (task) setSelectedTask(task)
                    }}
                    className="-mx-5 w-full flex items-center justify-between px-5 py-2.5 text-left transition first:pt-0 last:pb-0 hover:bg-[var(--bg-hover)] active:scale-[0.995] duration-150 ease-out"
                  >
                    {innerContent}
                  </button>
                )
              }
              return (
                <Link
                  key={item.key}
                  to={item.href}
                  className="-mx-5 flex items-center justify-between px-5 py-2.5 transition first:pt-0 last:pb-0 hover:bg-[var(--bg-hover)] active:scale-[0.995] duration-150 ease-out"
                >
                  {innerContent}
                </Link>
              )
            })}
          </div>
        ) : myFallbackTasks.length > 0 ? (
          <>
            <p className="mb-3 text-[12px] text-[var(--text-muted)]">Prochaines tâches assignées</p>
            <div className="divide-y divide-[var(--border-color)]">
              {myFallbackTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTask(t)}
                  className="-mx-5 w-full flex items-center justify-between px-5 py-2.5 text-left transition first:pt-0 last:pb-0 hover:bg-[var(--bg-hover)] active:scale-[0.995] duration-150 ease-out"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 rounded-lg p-1.5 bg-violet-50">
                      <CheckSquare size={13} className="text-violet-600" />
                    </span>
                    <span className="truncate text-[13px] text-[var(--text-primary)]">{t.title}</span>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-2">
                    <span className="rounded-md border px-2 py-0.5 text-[11px] font-medium bg-gray-50 text-gray-500 border-gray-200">
                      {t.due_date ?? 'Sans échéance'}
                    </span>
                    <ArrowRight size={12} className="text-[var(--text-muted)]" />
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[13px] text-[var(--text-muted)]">Rien de prévu aujourd'hui.</p>
        )}
      </motion.div>
      </ErrorBoundary>

      {/* ── Briefing IA du jour ── */}
      <motion.div
        variants={staggerItem}
        className="rounded-[8px] border border-[var(--memovia-violet-light)] bg-[var(--memovia-violet-light)]/60 p-5"
      >
        <div className="mb-3 flex items-center gap-2">
          <Bot size={15} className="text-[var(--memovia-violet)]" />
          <span className="text-[13px] font-semibold text-[var(--memovia-violet)]">Briefing IA du jour</span>
          {briefingStreaming && (
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--memovia-violet)]"
              role="status"
              aria-label="Génération du briefing en cours"
            />
          )}
          <button
            onClick={regenerateBriefing}
            disabled={briefingLoading || briefingStreaming}
            className="ml-auto rounded-lg p-1 text-[var(--memovia-violet)] opacity-50 transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-20"
            title="Régénérer le briefing"
            aria-label="Régénérer le briefing IA"
          >
            <RefreshCw size={13} className={briefingStreaming ? 'animate-spin' : ''} />
          </button>
        </div>

        {briefingLoading && !briefing ? (
          <div className="space-y-2">
            <div className="skeleton h-3 w-full rounded-full" />
            <div className="skeleton h-3 w-5/6 rounded-full" />
            <div className="skeleton h-3 w-3/5 rounded-full" />
          </div>
        ) : briefing ? (
          <p className="text-[14px] leading-relaxed text-[var(--text-primary)]">{briefing}</p>
        ) : (
          <p className="text-[13px] text-[var(--text-muted)]">Chargement du briefing…</p>
        )}
      </motion.div>

      {/* ── KPI cards — 2×2 grid, hauteur égale min-h-[160px] ── */}
      <motion.div
        variants={cardGridContainer}
        className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <motion.div variants={staggerCard} className="min-h-[160px] [&>article]:h-full">
          <KpiCard
            label="MRR"
            value={stripe ? formatEur(stripe.mrr_total ?? stripe.mrr) : null}
            rawValue={stripe ? (stripe.mrr_total ?? stripe.mrr) : undefined}
            formatter={formatEur}
            unit="€"
            accent="violet"
            icon={DollarSign}
            isLoading={stripeKpiLoading}
            error={stripeError}
            trend={mrrTrend.length >= 2 ? mrrTrend : undefined}
            sensitive
            delta={mrrDeltaMoM}
            footer={
              stripe && (stripe.mrr_contracts ?? 0) > 0
                ? `dont ${formatEur(stripe.mrr_contracts)}€ B2B`
                : undefined
            }
          />
        </motion.div>
        <motion.div variants={staggerCard} className="min-h-[160px] [&>article]:h-full">
          <KpiCard
            label="Abonnés actifs"
            value={stripe ? String(stripe.activeSubscribers) : null}
            rawValue={stripe?.activeSubscribers}
            accent="cyan"
            icon={Users}
            isLoading={stripeKpiLoading}
            error={stripeError}
          />
        </motion.div>
        <motion.div variants={staggerCard} className="min-h-[160px] [&>article]:h-full">
          <KpiCard
            label="Solde Qonto"
            value={qontoFinance ? formatEur(qontoFinance.balance) : null}
            rawValue={qontoFinance?.balance}
            formatter={formatEur}
            unit="€"
            accent="blue"
            icon={Landmark}
            isLoading={qontoFinanceLoading}
            error={qontoError}
            sensitive
          />
        </motion.div>
        <motion.div variants={staggerCard} className="min-h-[160px] [&>article]:h-full">
          <KpiCard
            label="Annulations en cours"
            value={stripe ? String(stripe.cancelingAtPeriodEnd) : null}
            rawValue={stripe?.cancelingAtPeriodEnd}
            accent="red"
            icon={UserMinus}
            isLoading={stripeKpiLoading}
            error={stripeError}
          />
        </motion.div>
      </motion.div>

      {/* ── Flux financier + Revenus facturés ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <motion.div
          variants={staggerItem}
          className="rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
        >
          <div className="mb-2 flex items-start justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                Flux financier
              </h3>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                Entrées vs sorties — 6 derniers mois
              </p>
            </div>
            {plTotal !== null && (
              <span
                className="text-[13px] font-semibold tabular-nums"
                style={{ color: plTotal >= 0 ? 'var(--success)' : 'var(--danger)' }}
              >
                {plTotal >= 0 ? '+' : ''}
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                }).format(plTotal)}
              </span>
            )}
          </div>

          {qontoFinanceLoading ? (
            <div className="skeleton h-[260px] rounded-md" />
          ) : qontoError ? (
            <div
              className="flex items-center justify-center text-sm text-[var(--text-muted)]"
              style={{ height: 260 }}
            >
              Indisponible
            </div>
          ) : qontoFinance ? (
            <ProfitLossChart data={qontoFinance.monthlyCashFlow ?? []} height={260} />
          ) : null}
        </motion.div>

        <motion.div
          variants={staggerItem}
          className="rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
        >
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                Revenus facturés
              </h3>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">6 derniers mois</p>
            </div>
            {stripeFinance && (
              <span className="text-[13px] font-semibold tabular-nums text-[var(--memovia-violet)]">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                }).format(revenueLast6Months.reduce((s, m) => s + m.revenue, 0))}
              </span>
            )}
          </div>

          {stripeFinanceLoading ? (
            <div className="skeleton h-[260px] rounded-md" />
          ) : (
            <RevenueBarChart data={revenueLast6Months} variant="mini" rounded="capsule" />
          )}
        </motion.div>
      </div>

      {/* ── Alertes prioritaires — format actionnable ── */}
      <motion.div
        variants={staggerItem}
        className="rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      >
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle size={15} className="text-[var(--text-secondary)]" />
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Alertes prioritaires
          </h3>
        </div>

        {dataLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-10 rounded-md" />
            <div className="skeleton h-10 rounded-md" />
          </div>
        ) : !hasAlerts ? (
          <p className="text-[13px] text-[var(--text-muted)]">
            Aucune alerte — tout est en ordre.
          </p>
        ) : (
          <div className="space-y-2">
            {(stripe?.cancelingAtPeriodEnd ?? 0) > 0 && (
              <AlertRow
                color="var(--danger)"
                icon={UserMinus}
                label={`${stripe!.cancelingAtPeriodEnd} abonné${stripe!.cancelingAtPeriodEnd > 1 ? 's annulent' : ' annule'} en fin de période`}
                onClick={() => navigate('/stripe')}
              />
            )}
            {overdueTasks.length > 0 && (
              <AlertRow
                color="var(--warning)"
                icon={CheckSquare}
                label={`${overdueTasks.length} tâche${overdueTasks.length > 1 ? 's' : ''} en retard`}
                onClick={() => navigate('/taches')}
              />
            )}
            {overdueLeads.length > 0 && (
              <AlertRow
                color="var(--warning)"
                icon={Phone}
                label={`${overdueLeads.length} lead${overdueLeads.length > 1 ? 's' : ''} à relancer`}
                onClick={() => navigate('/prospection')}
              />
            )}
          </div>
        )}
      </motion.div>

      {/* ── Activité récente ── */}
      <motion.div
        variants={staggerItem}
        className="rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      >
        <div className="mb-4 flex items-center gap-2">
          <Activity size={15} className="text-[var(--text-secondary)]" />
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Activité récente
          </h3>
        </div>

        {contractsLoading || leadsLoading || tasksLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-9 rounded-md" />
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">Aucune activité récente.</p>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {recentActivity.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-medium ${
                      item.type === 'task'
                        ? 'bg-violet-50 text-violet-700'
                        : item.type === 'lead'
                          ? 'bg-cyan-50 text-cyan-700'
                          : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {item.type === 'task' ? 'Tâche' : item.type === 'lead' ? 'Lead' : 'Contrat'}
                  </span>
                  <span className="truncate text-[13px] text-[var(--text-primary)]">
                    {item.label}
                  </span>
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-3">
                  <span className="hidden text-[13px] text-[var(--text-muted)] sm:inline">
                    {item.status}
                  </span>
                  <span className="text-[13px] tabular-nums text-[var(--text-muted)]">
                    {relativeTime(item.updatedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Actus MEMOVIA du matin — 24h ── */}
      <motion.div
        variants={staggerItem}
        className="rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      >
        <div className="mb-4 flex items-center gap-2">
          <UserPlus size={15} className="text-[var(--text-secondary)]" />
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Activité MEMOVIA — 24h
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Nouvelles inscriptions */}
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
              <UserPlus size={12} />
              Nouvelles inscriptions
            </p>
            {newUsersLoading ? (
              <div className="space-y-2">
                <div className="skeleton h-8 rounded-md" />
                <div className="skeleton h-8 rounded-md" />
              </div>
            ) : newUsers24h.length === 0 ? (
              <p className="text-[13px] text-[var(--text-muted)]">Aucune inscription.</p>
            ) : (
              <div className="space-y-2">
                {newUsers24h.slice(0, 6).map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-md bg-[var(--bg-primary)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                        {u.first_name || u.last_name
                          ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
                          : u.email}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">{u.email}</p>
                    </div>
                    <span
                      className={`ml-3 shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${PLAN_COLOR[u.plan] ?? PLAN_COLOR.free}`}
                    >
                      {PLAN_LABEL[u.plan] ?? u.plan}
                    </span>
                  </div>
                ))}
                {newUsers24h.length > 6 && (
                  <Link
                    to="/utilisateurs"
                    className="block text-center text-[12px] text-[var(--memovia-violet)] hover:underline"
                  >
                    +{newUsers24h.length - 6} autres → Utilisateurs
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Nouveaux abonnés Stripe */}
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
              <CreditCard size={12} />
              Nouveaux abonnés Stripe
            </p>
            {stripeFinanceLoading ? (
              <div className="space-y-2">
                <div className="skeleton h-8 rounded-md" />
                <div className="skeleton h-8 rounded-md" />
              </div>
            ) : newStripe24h.length === 0 ? (
              <p className="text-[13px] text-[var(--text-muted)]">Aucun abonnement.</p>
            ) : (
              <div className="space-y-2">
                {newStripe24h.slice(0, 6).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md bg-[var(--bg-primary)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                        {s.customerEmail}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">{s.planName}</p>
                    </div>
                    <span className="ml-3 shrink-0 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                      {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(s.amount)}/mois
                    </span>
                  </div>
                ))}
                {newStripe24h.length > 6 && (
                  <Link
                    to="/stripe"
                    className="block text-center text-[12px] text-[var(--memovia-violet)] hover:underline"
                  >
                    +{newStripe24h.length - 6} autres → Stripe
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <TaskDetailModal
        open={selectedTask !== null}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onEdit={(t) => { setSelectedTask(null); setEditingTask(t) }}
      />
      <TaskForm
        open={editingTask !== null}
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSubmit={async (data) => { if (editingTask) await updateTask(editingTask.id, data as TaskUpdate) }}
        onDelete={async (id) => { await deleteTask(id) }}
        canDelete
      />
    </motion.div>
  )
}
