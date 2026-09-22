import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTasks } from '@/hooks/useTasks'
import { completeCampaignCall, logLeadCall, postponeCampaignMessage } from '@/lib/callActions'
import {
  addDays,
  assigneeForRole,
  buildAgenda,
  canDeleteTask,
  diffDays,
  isMine,
  parisDay,
  parisMinutes,
  parisToUtcIso,
  parseCallWindow,
  postponeTarget,
  projectNextCalls,
  sessionFor,
  suggestFollowUp,
  taskUpdate,
  workWeek,
  type ProjectionEnrollment,
  type ProjectionStep,
} from '@/lib/agenda'
import type {
  AgendaActions,
  AgendaDay,
  AgendaLead,
  CallWindow,
  LeadCallLite,
  PendingCall,
  RdvLite,
  SessionOverride,
  ThreadEntry,
} from '@/types/agenda'
import type { Task } from '@/types/tasks'

/**
 * Agenda de prospection (PR 4 et 5 du plan 2026-09-17-agenda-prospection.md). L'agenda se calcule à
 * partir des brouillons d'appel des campagnes, des relances de leads, des appels passés, des RDV et
 * des tâches. Snapshot + « Actualiser », pas de temps réel (règle de la refonte v2) ; seules les
 * tâches suivent useTasks, qui existe déjà. Les écritures (`actions`) sont en bas : chacune lève en
 * cas d'échec, et celles faites de plusieurs requêtes rechargent l'écran quoi qu'il arrive.
 */

const LEAD_COLUMNS =
  'id, name, type, status, archived, maturity, last_contact_date, follow_up_date, next_action, contact_name, contact_role, contact_phone, contact_email, why, pitch, assigned_to'

// Colonne ou table absente : la migration 00056 n'est pas appliquée sur cette base.
const SCHEMA_ERRORS = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])

interface DraftRow { id: string; enrollment_id: string; step_id: string; due_at: string }
interface EnrollmentRow extends ProjectionEnrollment { status: string; started_at: string }
interface CampaignRow { id: string; name: string; emoji: string; status: string }
interface StepRow extends ProjectionStep { id: string; ai_brief: string | null }
interface ThreadRow {
  id: string
  enrollment_id: string
  step_id: string
  kind: 'email' | 'call'
  status: string
  subject: string | null
  sent_at: string | null
  outcome: ThreadEntry['outcome']
  note: string | null
  updated_at: string
}

interface Snapshot {
  drafts: DraftRow[]
  enrollments: EnrollmentRow[]
  campaigns: CampaignRow[]
  steps: StepRow[]
  leads: AgendaLead[]
  calls: LeadCallLite[]
  thread: ThreadRow[]
  rdvs: RdvLite[]
  overrides: SessionOverride[]
  window: CallWindow
  script: string | null
  mailsToReview: number
}

export interface UseAgendaResult {
  /** Lundi à vendredi de la semaine affichée. */
  week: AgendaDay[]
  weekDays: string[]
  today: string
  nowMin: number
  window: CallWindow
  script: string | null
  mailsToReview: number
  /** Tâches ouvertes sans échéance ni créneau : hors grille, listées à part. */
  undatedTasks: Task[]
  tasks: Task[]
  mineOnly: boolean
  setMineOnly: (v: boolean) => void
  threadFor: (enrollmentId: string) => ThreadEntry[]
  callsFor: (leadId: string) => LeadCallLite[]
  openTasksFor: (leadId: string) => Task[]
  /** Pour rattacher une tâche ou un RDV à un lead depuis un formulaire. */
  leads: { id: string; name: string }[]
  actions: AgendaActions
  isLoading: boolean
  error: string | null
  /** La migration 00056 n'est pas appliquée : l'agenda ne peut pas lire ses colonnes. */
  schemaMissing: boolean
  loadedAt: Date | null
  refresh: () => Promise<void>
}

