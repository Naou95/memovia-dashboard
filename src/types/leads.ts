export type LeadStatus =
  | 'nouveau'
  | 'contacte'
  | 'en_discussion'
  | 'proposition'
  | 'gagne'
  | 'perdu'
  // Réservé aux partenaires (mémoire d'entreprise, 21/08/2026) : le cycle
  // nouveau→perdu n'a pas de sens pour Christelle/Compagnons, Paidea, TBS.
  | 'actif'

export type LeadType = 'ecole' | 'cfa' | 'entreprise' | 'autre' | 'partenaire'
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
  // Refonte v2 Phase 1
  contact_phone: string | null
  archived: boolean
}

export type LeadInsert = Omit<Lead, 'id' | 'created_at' | 'updated_at'>
export type LeadUpdate = Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at'>>

// ── Log d'appel (refonte v2 Phase 1) ──────────────────────────────────────────

export type CallOutcome = 'repondu' | 'pas_repondu' | 'rappel'

export interface LeadCall {
  id: string
  lead_id: string
  outcome: CallOutcome
  note: string | null
  called_at: string
  created_by: string | null
}

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  repondu: 'Répondu',
  pas_repondu: 'Pas de réponse',
  rappel: 'À rappeler',
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  en_discussion: 'En discussion',
  proposition: 'Proposition envoyée',
  gagne: 'Gagné',
  perdu: 'Perdu',
  actif: 'Actif',
}

export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  ecole: 'École',
  cfa: 'CFA',
  entreprise: 'Entreprise',
  autre: 'Autre',
  partenaire: 'Partenaire',
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

// ⚠️ Pilote le kanban de prospection : 'actif' (partenaires) n'y figure pas, exprès.
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  'nouveau',
  'contacte',
  'en_discussion',
  'proposition',
  'gagne',
  'perdu',
]

// ── Onglets de la section Leads (mémoire d'entreprise, 21/08/2026) ────────────

export type LeadTab = 'cfa' | 'partenaires'

// L'onglet Prospection CFA garde STRICTEMENT le comportement d'avant l'arrivée des
// partenaires : tout ce qui n'est pas type='partenaire' y reste visible.
export function filterLeadsByTab(leads: Lead[], tab: LeadTab): Lead[] {
  return leads.filter((l) =>
    tab === 'partenaires' ? l.type === 'partenaire' : l.type !== 'partenaire',
  )
}
