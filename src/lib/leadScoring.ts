import type { Lead, LeadMaturity, LeadStatus } from '@/types/leads'

export type LeadScoreColor = 'red' | 'orange' | 'green'

type ScoreInput = Pick<
  Lead,
  'maturity' | 'status' | 'relance_count' | 'last_contact_date'
>

const MATURITY_POINTS: Record<LeadMaturity, number> = {
  froid: 10,
  tiede: 40,
  chaud: 70,
}

const STATUS_POINTS: Record<LeadStatus, number> = {
  nouveau: 0,
  contacte: 5,
  en_discussion: 15,
  proposition: 20,
  gagne: 30,
  perdu: -50,
}

function relancePoints(count: number): number {
  if (count <= 0) return 0
  if (count === 1) return 5
  if (count === 2) return 10
  return 5
}

function daysSinceLocal(dateStr: string, now: Date = new Date()): number {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY
  const dayMs = 24 * 60 * 60 * 1000
  const start = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.floor((today - start) / dayMs)
}

function lastContactPoints(dateStr: string | null, now: Date = new Date()): number {
  if (!dateStr) return -15
  const days = daysSinceLocal(dateStr, now)
  if (days <= 0) return 10
  if (days < 7) return 5
  if (days < 30) return 0
  return -10
}

export function computeLeadScore(lead: ScoreInput, now: Date = new Date()): number {
  const maturity = lead.maturity ? MATURITY_POINTS[lead.maturity] : 0
  const status = STATUS_POINTS[lead.status] ?? 0
  const relances = relancePoints(lead.relance_count ?? 0)
  const lastContact = lastContactPoints(lead.last_contact_date, now)

  const raw = maturity + status + relances + lastContact
  return Math.max(0, Math.min(100, raw))
}

export function leadScoreColor(score: number): LeadScoreColor {
  if (score < 30) return 'red'
  if (score <= 60) return 'orange'
  return 'green'
}
