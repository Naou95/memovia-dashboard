/**
 * Logique pure de l'agenda de prospection : aucune requête, aucun import de React.
 * Testée par src/test/Agenda.test.ts.
 *
 * Tout se raisonne en heure de Paris : un jour est une chaîne 'YYYY-MM-DD', une heure est un nombre
 * de minutes depuis minuit. La base stocke des timestamptz (UTC) : les conversions passent par
 * parisDay / parisMinutes / parisToUtcIso, qui tiennent compte du changement d'heure.
 */

import type {
  AgendaDay,
  AgendaLead,
  CallSignal,
  CallWindow,
  ClassifiedCall,
  DayChip,
  DoneCall,
  GridBlock,
  LeadCallLite,
  PendingCall,
  ProjectedCall,
  RdvLite,
  Session,
  SessionOverride,
  SessionRow,
  TaskView,
} from '@/types/agenda'
import type { Task, TaskAssignee } from '@/types/tasks'
import type { UserRole } from '@/types/auth'

export const TZ = 'Europe/Paris'
export const DAY_START_MIN = 8 * 60
export const DAY_END_MIN = 18 * 60
export const SNAP_MIN = 15
export const DEFAULT_WINDOW: CallWindow = { days: [1, 2, 3, 4], start: '09:00', end: '11:30', slot_minutes: 10 }

