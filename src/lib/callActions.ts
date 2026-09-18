/**
 * Les écritures d'un appel, sorties des hooks pour être partagées par la Revue des campagnes, la
 * section Leads et l'agenda : une seule version de chaque geste, pas trois qui divergent.
 * Ces fonctions ne rechargent rien : c'est à l'appelant de rafraîchir son écran.
 * (La PR « débrief » du plan les remplacera par une fonction SQL, une transaction par fiche.)
 */

import { supabase } from '@/lib/supabase'
import { parisDay } from '@/lib/agenda'
import type { CallResult, LeadUpdate } from '@/types/leads'

const DAY_MS = 86_400_000

/**
 * L'appel EST enregistré, mais une écriture suivante (fiche du lead, séquence) a échoué. À dire tel
 * quel : un « échec » tout court pousserait à ressaisir l'appel, et donc à le compter deux fois.
 */
export class CallPartiallySavedError extends Error {
  readonly detail: unknown
  constructor(detail: unknown) {
    super('call_partially_saved')
    this.detail = detail
  }
}

export function inDays(from: Date, days: number): string {
  return new Date(from.getTime() + days * DAY_MS).toISOString()
}

export interface EnrollmentRef {
  id: string
  lead_id: string
  current_position: number
}

export interface StepRef {
  position: number
  wait_days: number
}

/** Passe l'inscription à l'étape suivante, ou la termine s'il n'y en a pas. `steps` : celles de SA campagne, triées. */
export async function advanceEnrollmentRow(enrollment: EnrollmentRef, steps: StepRef[]): Promise<void> {
  const next = [...steps].sort((a, b) => a.position - b.position).find((s) => s.position > enrollment.current_position)
  const patch = next
    ? { current_position: next.position, next_due_at: inDays(new Date(), next.wait_days) }
    : { status: 'done' as const, stop_reason: 'finished' }
  // Garde : un onglet pas à jour n'avance pas deux fois la même inscription.
  const { error } = await supabase
    .from('campaign_enrollments').update(patch).eq('id', enrollment.id).eq('current_position', enrollment.current_position)
  if (error) throw error
}

export async function skipDraftMessages(enrollmentId: string): Promise<void> {
  const { error } = await supabase
    .from('campaign_messages').update({ status: 'skipped' }).eq('enrollment_id', enrollmentId).eq('status', 'draft')
  if (error) throw error
}

export interface CampaignCallInput {
  messageId: string
  enrollment: EnrollmentRef
  steps: StepRef[]
  outcome: CallResult
  note: string
}

/**
 * Enregistre l'issue d'une étape d'appel. Lève `message_not_sendable` si l'appel a déjà été traité
 * ailleurs (deux onglets, double clic) ou si le message n'est plus un brouillon.
 */
