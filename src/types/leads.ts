export type LeadStatus =
  | 'nouveau'
  | 'contacte'
  | 'en_discussion'
  | 'proposition'
  | 'gagne'
  | 'perdu'

export type LeadType = 'ecole' | 'cfa' | 'entreprise' | 'autre'
export type LeadCanal = 'linkedin' | 'email' | 'referral' | 'appel' | 'autre'
export type LeadAssignee = 'naoufel' | 'emir'
export type LeadMaturity = 'froid' | 'tiede' | 'chaud'

export interface TimelineEntry {
  date: string
  direction: 'envoyé' | 'reçu'
  sujet: string
  résumé: string
}

export interface Lead {
  id: string
  name: string
  type: LeadType
  canal: LeadCanal
  status: LeadStatus
  next_action: string | null
  follow_up_date: string | null
  assigned_to: LeadAssignee | null
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  // Email auto fields
  contact_email: string | null
  contact_name: string | null
  contact_role: string | null
  source: string | null
  // Maturity fields
  maturity: LeadMaturity | null
  relance_count: number
  last_contact_date: string | null
  timeline: TimelineEntry[] | null
}

export type LeadInsert = Omit<Lead, 'id' | 'created_at' | 'updated_at'>
export type LeadUpdate = Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at'>>

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  en_discussion: 'En discussion',
  proposition: 'Proposition envoyée',
  gagne: 'Gagné',
  perdu: 'Perdu',
}

export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  ecole: 'École',
  cfa: 'CFA',
  entreprise: 'Entreprise',
  autre: 'Autre',
}

export const LEAD_CANAL_LABELS: Record<LeadCanal, string> = {
  linkedin: 'LinkedIn',
  email: 'Email',
  referral: 'Référence',
  appel: 'Appel',
  autre: 'Autre',
}

export const LEAD_ASSIGNEE_LABELS: Record<LeadAssignee, string> = {
  naoufel: 'Naoufel',
  emir: 'Emir',
}

export const LEAD_MATURITY_LABELS: Record<LeadMaturity, string> = {
  froid: 'Froid',
  tiede: 'Tiède',
  chaud: 'Chaud',
}

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  'nouveau',
  'contacte',
  'en_discussion',
  'proposition',
  'gagne',
  'perdu',
]