export function useAgenda(anchorDay: string): UseAgendaResult {
  const { user } = useAuth()
  const { tasks, createTask, updateTask, deleteTask } = useTasks()
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)
  const [mineOnly, setMineOnly] = useState(true)
  const [clock, setClock] = useState(() => new Date())

  const weekDays = useMemo(() => workWeek(anchorDay), [anchorDay])
  const weekKey = weekDays[0]
  // La semaine réellement affichée : une réponse arrivée pour une autre semaine (deux clics rapides
  // sur « suivante », réponse lente) est ignorée, sinon elle écraserait la bonne avec de vieilles données.
  const shownWeek = useRef(weekKey)
  shownWeek.current = weekKey
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Le trait de l'heure courante et le placement des appels suivent l'horloge, à la minute.
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const refresh = useCallback(async () => {
    const stale = () => !mounted.current || shownWeek.current !== weekKey
    try {
      await load(weekKey, stale)
    } catch (e) {
      console.error('[agenda] chargement en échec :', e)
      if (stale()) return
      setError('Impossible de charger l’agenda.')
      setIsLoading(false)
    }
  }, [weekKey])

  const load = async (week: string, stale: () => boolean) => {
    const days = workWeek(week)
    const startIso = parisToUtcIso(days[0], 0)
    const endIso = parisToUtcIso(addDays(days[4], 1), 0)
    const historyIso = parisToUtcIso(addDays(days[0], -90), 0)
    const nowIso = new Date().toISOString()
    // Séances : la semaine affichée ET les trois semaines qui suivent aujourd'hui, car « Reporter » et la
    // prochaine relance se calculent depuis aujourd'hui, même quand on regarde une autre semaine.
    const todayDay = parisDay(new Date())
    const sessionsFrom = [days[0], todayDay].sort()[0]
    const sessionsTo = [addDays(days[4], 21), addDays(todayDay, 21)].sort()[1]

    const [drafts, enrollments, campaigns, steps, leads, calls, rdvs, settings, overrides, mails] = await Promise.all([
      // Du plus ancien au plus récent : si un lead a deux brouillons d'appel (deux campagnes), c'est le plus ancien qui s'affiche.
      supabase.from('campaign_messages').select('id, enrollment_id, step_id, due_at').eq('kind', 'call').eq('status', 'draft').lt('due_at', endIso).order('due_at'),
      supabase.from('campaign_enrollments').select('id, campaign_id, lead_id, status, current_position, next_due_at, started_at').eq('status', 'active'),
      supabase.from('campaigns').select('id, name, emoji, status'),
      supabase.from('campaign_steps').select('id, campaign_id, position, kind, wait_days, name, ai_brief').order('position'),
      supabase.from('leads').select(LEAD_COLUMNS).eq('archived', false),
      supabase
        .from('lead_calls')
        .select('id, lead_id, outcome, note, called_at, campaign_message_id, callback_at, debriefed_at, cr')
        .gte('called_at', historyIso)
        .order('called_at', { ascending: false })
        .limit(500),
      supabase.from('rdv').select('id, title, rdv_date, lead_id, duration_min').gte('rdv_date', startIso).lt('rdv_date', endIso),
      supabase.from('dashboard_settings').select('key, value').in('key', ['agenda_call_window', 'leads_script']),
      supabase.from('agenda_sessions').select('day, start_min, end_min, cancelled').gte('day', sessionsFrom).lte('day', sessionsTo),
      supabase.from('campaign_messages').select('id', { count: 'exact', head: true }).eq('kind', 'email').eq('status', 'draft').lte('due_at', nowIso),
    ])

    if (stale()) return
    const failed = [drafts, enrollments, campaigns, steps, leads, calls, rdvs, settings, overrides, mails].find((r) => r.error)
    if (failed?.error) {
      const missing = SCHEMA_ERRORS.has(failed.error.code ?? '')
      setSchemaMissing(missing)
      setError(missing ? 'La migration 00056 (agenda) n’est pas appliquée sur cette base.' : 'Impossible de charger l’agenda.')
      setIsLoading(false)
      return
    }

    const enr = (enrollments.data ?? []) as unknown as EnrollmentRow[]
    let thread: ThreadRow[] = []
    if (enr.length > 0) {
      const t = await supabase
        .from('campaign_messages')
        .select('id, enrollment_id, step_id, kind, status, subject, sent_at, outcome, note, updated_at')
        .in('enrollment_id', enr.map((e) => e.id))
        .in('status', ['sent', 'done'])
      if (stale()) return
      if (t.error) {
        setError('Impossible de charger l’historique des séquences.')
        setIsLoading(false)
        return
      }
      thread = (t.data ?? []) as unknown as ThreadRow[]
    }

    const settingsRows = (settings.data ?? []) as { key: string; value: string | null }[]
    setSnap({
      drafts: (drafts.data ?? []) as unknown as DraftRow[],
      enrollments: enr,
      campaigns: (campaigns.data ?? []) as unknown as CampaignRow[],
      steps: (steps.data ?? []) as unknown as StepRow[],
      leads: (leads.data ?? []) as unknown as AgendaLead[],
      calls: (calls.data ?? []) as unknown as LeadCallLite[],
      thread,
      rdvs: (rdvs.data ?? []) as unknown as RdvLite[],
      overrides: (overrides.data ?? []) as unknown as SessionOverride[],
      window: parseCallWindow(settingsRows.find((s) => s.key === 'agenda_call_window')?.value),
      script: settingsRows.find((s) => s.key === 'leads_script')?.value ?? null,
      mailsToReview: mails.count ?? 0,
    })
    setSchemaMissing(false)
    setError(null)
    setLoadedAt(new Date())
    setIsLoading(false)
  }

  useEffect(() => {
    setIsLoading(true)
    refresh()
  }, [refresh])

  const today = parisDay(clock)
  const nowMin = parisMinutes(clock)
  const me = assigneeForRole(user?.role)
  const userId = user?.supabaseUser.id ?? null

  const visibleTasks = useMemo(() => (mineOnly ? tasks.filter((t) => isMine(t, me, userId)) : tasks), [tasks, mineOnly, me, userId])

  const model = useMemo(() => {
    if (!snap) return null
    const leadsById = new Map(snap.leads.map((l) => [l.id, l]))
    const campaignsById = new Map(snap.campaigns.map((c) => [c.id, c]))
    const stepsById = new Map(snap.steps.map((s) => [s.id, s]))
    // Une campagne en brouillon prépare ses brouillons par « Actualiser » : ils doivent se voir.
    const openCampaign = (id: string) => ['live', 'draft'].includes(campaignsById.get(id)?.status ?? '')
    const enrollmentsById = new Map(snap.enrollments.filter((e) => openCampaign(e.campaign_id)).map((e) => [e.id, e]))

    // Dernier appel de chaque lead (snap.calls est trié du plus récent au plus ancien).
    const lastCallByLead = new Map<string, LeadCallLite>()
    for (const c of snap.calls) if (!lastCallByLead.has(c.lead_id)) lastCallByLead.set(c.lead_id, c)
    const callback = (leadId: string): Pick<PendingCall, 'callbackAt' | 'callbackMin'> => {
      const last = lastCallByLead.get(leadId)
      if (!last || last.outcome !== 'rappel') return { callbackAt: null, callbackMin: null }
      // Un « rappel demandé » sans date, vieux de plus de 30 jours, n'est plus une promesse : sans cette
      // borne il garderait la priorité maximale indéfiniment.
      if (!last.callback_at && diffDays(today, parisDay(last.called_at)) > 30) return { callbackAt: null, callbackMin: null }
      return { callbackAt: last.callback_at ?? last.called_at, callbackMin: last.callback_at ? parisMinutes(last.callback_at) : null }
    }

    const pending: PendingCall[] = []
    const leadsWithDraft = new Set<string>()
    const enrollmentsWithDraft = new Set<string>()
    const calledToday = new Set(snap.calls.filter((c) => parisDay(c.called_at) === today).map((c) => c.lead_id))
    for (const d of snap.drafts) {
      const e = enrollmentsById.get(d.enrollment_id)
      const lead = e && leadsById.get(e.lead_id)
      const step = stepsById.get(d.step_id)
      const campaign = e && campaignsById.get(e.campaign_id)
      if (!e || !lead || !step || !campaign) continue
      enrollmentsWithDraft.add(e.id)
      // Une seule carte par lead. Deux cas de doublon : un lead inscrit dans deux campagnes (le brouillon
      // le plus ancien gagne, la requête est triée), et un lead déjà appelé aujourd'hui depuis la section
      // Leads, dont l'étape de campagne est restée en brouillon : il figure déjà dans les appels faits.
      if (leadsWithDraft.has(lead.id)) continue
      leadsWithDraft.add(lead.id)
      if (calledToday.has(lead.id) && parisDay(d.due_at) <= today) continue
      pending.push({
        key: `msg:${d.id}`, lead, source: 'campaign', dueDay: parisDay(d.due_at), ...callback(lead.id),
        campaign: {
          campaignId: campaign.id, campaignName: campaign.name, campaignEmoji: campaign.emoji, enrollmentId: e.id,
          messageId: d.id, stepId: step.id, stepName: step.name, stepBrief: step.ai_brief,
        },
      })
    }

    for (const lead of snap.leads) {
      if (!lead.follow_up_date || lead.follow_up_date > weekDays[4]) continue
      // Ni partenaires, ni leads sortis du pipeline (« actif » n'a de sens que pour un partenaire, mais
      // un CFA saisi « actif » par erreur ne doit pas remonter en relance pour autant).
      if (lead.type === 'partenaire' || ['gagne', 'perdu', 'actif'].includes(lead.status)) continue
      // Déjà dans une séquence (l'étape porte le contexte) ou déjà appelé aujourd'hui : pas de doublon.
      if (leadsWithDraft.has(lead.id) || calledToday.has(lead.id)) continue
      pending.push({ key: `lead:${lead.id}`, lead, source: 'followup', dueDay: lead.follow_up_date, ...callback(lead.id), campaign: null })
    }

    const weekCalls = snap.calls.filter((c) => {
      const d = parisDay(c.called_at)
      return d >= weekDays[0] && d <= weekDays[4]
    })

    const week = buildAgenda({
      today, nowMin, days: weekDays, window: snap.window, overrides: snap.overrides, pending, calls: weekCalls, leadsById,
      rdvs: snap.rdvs, tasks: visibleTasks,
      projections: projectNextCalls([...enrollmentsById.values()], snap.steps, enrollmentsWithDraft),
    })
    return { week, stepsById }
  }, [snap, today, nowMin, weekDays, visibleTasks])

  const threadFor = useCallback(
    (enrollmentId: string): ThreadEntry[] => {
      if (!snap || !model) return []
      return snap.thread
        .filter((m) => m.enrollment_id === enrollmentId)
        .map((m) => ({
          id: m.id, kind: m.kind, at: m.kind === 'email' ? m.sent_at ?? m.updated_at : m.updated_at,
          stepName: model.stepsById.get(m.step_id)?.name ?? '', subject: m.subject, outcome: m.outcome, note: m.note,
        }))
        .sort((a, b) => (a.at < b.at ? -1 : 1))
    },
    [snap, model],
  )

  const callsFor = useCallback((leadId: string) => (snap ? snap.calls.filter((c) => c.lead_id === leadId) : []), [snap])
  const openTasksFor = useCallback((leadId: string) => tasks.filter((t) => t.lead_id === leadId && t.status !== 'done'), [tasks])

  const undatedTasks = useMemo(
    () => visibleTasks.filter((t) => t.status !== 'done' && !t.due_date && !t.scheduled_at),
    [visibleTasks],
  )

  // ── Écritures ────────────────────────────────────────────────────────────────
  // Chacune lève en cas d'échec et recharge ce qu'elle a touché. Les tâches passent par useTasks (il
  // recharge tout seul) ; le reste recharge l'instantané de la semaine.
  const actions = useMemo<AgendaActions>(() => {
    const window = snap?.window ?? parseCallWindow(null)
    const overrides = snap?.overrides ?? []
    const when = (day: string, startMin: number | null) => ({
      due_date: day,
      scheduled_at: startMin == null ? null : parisToUtcIso(day, startMin),
    })
    return {
      async createTask({ title, day, startMin, durMin, leadId }) {
        await createTask({
          title, description: null, status: 'todo', priority: 'normale', assigned_to: me, assignees: [], is_private: false,
          created_by: null, lead_id: leadId, duration_min: durMin, ...when(day, startMin),
        })
      },
      async updateTask(id, patch) {
        const current = tasks.find((t) => t.id === id)
        if (!current) throw new Error('Tâche introuvable')
        const update = taskUpdate(current, patch, today)
        if (Object.keys(update).length > 0) await updateTask(id, update)
      },
      deleteTask,
      canDeleteTask: (task) => canDeleteTask(task, user?.role, userId),
      async createRdv({ title, day, startMin, durMin, leadId }) {
        if (startMin == null) throw new Error('Un RDV a une heure')
        const { error: e } = await supabase.from('rdv').insert({ title, rdv_date: parisToUtcIso(day, startMin), duration_min: durMin, lead_id: leadId })
        if (e) throw e
        await refresh()
      },
      async updateRdv(id, patch) {
        const current = snap?.rdvs.find((r) => r.id === id)
        if (!current) throw new Error('RDV introuvable')
        const day = patch.day ?? parisDay(current.rdv_date)
        const startMin = patch.startMin ?? parisMinutes(current.rdv_date)
        const update: { title?: string; rdv_date: string; duration_min?: number; lead_id?: string | null } = { rdv_date: parisToUtcIso(day, startMin) }
        if (patch.title !== undefined) update.title = patch.title
        if (patch.durMin !== undefined) update.duration_min = patch.durMin
        if (patch.leadId !== undefined) update.lead_id = patch.leadId
        const { error: e } = await supabase.from('rdv').update(update).eq('id', id)
        if (e) throw e
        await refresh()
      },
      async saveSession(day, startMin, durMin, fromDay) {
        const left = fromDay && fromDay !== day ? sessionFor(fromDay, window, overrides) : null
        const stamp = { updated_at: new Date().toISOString(), ...(userId ? { updated_by: userId } : {}) }
        try {
          const { error: e } = await supabase
            .from('agenda_sessions')
            .upsert({ day, start_min: startMin, end_min: startMin + durMin, cancelled: false, ...stamp }, { onConflict: 'day' })
          if (e) throw e
          if (left && fromDay) {
            // La séance a changé de jour : le jour quitté n'en a plus (ses appels s'affichent à la séance suivante).
            const { error: e2 } = await supabase
              .from('agenda_sessions')
              .upsert({ day: fromDay, start_min: left.startMin, end_min: left.endMin, cancelled: true, ...stamp }, { onConflict: 'day' })
            if (e2) throw e2
          }
        } finally {
          // Deux écritures : si la seconde échoue, l'écran doit montrer les deux séances telles qu'en base.
          await refresh()
        }
      },
      async resetSession(day) {
        const { error: e } = await supabase.from('agenda_sessions').delete().eq('day', day)
        if (e) throw e
        await refresh()
      },
      async recordOutcome(call, outcome, note, followUp) {
        try {
          if (call.campaign) {
            const enrollment = snap?.enrollments.find((x) => x.id === call.campaign!.enrollmentId)
            if (!enrollment) throw new Error('message_not_sendable')
            const steps = (snap?.steps ?? []).filter((s) => s.campaign_id === enrollment.campaign_id)
            await completeCampaignCall({ messageId: call.campaign.messageId, enrollment, steps, outcome, note })
          } else {
            await logLeadCall(call.lead.id, { outcome, note: note.trim() || undefined, followUpDate: followUp })
          }
        } finally {
          await refresh()
        }
      },
      suggestFollowUp: (outcome) => suggestFollowUp(outcome, today, window, overrides),
      async postponeCall(call, shownDay) {
        const day = postponeTarget(today, call.dueDay, shownDay, window, overrides)
        try {
          if (call.campaign) {
            const start = sessionFor(day, window, overrides)?.startMin ?? 9 * 60
            await postponeCampaignMessage(call.campaign.messageId, call.campaign.enrollmentId, parisToUtcIso(day, start))
          } else {
            const { error: e } = await supabase.from('leads').update({ follow_up_date: day }).eq('id', call.lead.id)
            if (e) throw e
          }
        } finally {
          // Refusé parce que déjà traité ailleurs : l'appel doit quitter l'écran, donc on recharge aussi.
          await refresh()
        }
        return day
      },
    }
  }, [snap, tasks, createTask, updateTask, deleteTask, refresh, me, user?.role, userId, today])

  const leadOptions = useMemo(
    () => (snap?.leads ?? []).map((l) => ({ id: l.id, name: l.name })).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [snap],
  )

  return {
    week: model?.week ?? [],
    weekDays,
    today,
    nowMin,
    window: snap?.window ?? parseCallWindow(null),
    script: snap?.script ?? null,
    mailsToReview: snap?.mailsToReview ?? 0,
    undatedTasks,
    tasks: visibleTasks,
    mineOnly,
    setMineOnly,
    threadFor,
    callsFor,
    openTasksFor,
    leads: leadOptions,
    actions,
    isLoading,
    error,
    schemaMissing,
    loadedAt,
    refresh,
  }
}
