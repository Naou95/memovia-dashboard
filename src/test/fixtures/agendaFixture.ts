// Données FICTIVES pour tester la vue de l'agenda sans base : aucun vrai lead, numéros factices.
import { DEFAULT_WINDOW, buildAgenda, workWeek } from '@/lib/agenda'
import type { UseAgendaResult } from '@/hooks/useAgenda'
import type { AgendaLead, LeadCallLite, PendingCall } from '@/types/agenda'
import type { Task } from '@/types/tasks'

export const FIXTURE_TODAY = '2026-09-14' // un lundi

const lead = (id: string, name: string, over: Partial<AgendaLead> = {}): AgendaLead => ({
  id, name, type: 'cfa', status: 'contacte', archived: false, maturity: 'froid', last_contact_date: '2026-09-10',
  follow_up_date: null, next_action: null, contact_name: null, contact_role: null, contact_phone: '05 00 00 00 0' + id.slice(-1),
  contact_email: null, why: 'Site à 70 % de CAP. Charte handicap signée en 2024.', pitch: 'Le cours de techno lisible par toute la classe.', assigned_to: 'emir', ...over,
})

const LEADS = [
  lead('L1', 'CFA Automobile du Tarn', { contact_name: 'M. Dautry', contact_role: 'référent handicap', status: 'en_discussion' }),
  lead('L2', 'CFA des Métiers du Bâtiment', { contact_name: 'Mme Lefranc', contact_role: 'référente handicap, à confirmer' }),
  lead('L3', 'MFR du Lauragais'),
  lead('L4', 'CFA Coiffure & Esthétique', { contact_name: 'Mme Roussel' }),
  lead('L5', 'CFA Agricole du Roussillon', { contact_name: 'Mme Carrère', follow_up_date: '2026-09-11', next_action: 'Renvoyer l’accès démo et proposer 15 min' }),
]
const byId = new Map(LEADS.map((l) => [l.id, l]))

const campaign = (n: number): PendingCall['campaign'] => ({
  campaignId: 'C1', campaignName: 'CFA · référent handicap', campaignEmoji: '🎓', enrollmentId: 'E' + n, messageId: 'M' + n,
  stepId: 'S2', stepName: 'Appel au standard', stepBrief: 'Demander le référent handicap par son nom. S’il est absent, obtenir son créneau.',
})

const PENDING: PendingCall[] = [
  { key: 'msg:M3', lead: LEADS[2], source: 'campaign', dueDay: '2026-09-11', callbackAt: null, campaign: campaign(3) },
  { key: 'msg:M4', lead: LEADS[3], source: 'campaign', dueDay: FIXTURE_TODAY, callbackAt: null, campaign: campaign(4) },
  { key: 'lead:L5', lead: LEADS[4], source: 'followup', dueDay: '2026-09-11', callbackAt: null, campaign: null },
  { key: 'msg:M9', lead: LEADS[1], source: 'campaign', dueDay: '2026-09-18', callbackAt: null, campaign: campaign(9) },
]

const CALLS: LeadCallLite[] = [
  { id: 'K1', lead_id: 'L1', outcome: 'joint', note: 'Joint M. Dautry. 3 RQTH. Veut une démo.', called_at: '2026-09-14T07:02:00Z', campaign_message_id: null, callback_at: null, debriefed_at: null, cr: null },
  { id: 'K2', lead_id: 'L2', outcome: 'rappel', note: 'Standard. Lefranc en formation.', called_at: '2026-09-14T07:11:00Z', campaign_message_id: 'M2', callback_at: null, debriefed_at: '2026-09-14T09:40:00Z', cr: 'Standard : Mme Lefranc en formation, rappeler jeudi matin.' },
]

const task = (id: string, title: string, over: Partial<Task> = {}): Task => ({
  id, title, description: null, status: 'todo', priority: 'normale', due_date: null, assigned_to: 'emir', assignees: [], is_private: false,
  created_at: '', updated_at: '', created_by: null, lead_id: null, scheduled_at: null, duration_min: 30, auto_key: null, ...over,
})

const TASKS: Task[] = [
  task('T1', 'Valider les 4 mails J0 dans la Revue', { scheduled_at: '2026-09-14T10:00:00Z', due_date: FIXTURE_TODAY, duration_min: 20 }),
  task('T2', 'Renvoyer l’accès démo', { due_date: FIXTURE_TODAY, lead_id: 'L5' }),
  task('T3', 'Contacter TBS Alumni', { due_date: '2026-09-02' }),
  task('T4', 'Rédiger le script d’appel partagé', { scheduled_at: '2026-09-15T13:00:00Z', due_date: '2026-09-15', duration_min: 60 }),
  task('T5', 'Ranger le vault', {}),
]

export function agendaFixture(over: Partial<UseAgendaResult> = {}): UseAgendaResult {
  const weekDays = workWeek(FIXTURE_TODAY)
  const nowMin = 9 * 60 + 22
  const week = buildAgenda({
    today: FIXTURE_TODAY, nowMin, days: weekDays, window: DEFAULT_WINDOW, overrides: [], pending: PENDING, calls: CALLS, leadsById: byId,
    rdvs: [{ id: 'R1', title: 'Visio · Point hebdo équipe', rdv_date: '2026-09-14T12:00:00Z', lead_id: null, duration_min: 45 }],
    tasks: TASKS, projections: [{ enrollmentId: 'E7', leadId: 'L9', day: '2026-09-16', stepName: 'Appel au standard' }],
  })
  return {
    week, weekDays, today: FIXTURE_TODAY, nowMin, window: DEFAULT_WINDOW, script: null, mailsToReview: 4,
    undatedTasks: TASKS.filter((t) => !t.due_date && !t.scheduled_at), tasks: TASKS, mineOnly: true, setMineOnly: () => {},
    threadFor: () => [{ id: 'm1', kind: 'email', at: '2026-09-10T07:40:00Z', stepName: 'Mail 1 · premier contact', subject: 'Agroéquipement : des fiches machine lisibles', outcome: null, note: null }],
    callsFor: (leadId) => CALLS.filter((c) => c.lead_id === leadId),
    openTasksFor: (leadId) => TASKS.filter((t) => t.lead_id === leadId && t.status !== 'done'),
    isLoading: false, error: null, schemaMissing: false, loadedAt: new Date('2026-09-14T07:20:00Z'), refresh: async () => {}, ...over,
  }
}
