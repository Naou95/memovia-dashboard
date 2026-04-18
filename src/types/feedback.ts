export type FeedbackStatus = 'backlog' | 'planifie' | 'en_dev' | 'livre'
export type FeedbackCategory = 'fonctionnalite' | 'bug' | 'amelioration'

export interface FeedbackItem {
  id: string
  title: string
  description: string | null
  status: FeedbackStatus
  category: FeedbackCategory
  author_name: string | null
  author_email: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FeedbackItemWithVotes extends FeedbackItem {
  vote_count: number
}

export type FeedbackItemInsert = {
  title: string
  description?: string | null
  status?: FeedbackStatus
  category?: FeedbackCategory
  author_name?: string | null
  author_email?: string | null
  created_by?: string | null
}

export type FeedbackItemUpdate = Partial<FeedbackItemInsert>

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  backlog: 'Backlog',
  planifie: 'Planifié',
  en_dev: 'En développement',
  livre: 'Livré',
}

export const FEEDBACK_STATUS_ORDER: FeedbackStatus[] = [
  'backlog',
  'planifie',
  'en_dev',
  'livre',
]

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  fonctionnalite: 'Fonctionnalité',
  bug: 'Bug',
  amelioration: 'Amélioration',
}

export const FEEDBACK_STATUS_COLORS: Record<
  FeedbackStatus,
  { bg: string; text: string; border: string }
> = {
  backlog: {
    bg: 'var(--bg-secondary)',
    text: 'var(--text-secondary)',
    border: 'var(--border-color)',
  },
  planifie: {
    bg: 'rgba(59,130,246,0.12)',
    text: '#3b82f6',
    border: 'rgba(59,130,246,0.3)',
  },
  en_dev: {
    bg: 'rgba(245,158,11,0.12)',
    text: '#f59e0b',
    border: 'rgba(245,158,11,0.3)',
  },
  livre: {
    bg: 'rgba(16,185,129,0.12)',
    text: '#10b981',
    border: 'rgba(16,185,129,0.3)',
  },
}

export const FEEDBACK_CATEGORY_COLORS: Record<
  FeedbackCategory,
  { bg: string; text: string }
> = {
  fonctionnalite: { bg: 'rgba(139,92,246,0.12)', text: 'var(--memovia-violet)' },
  bug: { bg: 'rgba(239,68,68,0.12)', text: 'var(--danger)' },
  amelioration: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' },
}
