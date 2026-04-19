export type SentryLevel = 'fatal' | 'error' | 'warning' | 'info'

export interface SentryIssue {
  id: string
  title: string
  level: SentryLevel
  occurrences: number
  usersAffected: number
  firstSeen: string
  lastSeen: string
  permalink: string
  isCritical: boolean
}

export interface SentryStats {
  totalIssues: number
  totalOccurrences: number
  usersAffected: number
}

export interface SentryData {
  stats: SentryStats
  issues: SentryIssue[]
  fetchedAt: string
}
