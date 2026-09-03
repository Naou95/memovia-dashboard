import type { Lead, LeadStatus } from '@/types/leads'
import { LEAD_STATUS_ORDER } from '@/types/leads'
import { computeLeadScore } from '@/lib/leadScoring'

/**
 * Colonnes du kanban : un groupe par statut, dans l'ordre du pipeline. Dans
 * chaque colonne, les relances datées d'abord (retards en tête), puis les
 * fiches sans date par score décroissant, comme le tableau ; à égalité, le nom.
 */
export function groupLeadsByStatus(leads: Lead[], now = new Date()): Record<LeadStatus, Lead[]> {
  const byUrgency = (a: Lead, b: Lead) => {
    if (a.follow_up_date && b.follow_up_date && a.follow_up_date !== b.follow_up_date) {
      return a.follow_up_date.localeCompare(b.follow_up_date)
    }
    if (!!a.follow_up_date !== !!b.follow_up_date) return a.follow_up_date ? -1 : 1
    // Même date (ou aucune) : score, puis nom, pour que l'ordre ne bouge pas d'un chargement à l'autre.
    return computeLeadScore(b, now) - computeLeadScore(a, now) || a.name.localeCompare(b.name, 'fr')
  }
  const groups = {} as Record<LeadStatus, Lead[]>
  for (const status of LEAD_STATUS_ORDER) groups[status] = []
  for (const lead of leads) (groups[lead.status] ??= []).push(lead)
  for (const status of Object.keys(groups) as LeadStatus[]) groups[status].sort(byUrgency)
  return groups
}

export type FollowUpTone = 'late' | 'today' | 'soon' | 'none'

/** « En retard de 3 j », « Aujourd'hui », « Dans 6 j (08/09) » : l'urgence se lit, elle ne se calcule pas. */
export function followUpLabel(dateStr: string | null, now = new Date()): { text: string; tone: FollowUpTone } {
  if (!dateStr) return { text: '', tone: 'none' }
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  const short = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  if (days < 0) return { text: `En retard de ${-days} j`, tone: 'late' }
  if (days === 0) return { text: "Aujourd'hui", tone: 'today' }
  if (days === 1) return { text: `Demain (${short})`, tone: 'soon' }
  return { text: `Dans ${days} j (${short})`, tone: 'soon' }
}
