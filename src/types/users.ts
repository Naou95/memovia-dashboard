// Types pour les utilisateurs app.memovia.io — lecture seule

export type MemoviaUserPlan = 'free' | 'pro' | 'b2b'

// Catégorie de compte — valeurs réelles de profiles.account_type
export type MemoviaAccountType = 'student' | 'teacher_b2c' | 'teacher' | 'school_admin'

// Type simplifié pour le filtre UI (teacher_b2c + teacher → 'teacher')
export type MemoviaTypeFilter = 'student' | 'teacher' | 'school_admin'

export interface MemoviaUser {
  id: string
  email: string
  first_name: string
  last_name: string | null
  account_type: MemoviaAccountType
  created_at: string
  last_sign_in_at: string | null
  plan: MemoviaUserPlan
  organization_name: string | null
}

export const PLAN_LABELS: Record<MemoviaUserPlan, string> = {
  free: 'Free',
  pro: 'Pro',
  b2b: 'B2B',
}

export const TYPE_FILTER_LABELS: Record<MemoviaTypeFilter, string> = {
  student: 'Étudiant',
  teacher: 'Formateur',
  school_admin: 'Admin B2B',
}

// Plans triés pour l'affichage
export const PLAN_ORDER: MemoviaUserPlan[] = ['free', 'pro', 'b2b']

// Détermine si un account_type correspond à un filtre UI
export function matchesTypeFilter(
  accountType: MemoviaAccountType,
  filter: MemoviaTypeFilter
): boolean {
  if (filter === 'teacher') return accountType === 'teacher' || accountType === 'teacher_b2c'
  return accountType === filter
}
