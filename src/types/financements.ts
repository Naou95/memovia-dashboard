export type FinancementType = 'concours' | 'subvention' | 'pret' | 'autre'
export type FinancementStatus =
  | 'veille'
  | 'a_deposer'
  | 'depose'
  | 'jury'
  | 'gagne'
  | 'perdu'
  | 'abandonne'

export interface Financement {
  id: string
  name: string
  type: FinancementType
  status: FinancementStatus
  deadline: string | null
  next_action: string | null
  assigned_to: 'naoufel' | 'emir' | null
  notes: string | null
  url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type FinancementInsert = Omit<Financement, 'id' | 'created_at' | 'updated_at' | 'created_by'>
export type FinancementUpdate = Partial<FinancementInsert>

export const FINANCEMENT_TYPE_LABELS: Record<FinancementType, string> = {
  concours: 'Concours',
  subvention: 'Subvention',
  pret: 'Prêt',
  autre: 'Autre',
}

export const FINANCEMENT_STATUS_LABELS: Record<FinancementStatus, string> = {
  veille: 'Veille',
  a_deposer: 'À déposer',
  depose: 'Déposé',
  jury: 'Jury',
  gagne: 'Gagné',
  perdu: 'Perdu',
  abandonne: 'Abandonné',
}

// Ordre d'affichage : l'actionnable d'abord, le clos à la fin.
export const FINANCEMENT_STATUS_ORDER: FinancementStatus[] = [
  'a_deposer',
  'jury',
  'depose',
  'veille',
  'gagne',
  'perdu',
  'abandonne',
]
