export type ContractStatus = 'prospect' | 'negotiation' | 'signe' | 'actif' | 'resilie'
export type OrganizationType = 'ecole' | 'cfa' | 'entreprise' | 'autre'

export interface Contract {
  id: string
  organization_name: string
  organization_type: OrganizationType
  status: ContractStatus
  license_count: number
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  mrr_eur: number | null
  renewal_date: string | null  // ISO date string YYYY-MM-DD
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export type ContractInsert = Omit<Contract, 'id' | 'created_at' | 'updated_at'>
export type ContractUpdate = Partial<Omit<Contract, 'id' | 'created_at' | 'updated_at'>>

// Display labels for statuses
export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  prospect: 'Prospect',
  negotiation: 'Négociation',
  signe: 'Signé',
  actif: 'Actif',
  resilie: 'Résilié',
}

// Display labels for organization types
export const ORG_TYPE_LABELS: Record<OrganizationType, string> = {
  ecole: 'École',
  cfa: 'CFA',
  entreprise: 'Entreprise',
  autre: 'Autre',
}
