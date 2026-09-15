// Campagnes de prospection (spec docs/superpowers/specs/2026-09-15-campagnes-design.md).
// Les contacts d'une campagne sont les leads (src/types/leads.ts) : pas de seconde liste.

import type { Lead } from './leads'

export type CampaignStatus = 'draft' | 'live' | 'paused' | 'archived'
export type StepKind = 'email' | 'call' | 'stop'
export type EnrollmentStatus = 'active' | 'stopped' | 'done'
export type MessageKind = 'email' | 'call'
export type MessageStatus = 'draft' | 'sent' | 'done' | 'skipped'
export type CallResult = 'joint' | 'pas_repondu' | 'rappel' | 'refus' | 'interesse'

export interface Campaign {
  id: string
  name: string
  emoji: string
  status: CampaignStatus
  sender_email: string
  owner: 'naoufel' | 'emir' | null
  created_at: string
  updated_at: string
}

export interface CampaignStep {
  id: string
  campaign_id: string
  position: number
  kind: StepKind
  wait_days: number
  name: string
  subject_template: string | null
  body_template: string | null
  ai_brief: string | null
  created_at: string
  updated_at: string
}

export interface CampaignEnrollment {
  id: string
  campaign_id: string
  lead_id: string
  status: EnrollmentStatus
  current_position: number
  next_due_at: string
  stop_reason: string | null
  thread_message_id: string | null
  thread_subject: string | null
  started_at: string
  updated_at: string
}

export interface MessageCheck {
  status: 'ok' | 'warn' | 'ko'
  label: string
}

export interface MessageContext {
  why?: string
  facts?: [string, string][]
  previous_subject?: string | null
  previous_body?: string | null
  generated_by?: string
}

export interface CampaignMessage {
  id: string
  enrollment_id: string
  step_id: string
  kind: MessageKind
  status: MessageStatus
  subject: string | null
  body: string | null
  checks: MessageCheck[] | null
  context: MessageContext | null
  due_at: string
  sent_at: string | null
  message_id: string | null
  outcome: CallResult | null
  note: string | null
  error: string | null
  validated_by: string | null
  created_at: string
  updated_at: string
}

/** Inscription jointe à son lead : ce que l'UI manipule. */
export interface EnrollmentWithLead extends CampaignEnrollment {
  lead: Lead
}

/** Brouillon joint à son inscription, son lead et son étape : une ligne de la Revue. */
export interface ReviewItem extends CampaignMessage {
  enrollment: EnrollmentWithLead
  step: CampaignStep
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Brouillon',
  live: 'En cours',
  paused: 'En pause',
  archived: 'Archivée',
}

export const STOP_REASON_LABELS: Record<string, string> = {
  replied: 'A répondu',
  refused: 'Refus à l\'appel',
  lost: 'Lead perdu',
  manual: 'Arrêtée à la main',
  finished: 'Séquence terminée',
  stop: 'STOP demandé',
}

export const CALL_RESULT_LABELS: Record<CallResult, string> = {
  joint: 'Joint',
  pas_repondu: 'Pas répondu',
  rappel: 'Rappel demandé',
  refus: 'Refus',
  interesse: 'Intéressé',
}
