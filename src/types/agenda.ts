// Agenda de prospection (spec docs/superpowers/specs/2026-09-15-agenda-prospection-design.md).
// Rien n'est stocké comme « événement » : l'agenda se CALCULE à partir des brouillons d'appel des
// campagnes, des relances de leads, des appels passés, des RDV et des tâches.

import type { Lead, CallOutcome, CallResult } from './leads'
import type { Task, TaskAssignee } from './tasks'

/** Les colonnes de leads que l'agenda lit. Jamais `notes` en écriture, voir le plan § 1. */
export type AgendaLead = Pick<
  Lead,
  | 'id' | 'name' | 'type' | 'status' | 'archived' | 'maturity' | 'last_contact_date' | 'follow_up_date'
  | 'next_action' | 'contact_name' | 'contact_role' | 'contact_phone' | 'contact_email' | 'why' | 'pitch' | 'assigned_to'
>

/** Réglage `agenda_call_window`. days : 1 = lundi … 7 = dimanche (ISO). */
export interface CallWindow {
  days: number[]
  start: string // 'HH:MM', heure de Paris
  end: string
  slot_minutes: number
}

/** Ligne de `agenda_sessions` : la séance d'un jour déplacée ou annulée. */
export interface SessionOverride {
  day: string
  start_min: number
  end_min: number
  cancelled: boolean
}

export interface Session {
  day: string
  startMin: number
  endMin: number
  slotMinutes: number
  overridden: boolean
}

/** Du plus prioritaire au moins prioritaire. */
export type CallSignal = 'rappel_promis' | 'etape_retard' | 'etape_jour' | 'relance_retard' | 'relance_jour'

export interface CampaignRef {
  campaignId: string
  campaignName: string
  campaignEmoji: string
  enrollmentId: string
  messageId: string
  stepId: string
  stepName: string
  stepBrief: string | null
}

/** Un appel à passer : étape d'appel d'une campagne (brouillon) ou relance d'un lead. */
export interface PendingCall {
  key: string
  lead: AgendaLead
  source: 'campaign' | 'followup'
  /** Jour (Paris) où l'appel est dû en base. L'agenda peut l'AFFICHER plus tard, jamais le modifier. */
  dueDay: string
  /**
   * Rappel promis : non nul quand le dernier appel de ce lead s'est conclu par « rappel demandé ».
   * Vaut l'heure promise si elle a été notée (lead_calls.callback_at), sinon l'heure de cet appel.
   */
  callbackAt: string | null
  /** Heure promise (minutes depuis minuit, Paris), seulement si le contact en a donné une. */
  callbackMin?: number | null
  campaign: CampaignRef | null
}

/** Ce que la fiche d'appel montre d'une séquence : mails partis et appels faits, du plus ancien au plus récent. */
export interface ThreadEntry {
  id: string
  kind: 'email' | 'call'
  at: string
  stepName: string
  subject: string | null
  outcome: CallOutcome | null
  note: string | null
}

export interface ClassifiedCall extends PendingCall {
  signal: CallSignal
  /** Jours calendaires de retard, 0 si aucune séance n'a été manquée. */
  lateDays: number
}

export interface DoneCall {
  key: string
  callId: string
  leadId: string
  lead: AgendaLead | null
  calledAt: string
  outcome: CallOutcome
  note: string | null
  debriefed: boolean
  campaignMessageId: string | null
}

export type SessionRow =
  | { kind: 'done'; startMin: number; call: DoneCall }
  | { kind: 'pending'; startMin: number; call: ClassifiedCall }

export interface GridBlock {
  id: string
  kind: 'rdv' | 'task'
  refId: string
  day: string
  startMin: number
  durMin: number
  title: string
  leadId: string | null
  leadName: string | null
  done: boolean
}

export interface TaskView {
  task: Task
  day: string
  startMin: number | null
  lateDays: number
}

export interface DayChip {
  tone: 'danger' | 'warn' | 'muted' | 'violet' | 'dashed'
  label: string
}

export interface AgendaDay {
  day: string
  isToday: boolean
  session: Session | null
  rows: SessionRow[]
  /** Appels qui ne tiennent plus dans la séance du jour. */
  overflow: ClassifiedCall[]
  blocks: GridBlock[]
  allDayTasks: TaskView[]
  chips: DayChip[]
}

/** Appel probable, pas encore en base (l'étape suivante d'une inscription est un appel). */
export interface ProjectedCall {
  enrollmentId: string
  leadId: string
  day: string
  stepName: string
}

export interface RdvLite {
  id: string
  title: string
  rdv_date: string
  lead_id: string | null
  duration_min?: number | null
}

export interface LeadCallLite {
  id: string
  lead_id: string
  outcome: CallOutcome
  note: string | null
  called_at: string
  campaign_message_id: string | null
  callback_at: string | null
  debriefed_at: string | null
  cr: string | null
}

/** Ce qu'un formulaire ou un glisser-déposer décrit : un titre, un jour, une heure (ou aucune), une durée, un lead. */
export interface BlockInput {
  title: string
  day: string
  /** Minutes depuis minuit à Paris ; null = « sans heure » (tâches seulement). */
  startMin: number | null
  durMin: number
  leadId: string | null
}

/**
 * Les écritures de l'agenda. Toutes lèvent en cas d'échec (l'écran affiche le toast) et rechargent
 * ce qu'elles ont touché. Aucune n'écrit leads.notes, leads.maturity, leads.name ni leads.archived.
 */
export interface AgendaActions {
  createTask(input: BlockInput): Promise<void>
  updateTask(id: string, patch: Partial<BlockInput> & { done?: boolean }): Promise<void>
  deleteTask(id: string): Promise<void>
  /** La base n'accepte la suppression que de ses propres tâches (ou tout, pour admin_full) ; jamais une tâche automatique. */
  canDeleteTask(task: Task): boolean
  createRdv(input: BlockInput): Promise<void>
  updateRdv(id: string, patch: Partial<BlockInput>): Promise<void>
  /** Pose ou déplace la séance d'appels d'un jour. `fromDay` : le jour qu'elle quitte, marqué sans séance. */
  saveSession(day: string, startMin: number, durMin: number, fromDay?: string): Promise<void>
  /** Retour au créneau par défaut des réglages pour ce jour. */
  resetSession(day: string): Promise<void>
  /**
   * Enregistre l'issue d'un appel. `followUp`, pour une relance hors campagne seulement : la prochaine
   * date de relance du lead (null : plus de relance). Une étape de campagne suit la règle de sa séquence.
   */
  recordOutcome(call: ClassifiedCall, outcome: CallResult, note: string, followUp?: string | null): Promise<void>
  /** La prochaine relance proposée pour cette issue (voir suggestFollowUp dans lib/agenda). */
  suggestFollowUp(outcome: CallResult): string | null
  /** Reporte l'appel à la séance qui suit le jour où il s'affiche (`shownDay`) ; rend le jour retenu. */
  postponeCall(call: ClassifiedCall, shownDay: string): Promise<string>
}

export type { TaskAssignee }