export async function completeCampaignCall({ messageId, enrollment, steps, outcome, note }: CampaignCallInput): Promise<void> {
  const trimmed = note.trim()
  // L'APPEL D'ABORD, le message ensuite. Dans l'autre sens, un insert refusé laissait le message
  // « fait » sans aucun appel en base, et la garde `status = 'draft'` interdisait tout nouvel essai :
  // l'appel n'était plus enregistrable depuis l'écran. Ici, un échec ne laisse rien derrière lui.
  // L'issue s'écrit telle quelle (00056 a élargi la contrainte) : avant, joint, refus et intéressé
  // devenaient tous « repondu », indiscernables ensuite. campaign_message_id relie l'appel à son
  // message, et l'index unique lead_calls_one_per_message refuse un second enregistrement du même
  // message : c'est lui la garde contre le doublon.
  const call = await supabase
    .from('lead_calls')
    .insert({ lead_id: enrollment.lead_id, outcome, note: trimmed || null, campaign_message_id: messageId })
    .select('id')
    .single()
  if (call.error) {
    if (call.error.code === '23505') throw new Error('message_not_sendable')
    throw call.error
  }

  const msg = await supabase
    .from('campaign_messages').update({ status: 'done', outcome, note: trimmed || null }).eq('id', messageId).eq('status', 'draft').select('id')
  if (msg.error || !msg.data?.length) {
    // Le message n'est plus un brouillon (sauté ou séquence arrêtée entre-temps) : on retire l'appel
    // qu'on vient d'écrire, pour ne pas garder un appel rattaché à une étape qui n'a pas eu lieu.
    await supabase.from('lead_calls').delete().eq('id', call.data.id)
    throw msg.error ?? new Error('message_not_sendable')
  }

  // À partir d'ici l'appel est écrit : un échec se signale comme tel (CallPartiallySavedError).
  try {
    const leadPatch: LeadUpdate = { last_contact_date: parisDay(new Date()), canal: 'appel' }
    if (outcome === 'refus') leadPatch.status = 'perdu'
    if (outcome === 'interesse') leadPatch.status = 'en_discussion'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lead = await supabase.from('leads').update(leadPatch as any).eq('id', enrollment.lead_id)
    if (lead.error) throw lead.error

    if (outcome === 'refus' || outcome === 'interesse') {
      // Un intéressé sort de la séquence comme un refus : ni relance ni mail de clôture.
      const e = await supabase
        .from('campaign_enrollments').update({ status: 'stopped', stop_reason: outcome === 'refus' ? 'refused' : 'interested' }).eq('id', enrollment.id)
      if (e.error) throw e.error
      await skipDraftMessages(enrollment.id)
    } else if (outcome === 'rappel') {
      const e = await supabase.from('campaign_enrollments').update({ next_due_at: inDays(new Date(), 2) }).eq('id', enrollment.id)
      if (e.error) throw e.error
    } else {
      await advanceEnrollmentRow(enrollment, steps)
    }
  } catch (err) {
    throw new CallPartiallySavedError(err)
  }
}

/**
 * Repousse une étape (mail ou appel) : le brouillon et l'inscription prennent la même échéance.
 * Seulement si le brouillon en est encore un : un écran pas à jour (l'agenda n'est pas en temps réel)
 * réécrirait sinon la cadence d'une séquence déjà passée à l'étape suivante.
 */
export async function postponeCampaignMessage(messageId: string, enrollmentId: string, dueIso: string): Promise<void> {
  const m = await supabase.from('campaign_messages').update({ due_at: dueIso }).eq('id', messageId).eq('status', 'draft').select('id')
  if (m.error) throw m.error
  if (!m.data?.length) throw new Error('message_not_sendable')
  const e = await supabase.from('campaign_enrollments').update({ next_due_at: dueIso }).eq('id', enrollmentId).eq('status', 'active').select('id')
  if (e.error) throw e.error
  if (!e.data?.length) throw new Error('enrollment_not_active')
}

export interface LeadCallInput {
  outcome: CallResult
  note?: string
  nextAction?: string
  /** undefined : inchangée ; null : plus de relance prévue. */
  followUpDate?: string | null
}

// Log d'appel hors campagne : insère l'appel puis met à jour le lead (dernier contact, prochaine
// action). Deux écritures sans transaction : si la 2e échoue, l'appel reste loggé (acceptable, la
// fiche se corrige à la main) et CallPartiallySavedError le dit.
export async function logLeadCall(leadId: string, input: LeadCallInput): Promise<void> {
  const { error: callError } = await supabase.from('lead_calls').insert({
    lead_id: leadId,
    outcome: input.outcome,
    note: input.note || null,
  })
  if (callError) throw callError

  const update: LeadUpdate = {
    last_contact_date: parisDay(new Date()),
    canal: 'appel',
  }
  if (input.nextAction) update.next_action = input.nextAction
  if (input.followUpDate !== undefined) update.follow_up_date = input.followUpDate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: leadError } = await supabase.from('leads').update(update as any).eq('id', leadId)
  if (leadError) throw new CallPartiallySavedError(leadError)
}
