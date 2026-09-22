export type TaskStatus = 'todo' | 'en_cours' | 'done'
export type TaskPriority = 'haute' | 'normale' | 'basse'
export type TaskAssignee = 'naoufel' | 'emir'

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null      // ISO date YYYY-MM-DD
  assigned_to: TaskAssignee | null
  assignees: string[]
  is_private: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  // Engagement lié à une fiche lead/partenaire (mémoire d'entreprise, 21/08/2026)
  lead_id: string | null
  // Agenda (00056). scheduled_at : le créneau ; sans lui la tâche est « sans heure » sur son
  // jour d'échéance. auto_key : clé unique des tâches créées automatiquement (jamais deux fois).
  scheduled_at: string | null  // ISO timestamptz
  duration_min: number
  auto_key: string | null
}

// lead_id optionnel à l'insertion : le module Tâches historique crée des tâches
// sans fiche, seul le bloc Engagements le renseigne. Les champs de l'agenda aussi :
// la base pose leurs défauts, les écrans existants n'ont rien à envoyer de plus.
export type TaskInsert = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'lead_id' | 'scheduled_at' | 'duration_min' | 'auto_key'> & {
  lead_id?: string | null
  scheduled_at?: string | null
  duration_min?: number
  auto_key?: string | null
}
export type TaskUpdate = Partial<Omit<Task, 'id' | 'created_at' | 'updated_at'>>

// Engagements d'une fiche : ce qu'on doit (ouvertes) + ce qu'on a fait (faites).
export function splitTasksForLead(tasks: Task[], leadId: string): { ouvertes: Task[]; faites: Task[] } {
  const liees = tasks.filter((t) => t.lead_id === leadId)
  return {
    ouvertes: liees.filter((t) => t.status !== 'done'),
    faites: liees.filter((t) => t.status === 'done'),
  }
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'À faire',
  en_cours: 'En cours',
  done: 'Terminé',
}

export const TASK_STATUS_ORDER: TaskStatus[] = ['todo', 'en_cours', 'done']

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  haute: 'Haute',
  normale: 'Normale',
  basse: 'Basse',
}

export const TASK_ASSIGNEE_LABELS: Record<TaskAssignee, string> = {
  naoufel: 'Naoufel',
  emir: 'Emir',
}
