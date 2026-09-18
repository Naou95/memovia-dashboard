// Libellés et couleurs de l'agenda : un seul endroit pour la grille, la liste mobile et le résumé.

import type { CSSProperties } from 'react'
import type { ClassifiedCall, DoneCall, SessionRow } from '@/types/agenda'
import { CALL_OUTCOME_LABELS } from '@/types/leads'
import { fmtMinutes, isoWeekday } from '@/lib/agenda'

export type Tone = 'danger' | 'danger-solid' | 'warn' | 'violet' | 'muted' | 'success' | 'dashed'

export const TONE_STYLE: Record<Tone, CSSProperties> = {
  danger: { backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' },
  'danger-solid': { backgroundColor: 'var(--danger)', color: '#fff' },
  warn: { backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' },
  violet: { backgroundColor: 'var(--memovia-violet-light)', color: 'var(--memovia-violet)' },
  muted: { backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' },
  success: { backgroundColor: 'var(--success-bg)', color: 'var(--success)' },
  dashed: { backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px dashed var(--border-strong)' },
}

export interface Chip {
  tone: Tone
  label: string
}

export function pendingChip(call: ClassifiedCall): Chip {
  switch (call.signal) {
    case 'rappel_promis':
      return { tone: 'warn', label: call.callbackMin != null ? `Rappel promis · ${fmtMinutes(call.callbackMin)}` : 'Rappel promis' }
    case 'etape_retard':
      return { tone: 'danger', label: `Campagne · retard ${call.lateDays} j` }
    case 'etape_jour':
      return { tone: 'violet', label: 'Campagne · à appeler' }
    case 'relance_retard':
      return { tone: 'muted', label: `Relance · retard ${call.lateDays} j` }
    default:
      return { tone: 'muted', label: 'Relance' }
  }
}

export function doneChip(call: DoneCall): Chip {
  const label = CALL_OUTCOME_LABELS[call.outcome]
  return call.debriefed ? { tone: 'success', label: `✓ ${label} · CR` } : { tone: 'danger-solid', label: `${label} · CR à écrire` }
}

export const rowChip = (row: SessionRow): Chip => (row.kind === 'done' ? doneChip(row.call) : pendingChip(row.call))

export const rowLeadName = (row: SessionRow): string => (row.kind === 'done' ? row.call.lead?.name ?? 'Lead supprimé' : row.call.lead.name)

const DAYS_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export const dayLong = (day: string): string => `${DAYS_LONG[isoWeekday(day) - 1]} ${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`
export const dayShort = (day: string): string => DAYS_SHORT[isoWeekday(day) - 1]
export const dayNumber = (day: string): number => Number(day.slice(8, 10))
export const dayMonth = (day: string): string => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`
export const dateFr = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Numéro de semaine ISO. */
export function isoWeek(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const wd = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - wd)
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1)
  return Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7)
}
