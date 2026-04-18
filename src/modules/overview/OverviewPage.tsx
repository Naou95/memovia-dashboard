import { useMemo } from 'react'
import { DollarSign, Users, Landmark, UserMinus, Bot, AlertTriangle, Activity } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { useOverviewKpis } from '@/hooks/useOverviewKpis'
import { useStripeFinance } from '@/hooks/useStripeFinance'
import { useTasks } from '@/hooks/useTasks'
import { useLeads } from '@/hooks/useLeads'
import { useContracts } from '@/hooks/useContracts'
import { useIaBriefing } from '@/hooks/useIaBriefing'
import { KpiCard } from '@/components/shared/KpiCard'
import { RevenueBarChart } from '@/components/shared/RevenueBarChart'
import { staggerContainer, staggerItem, cardGridContainer, staggerCard } from '@/lib/motion'

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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { user } = useAuth()
  const { stripe, qonto, stripeError, qontoError, isLoading } = useOverviewKpis()
  const { data: stripeFinance, isLoading: chartLoading } = useStripeFinance()
  const { tasks, isLoading: tasksLoading } = useTasks()
  const { leads, isLoading: leadsLoading } = useLeads()
  const { contracts, isLoading: contractsLoading } = useContracts()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const firstName = user?.profile.full_name?.split(' ')[0] ?? 'admin'
  const last6Months = stripeFinance?.revenueByMonth?.slice(-6) ?? []

  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const overdueTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today),
    [tasks, today],
  )

  const overdueLeads = useMemo(
    () =>
      leads.filter(
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
      ...tasks.map((t) => ({
        id: t.id,
        type: 'task' as const,
        label: t.title,
        status: TASK_STATUS[t.status] ?? t.status,
        updatedAt: t.updated_at,
      })),
      ...leads.map((l) => ({
        id: l.id,
        type: 'lead' as const,
        label: l.name,
        status: LEAD_STATUS[l.status] ?? l.status,
        updatedAt: l.updated_at,
      })),
      ...contracts.map((c) => ({
        id: c.id,
        type: 'contract' as const,
        label: c.organization_name,
        status: CONTRACT_STATUS[c.status] ?? c.status,
        updatedAt: c.updated_at,
      })),
    ]
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
  }, [tasks, leads, contracts])

  const briefingEnabled = !isLoading && !tasksLoading && !leadsLoading
  const { briefing, isLoading: briefingLoading, isStreaming: briefingStreaming } = useIaBriefing({
    enabled: briefingEnabled,
    mrr: stripe?.mrr ?? null,
    qontoBalance: qonto?.balance ?? null,
    cancelingCount: stripe?.cancelingAtPeriodEnd ?? 0,
    overdueTasks: overdueTasks.length,
    overdueLeads: overdueLeads.length,
  })

  const hasAlerts =
    (stripe?.cancelingAtPeriodEnd ?? 0) > 0 ||
    overdueTasks.length > 0 ||
    overdueLeads.length > 0

  const dataLoading = tasksLoading || leadsLoading || isLoading

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* ── Greeting header ── */}
      <motion.header variants={staggerItem}>
        <h2 className="text-2xl font-semibold tracking-tighter text-[var(--text-primary)]">
          {greeting}, {firstName}
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Voici un aperçu de MEMOVIA AI aujourd'hui.
        </p>
      </motion.header>

      {/* ── Briefing IA du jour ── */}
      <motion.div
        variants={staggerItem}
        className="rounded-2xl border border-violet-100 bg-violet-50/50 p-5"
      >
        <div className="mb-3 flex items-center gap-2">
          <Bot size={15} className="text-[#7C3AED]" />
          <span className="text-[13px] font-semibold text-[#7C3AED]">Briefing IA du jour</span>
          {briefingStreaming && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7C3AED]" />
          )}
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

      {/* ── 4 KPI cards ── */}
      <motion.div
        variants={cardGridContainer}
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <motion.div variants={staggerCard}>
          <KpiCard
            label="MRR"
            value={stripe ? formatEur(stripe.mrr) : null}
            rawValue={stripe?.mrr}
            formatter={formatEur}
            unit="€"
            accent="violet"
            icon={DollarSign}
            isLoading={isLoading}
            error={stripeError}
          />
        </motion.div>
        <motion.div variants={staggerCard}>
          <KpiCard
            label="Abonnés actifs"
            value={stripe ? String(stripe.activeSubscribers) : null}
            rawValue={stripe?.activeSubscribers}
            accent="cyan"
            icon={Users}
            isLoading={isLoading}
            error={stripeError}
          />
        </motion.div>
        <motion.div variants={staggerCard}>
          <KpiCard
            label="Solde Qonto"
            value={qonto ? formatEur(qonto.balance) : null}
            rawValue={qonto?.balance}
            formatter={formatEur}
            unit="€"
            accent="blue"
            icon={Landmark}
            isLoading={isLoading}
            error={qontoError}
          />
        </motion.div>
        <motion.div variants={staggerCard}>
          <KpiCard
            label="Annulations en cours"
            value={stripe ? String(stripe.cancelingAtPeriodEnd) : null}
            rawValue={stripe?.cancelingAtPeriodEnd}
            accent="red"
            icon={UserMinus}
            isLoading={isLoading}
            error={stripeError}
          />
        </motion.div>
      </motion.div>

      {/* ── Alertes prioritaires ── */}
      <motion.div
        variants={staggerItem}
        className="rounded-2xl border border-[var(--border-color)] bg-white p-5"
      >
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle size={15} className="text-[var(--text-secondary)]" />
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Alertes prioritaires
          </h3>
        </div>

        {dataLoading ? (
          <div className="flex flex-wrap gap-2">
            <div className="skeleton h-8 w-40 rounded-xl" />
            <div className="skeleton h-8 w-36 rounded-xl" />
          </div>
        ) : !hasAlerts ? (
          <p className="text-[13px] text-[var(--text-muted)]">
            Aucune alerte — tout est en ordre.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(stripe?.cancelingAtPeriodEnd ?? 0) > 0 && (
              <span className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-[13px] font-medium text-red-700">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                {stripe!.cancelingAtPeriodEnd} abonné
                {stripe!.cancelingAtPeriodEnd > 1 ? 's annulent' : ' annule'}
              </span>
            )}
            {overdueTasks.length > 0 && (
              <span className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-[13px] font-medium text-orange-700">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                {overdueTasks.length} tâche{overdueTasks.length > 1 ? 's' : ''} en retard
              </span>
            )}
            {overdueLeads.length > 0 && (
              <span className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-[13px] font-medium text-orange-700">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                {overdueLeads.length} lead{overdueLeads.length > 1 ? 's' : ''} à relancer
              </span>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Revenue mini chart ── */}
      <motion.div
        variants={staggerItem}
        className="rounded-2xl border border-[var(--border-color)] bg-white p-5"
      >
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Revenus facturés
            </h3>
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">6 derniers mois</p>
          </div>
          {stripeFinance && (
            <span className="text-[13px] font-semibold text-[#7C3AED]">
              {new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0,
              }).format(last6Months.reduce((s, m) => s + m.revenue, 0))}
            </span>
          )}
        </div>

        {chartLoading ? (
          <div className="skeleton h-[160px] rounded-xl" />
        ) : (
          <RevenueBarChart data={last6Months} variant="mini" />
        )}
      </motion.div>

      {/* ── Activité récente ── */}
      <motion.div
        variants={staggerItem}
        className="rounded-2xl border border-[var(--border-color)] bg-white p-5"
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
              <div key={i} className="skeleton h-9 rounded-xl" />
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
                  <span className="hidden text-[12px] text-[var(--text-muted)] sm:inline">
                    {item.status}
                  </span>
                  <span className="text-[12px] text-[var(--text-muted)]">
                    {relativeTime(item.updatedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