// ── Dates ──────────────────────────────────────────────────────────────────────

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function parisParts(date: Date): { y: number; m: number; d: number; h: number; min: number } {
  // Un seul formatToParts par conversion : cette fonction tourne dans des boucles rejouées à la minute.
  const parts: Record<string, number> = {}
  for (const p of partsFmt.formatToParts(date)) if (p.type !== 'literal') parts[p.type] = Number(p.value)
  return { y: parts.year ?? 0, m: parts.month ?? 0, d: parts.day ?? 0, h: parts.hour ?? 0, min: parts.minute ?? 0 }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Jour de Paris d'un instant. */
export function parisDay(iso: string | Date): string {
  const p = parisParts(typeof iso === 'string' ? new Date(iso) : iso)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`
}

/** Minutes depuis minuit, à Paris. */
export function parisMinutes(iso: string | Date): number {
  const p = parisParts(typeof iso === 'string' ? new Date(iso) : iso)
  return p.h * 60 + p.min
}

/** Décalage Paris − UTC, en minutes, à un instant donné (60 l'hiver, 120 l'été). */
function parisOffsetMinutes(utcMs: number): number {
  const p = parisParts(new Date(utcMs))
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min)
  return Math.round((asUtc - Math.floor(utcMs / 60000) * 60000) / 60000)
}

/** Instant UTC (ISO) d'un jour et d'une heure de Paris. */
export function parisToUtcIso(day: string, minutes: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const localAsUtc = Date.UTC(y, m - 1, d, 0, minutes)
  // Deux passes : autour d'un changement d'heure, le décalage du premier jet peut être celui d'avant.
  let utc = localAsUtc - parisOffsetMinutes(localAsUtc) * 60000
  utc = localAsUtc - parisOffsetMinutes(utc) * 60000
  return new Date(utc).toISOString()
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function diffDays(a: string, b: string): number {
  const ms = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((ms(a) - ms(b)) / 86400000)
}

/** 1 = lundi … 7 = dimanche. */
export function isoWeekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return wd === 0 ? 7 : wd
}

/** Le jour lui-même s'il est ouvré, sinon le lundi qui suit. */
export function firstWorkdayFrom(day: string): string {
  const wd = isoWeekday(day)
  return wd > 5 ? addDays(day, 8 - wd) : day
}

/** Lundi à vendredi de la semaine du jour donné. */
export function workWeek(day: string): string[] {
  const monday = addDays(day, 1 - isoWeekday(day))
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i))
}

export function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function fmtMinutes(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

/** Réglage lu en base (texte JSON) : tout ce qui est illisible retombe sur le créneau par défaut. */
export function parseCallWindow(raw: string | null | undefined): CallWindow {
  if (!raw) return DEFAULT_WINDOW
  try {
    const w = JSON.parse(raw) as Partial<CallWindow>
    const days = Array.isArray(w.days) ? w.days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7) : []
    const start = typeof w.start === 'string' ? w.start : DEFAULT_WINDOW.start
    const end = typeof w.end === 'string' ? w.end : DEFAULT_WINDOW.end
    const slot = Number(w.slot_minutes)
    if (days.length === 0 || parseHm(end) <= parseHm(start)) return DEFAULT_WINDOW
    return { days, start, end, slot_minutes: slot >= 5 && slot <= 60 ? slot : DEFAULT_WINDOW.slot_minutes }
  } catch {
    return DEFAULT_WINDOW
  }
}

// ── Séances d'appels ───────────────────────────────────────────────────────────

/** La séance d'un jour : sa surcharge (déplacée, annulée) sinon le créneau par défaut, sinon rien. */
export function sessionFor(day: string, window: CallWindow, overrides: SessionOverride[]): Session | null {
  const o = overrides.find((x) => x.day === day)
  if (o) {
    if (o.cancelled) return null
    return { day, startMin: o.start_min, endMin: o.end_min, slotMinutes: window.slot_minutes, overridden: true }
  }
  if (!window.days.includes(isoWeekday(day))) return null
  return { day, startMin: parseHm(window.start), endMin: parseHm(window.end), slotMinutes: window.slot_minutes, overridden: false }
}

/** Premier jour avec une séance, à partir de `day` inclus. null si rien sous `horizon` jours. */
export function nextCallDay(day: string, window: CallWindow, overrides: SessionOverride[], horizon = 21): string | null {
  for (let i = 0; i <= horizon; i++) {
    const d = addDays(day, i)
    if (sessionFor(d, window, overrides)) return d
  }
  return null
}

/** Nombre de séances qui ont eu lieu dans [from, to[ : sert à dire si un appel est VRAIMENT en retard. */
export function missedSessions(from: string, to: string, window: CallWindow, overrides: SessionOverride[]): number {
  // Au-delà de 60 jours, le nombre exact de séances manquées ne change plus rien : on borne, pour
  // qu'un très vieux brouillon ne coûte pas des centaines d'itérations à chaque minute.
  const start = diffDays(to, from) > 60 ? addDays(to, -60) : from
  let n = 0
  for (let d = start; d < to; d = addDays(d, 1)) if (sessionFor(d, window, overrides)) n++
  return n
}

// ── Priorité ───────────────────────────────────────────────────────────────────

const SIGNAL_ORDER: Record<CallSignal, number> = {
  rappel_promis: 0,
  etape_retard: 1,
  etape_jour: 2,
  relance_retard: 3,
  relance_jour: 4,
}
const MATURITY_ORDER: Record<string, number> = { chaud: 0, tiede: 1, froid: 2 }

export function classify(call: PendingCall, shownDay: string, window: CallWindow, overrides: SessionOverride[]): ClassifiedCall {
  // Un appel dû vendredi et affiché lundi n'a manqué aucune séance : il n'est pas « en retard ».
  const late = call.dueDay < shownDay && missedSessions(call.dueDay, shownDay, window, overrides) > 0
  const lateDays = late ? diffDays(shownDay, call.dueDay) : 0
  let signal: CallSignal
  // Un rappel promis pour jeudi ne passe pas en tête dès lundi : il ne prime qu'à partir de son jour.
  if (call.callbackAt && parisDay(call.callbackAt) <= shownDay) signal = 'rappel_promis'
  else if (call.source === 'campaign') signal = late ? 'etape_retard' : 'etape_jour'
  else signal = late ? 'relance_retard' : 'relance_jour'
  return { ...call, signal, lateDays }
}

/** Ordre de la séance : signal, puis maturité la plus chaude, puis dernier contact le plus ancien. */
export function prioritize(calls: ClassifiedCall[]): ClassifiedCall[] {
  return [...calls].sort((a, b) => {
    const s = SIGNAL_ORDER[a.signal] - SIGNAL_ORDER[b.signal]
    if (s !== 0) return s
    if (a.signal === 'rappel_promis' && a.callbackAt && b.callbackAt && a.callbackAt !== b.callbackAt) {
      return a.callbackAt < b.callbackAt ? -1 : 1
    }
    const m = (MATURITY_ORDER[a.lead.maturity ?? 'froid'] ?? 2) - (MATURITY_ORDER[b.lead.maturity ?? 'froid'] ?? 2)
    if (m !== 0) return m
    const la = a.lead.last_contact_date ?? ''
    const lb = b.lead.last_contact_date ?? ''
    if (la !== lb) return la < lb ? -1 : 1
    // Tout le reste égal : ce qui est dû depuis le plus longtemps d'abord, puis l'alphabet.
    if (a.dueDay !== b.dueDay) return a.dueDay < b.dueDay ? -1 : 1
    return a.lead.name.localeCompare(b.lead.name, 'fr')
  })
}

/**
 * Un créneau par appel, dans l'ordre reçu, à partir de `fromMin` (l'heure qu'il est, pour aujourd'hui).
 * Ce qui ne tient plus avant la fin de la séance part en `overflow` (« à reporter »).
 */
export function placeInSession<T>(items: T[], session: Session, fromMin?: number): { placed: { item: T; startMin: number }[]; overflow: T[] } {
  const slot = session.slotMinutes
  let cursor = session.startMin
  if (fromMin !== undefined && fromMin > cursor) cursor = session.startMin + Math.ceil((fromMin - session.startMin) / slot) * slot
  const placed: { item: T; startMin: number }[] = []
  const overflow: T[] = []
  for (const item of items) {
    if (cursor + slot <= session.endMin) {
      placed.push({ item, startMin: cursor })
      cursor += slot
    } else overflow.push(item)
  }
  return { placed, overflow }
}

// ── Grille ─────────────────────────────────────────────────────────────────────

export function snap(minutes: number, step = SNAP_MIN): number {
  return Math.round(minutes / step) * step
}

/** Garde un bloc de `durMin` minutes dans la journée affichée (8h–18h). */
export function clampStart(startMin: number, durMin: number): number {
  return Math.max(DAY_START_MIN, Math.min(startMin, DAY_END_MIN - durMin))
}

export function blockTop(startMin: number, hourPx: number): number {
  return ((startMin - DAY_START_MIN) / 60) * hourPx
}

export function blockHeight(durMin: number, hourPx: number, minPx = 20): number {
  return Math.max((durMin / 60) * hourPx, minPx)
}

// ── Tâches ─────────────────────────────────────────────────────────────────────

/** Pas de lien en base entre un compte et 'naoufel' / 'emir' : on passe par le rôle (décision D4). */
export function assigneeForRole(role: UserRole | null | undefined): TaskAssignee | null {
  if (role === 'admin_bizdev') return 'emir'
  if (role === 'admin_full') return 'naoufel'
  return null
}

export function isMine(task: Task, me: TaskAssignee | null, userId: string | null): boolean {
  if (me && (task.assigned_to === me || (task.assignees ?? []).includes(me))) return true
  return task.assigned_to == null && (task.assignees ?? []).length === 0 && !!userId && task.created_by === userId
}

/**
 * Où une tâche s'affiche. Une tâche ouverte dont le jour est passé remonte AUJOURD'HUI, sans heure,
 * avec son retard. Une tâche sans échéance ni créneau n'entre pas dans la grille (null).
 * `lateDay` : où poser les retards. Le week-end, la grille montre la semaine suivante : sans lui,
 * les tâches en retard tomberaient sur un samedi qu'aucune colonne n'affiche et disparaîtraient.
 */
export function taskView(task: Task, today: string, lateDay: string = today): TaskView | null {
  const day = task.scheduled_at ? parisDay(task.scheduled_at) : task.due_date
  if (!day) return null
  const startMin = task.scheduled_at ? parisMinutes(task.scheduled_at) : null
  if (task.status !== 'done' && day < today) return { task, day: lateDay, startMin: null, lateDays: diffDays(today, day) }
  return { task, day, startMin, lateDays: 0 }
}

// ── Projection ─────────────────────────────────────────────────────────────────

export interface ProjectionEnrollment {
  id: string
  lead_id: string
  campaign_id: string
  current_position: number
  next_due_at: string
}
export interface ProjectionStep {
  campaign_id: string
  position: number
  kind: 'email' | 'call' | 'stop'
  wait_days: number
  name: string
}

/**
 * Appels probables, une étape au plus : l'étape courante est un appel pas encore préparé par le
 * tick, ou l'étape suivante est un appel (date estimée : il faut d'abord que le mail parte).
 */
export function projectNextCalls(
  enrollments: ProjectionEnrollment[],
  steps: ProjectionStep[],
  enrollmentsWithDraftCall: Set<string>,
): ProjectedCall[] {
  const out: ProjectedCall[] = []
  for (const e of enrollments) {
    if (enrollmentsWithDraftCall.has(e.id)) continue
    const own = steps.filter((s) => s.campaign_id === e.campaign_id).sort((a, b) => a.position - b.position)
    const current = own.find((s) => s.position === e.current_position)
    if (!current) continue
    if (current.kind === 'call') {
      out.push({ enrollmentId: e.id, leadId: e.lead_id, day: parisDay(e.next_due_at), stepName: current.name })
      continue
    }
    const next = own.find((s) => s.position > e.current_position)
    if (current.kind === 'email' && next?.kind === 'call') {
      out.push({ enrollmentId: e.id, leadId: e.lead_id, day: addDays(parisDay(e.next_due_at), next.wait_days), stepName: next.name })
    }
  }
  return out
}

// ── Assemblage ─────────────────────────────────────────────────────────────────

export interface BuildInput {
  today: string
  /** Minutes depuis minuit à Paris, maintenant. */
  nowMin: number
  days: string[]
  window: CallWindow
  overrides: SessionOverride[]
  pending: PendingCall[]
  calls: LeadCallLite[]
  leadsById: Map<string, AgendaLead>
  rdvs: RdvLite[]
  tasks: Task[]
  projections: ProjectedCall[]
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

function fmtShortDay(day: string): string {
  const names = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
  return `${names[isoWeekday(day) - 1]} ${Number(day.slice(8, 10))}`
}

/**
 * Le modèle d'affichage d'une plage de jours. Ne modifie rien : un appel dû un jour sans séance
 * s'AFFICHE au prochain jour d'appels, son `due_at` en base ne bouge pas.
 */
export function buildAgenda(input: BuildInput): AgendaDay[] {
  const { today, nowMin, days, window, overrides } = input

  const pendingByDay = new Map<string, ClassifiedCall[]>()
  const offWindow = new Map<string, { count: number; to: string | null }>()
  for (const p of input.pending) {
    const base = p.dueDay < today ? today : p.dueDay
    const shown = nextCallDay(base, window, overrides)
    if (shown !== base) {
      const cur = offWindow.get(base) ?? { count: 0, to: shown }
      offWindow.set(base, { count: cur.count + 1, to: shown })
    }
    if (!shown) continue
    const list = pendingByDay.get(shown) ?? []
    list.push(classify(p, shown, window, overrides))
    pendingByDay.set(shown, list)
  }

  const estimatedByDay = new Map<string, number>()
  for (const pr of input.projections) {
    const base = pr.day < today ? today : pr.day
    const shown = nextCallDay(base, window, overrides)
    if (shown) estimatedByDay.set(shown, (estimatedByDay.get(shown) ?? 0) + 1)
  }

  const lateDay = firstWorkdayFrom(today)

  return days.map((day): AgendaDay => {
    const session = sessionFor(day, window, overrides)
    const isToday = day === today

    const done: DoneCall[] = input.calls
      .filter((c) => parisDay(c.called_at) === day)
      .sort((a, b) => (a.called_at < b.called_at ? -1 : 1))
      .map((c) => ({
        key: `call:${c.id}`,
        callId: c.id,
        leadId: c.lead_id,
        lead: input.leadsById.get(c.lead_id) ?? null,
        calledAt: c.called_at,
        outcome: c.outcome,
        note: c.note,
        debriefed: !!c.debriefed_at,
        campaignMessageId: c.campaign_message_id,
      }))

    const rows: SessionRow[] = done.map((call) => ({ kind: 'done', startMin: parisMinutes(call.calledAt), call }))
    let overflow: ClassifiedCall[] = []
    const pending = prioritize(pendingByDay.get(day) ?? [])
    if (session) {
      const res = placeInSession(pending, session, isToday ? nowMin : undefined)
      for (const p of res.placed) rows.push({ kind: 'pending', startMin: p.startMin, call: p.item })
      overflow = res.overflow
    } else overflow = pending

    const blocks: GridBlock[] = []
    for (const r of input.rdvs) {
      if (parisDay(r.rdv_date) !== day) continue
      blocks.push({
        id: `rdv:${r.id}`, kind: 'rdv', refId: r.id, day,
        startMin: parisMinutes(r.rdv_date), durMin: r.duration_min ?? 45, title: r.title,
        leadName: r.lead_id ? input.leadsById.get(r.lead_id)?.name ?? null : null, done: false,
      })
    }

    const allDayTasks: TaskView[] = []
    for (const t of input.tasks) {
      const v = taskView(t, today, lateDay)
      if (!v || v.day !== day) continue
      if (v.startMin === null) allDayTasks.push(v)
      else blocks.push({
        id: `task:${t.id}`, kind: 'task', refId: t.id, day, startMin: v.startMin, durMin: t.duration_min ?? 30,
        title: t.title, leadName: t.lead_id ? input.leadsById.get(t.lead_id)?.name ?? null : null, done: t.status === 'done',
      })
    }
    allDayTasks.sort((a, b) => b.lateDays - a.lateDays || a.task.title.localeCompare(b.task.title, 'fr'))

    const chips: DayChip[] = []
    const noCr = done.filter((c) => !c.debriefed).length
    if (noCr) chips.push({ tone: 'danger', label: `${plural(noCr, 'appel')} sans CR` })
    const off = offWindow.get(day)
    if (off) chips.push({ tone: 'muted', label: `${plural(off.count, 'appel')} dû${off.count > 1 ? 's' : ''} · hors séance → ${off.to ? fmtShortDay(off.to) : 'à planifier'}` })
    if (overflow.length && session) chips.push({ tone: 'warn', label: `${plural(overflow.length, 'appel')} à reporter` })
    const est = estimatedByDay.get(day)
    if (est) chips.push({ tone: 'dashed', label: `${plural(est, 'appel')} prévu${est > 1 ? 's' : ''} (estimé)` })

    return { day, isToday, session, rows, overflow, blocks, allDayTasks, chips }
  })
}

/** Compteurs de l'en-tête et du résumé du jour. */
export function daySummary(d: AgendaDay): { total: number; done: number; pending: number; noCr: number } {
  const done = d.rows.filter((r) => r.kind === 'done')
  const pending = d.rows.length - done.length + d.overflow.length
  return { total: done.length + pending, done: done.length, pending, noCr: done.filter((r) => r.kind === 'done' && !r.call.debriefed).length }
}

export const SIGNAL_LABELS: Record<CallSignal, string> = {
  rappel_promis: 'Rappel promis',
  etape_retard: 'Étape en retard',
  etape_jour: 'Étape du jour',
  relance_retard: 'Relance en retard',
  relance_jour: 'Relance',
}
