import { useState, useEffect, useCallback, useMemo } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { parseCampaignCsv } from '@/lib/campaignCsv'
import type {
  Campaign,
  CampaignStep,
  CampaignMessage,
  CampaignEnrollment,
  EnrollmentWithLead,
  ReviewItem,
  MessageCheck,
  CallResult,
} from '@/types/campagnes'
import type { LeadUpdate, CallOutcome } from '@/types/leads'

const DAY_MS = 86_400_000
const TEMPLATE_CAMPAIGN_NAME = 'CFA · référent handicap'

function inDays(from: Date, days: number): string {
  return new Date(from.getTime() + days * DAY_MS).toISOString()
}

// ── Liste des campagnes ────────────────────────────────────────────────────────

export interface CampaignSummary extends Campaign {
  activeCount: number
  draftsDue: number
}

export interface UseCampaignsResult {
  campaigns: CampaignSummary[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  /** Duplique la campagne modèle (« CFA · référent handicap », sinon la première) avec ses étapes. */
  duplicateCampaign: (name: string) => Promise<string>
}

export function useCampaigns(): UseCampaignsResult {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [c, e, m] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: true }),
      supabase.from('campaign_enrollments').select('id, campaign_id, status'),
      supabase.from('campaign_messages').select('enrollment_id').eq('status', 'draft').lte('due_at', new Date().toISOString()),
    ])
    if (c.error || e.error || m.error || !c.data) {
      setError('Impossible de charger les campagnes')
      setIsLoading(false)
      return
    }
    const enrollments = e.data || []
    const campaignOfEnrollment = new Map(enrollments.map((x) => [x.id, x.campaign_id]))
    const dueByCampaign = new Map<string, number>()
    for (const row of m.data || []) {
      const cid = campaignOfEnrollment.get(row.enrollment_id)
      if (cid) dueByCampaign.set(cid, (dueByCampaign.get(cid) || 0) + 1)
    }
    setCampaigns(
      (c.data as Campaign[]).map((camp) => ({
        ...camp,
        activeCount: enrollments.filter((x) => x.campaign_id === camp.id && x.status === 'active').length,
        draftsDue: dueByCampaign.get(camp.id) || 0,
      })),
    )
    setError(null)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const duplicateCampaign = async (name: string): Promise<string> => {
    const source = campaigns.find((c) => c.name === TEMPLATE_CAMPAIGN_NAME) || campaigns[0]
    if (!source) throw new Error('Aucune campagne modèle à dupliquer')
    const { data: steps, error: stepsError } = await supabase
      .from('campaign_steps').select('*').eq('campaign_id', source.id).order('position')
    if (stepsError) throw stepsError
    const { data: created, error: insertError } = await supabase
      .from('campaigns')
      .insert({ name, emoji: source.emoji, status: 'draft', sender_email: source.sender_email, owner: source.owner })
      .select('id')
      .single()
    if (insertError || !created) throw insertError || new Error('Création impossible')
    if (steps && steps.length > 0) {
      const { error: copyError } = await supabase.from('campaign_steps').insert(
        steps.map((s) => ({
          campaign_id: created.id,
          position: s.position,
          kind: s.kind,
          wait_days: s.wait_days,
          name: s.name,
          subject_template: s.subject_template,
          body_template: s.body_template,
          ai_brief: s.ai_brief,
        })),
      )
      if (copyError) throw copyError
    }
    await refresh()
    return created.id
  }

  return { campaigns, isLoading, error, refresh, duplicateCampaign }
}

// ── Une campagne ───────────────────────────────────────────────────────────────

export interface TickResult {
  processed: number
  replies_detected: number
  drafts_created: number
  stopped: number
  /** Messages d'erreur du run (campaign-tick renvoie la liste, pas un compte). */
  errors: string[]
}

export interface ImportResult {
  created: number
  reused: number
  enrolled: number
  skipped: number
  /** Lignes dont l'email est celui d'un lead qui n'est plus un prospect (client, perdu, en discussion, archivé). */
  notProspect: number
}

/** Seuls les leads « nouveau » ou « contacté », non archivés, entrent dans une campagne. */
export function isProspect(lead: { status: string; archived?: boolean | null }): boolean {
  return (lead.status === 'nouveau' || lead.status === 'contacte') && !lead.archived
}

/** Envoi refusé par campaign-send : les contrôles bloquants à montrer. */
export class SendBlockedError extends Error {
  checks: MessageCheck[]
  constructor(checks: MessageCheck[]) {
    super('Envoi bloqué par les contrôles')
    this.name = 'SendBlockedError'
    this.checks = checks
  }
}

export interface StepStats {
  step: CampaignStep
  /** Mails envoyés ou appels faits. */
  sent: number
  /** Réponses écrites (mail) ou contacts joints (appel). */
  replies: number
}

export interface CampaignStats {
  total: number
  contacted: number
  reached: number
  replied: number
  interested: number
  rdv: number
  refused: number
  perStep: StepStats[]
}

export interface UseCampaignResult {
  campaign: Campaign | null
  steps: CampaignStep[]
  enrollments: EnrollmentWithLead[]
  messages: CampaignMessage[]
  /** Messages joints à leur inscription, lead et étape : les lignes de la Revue. */
  items: ReviewItem[]
  stats: CampaignStats
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  updateCampaign: (patch: Partial<Pick<Campaign, 'name' | 'emoji' | 'status' | 'sender_email' | 'owner'>>) => Promise<void>
  updateStep: (stepId: string, patch: Partial<Pick<CampaignStep, 'name' | 'wait_days' | 'subject_template' | 'body_template' | 'ai_brief'>>) => Promise<void>
  enrollLeads: (leadIds: string[]) => Promise<TickResult | null>
  importCsv: (text: string) => Promise<ImportResult>
  runTick: () => Promise<TickResult>
  sendMessage: (messageId: string, subject: string, body: string) => Promise<void>
  skipMessage: (messageId: string) => Promise<void>
  postponeMessage: (messageId: string, days: number) => Promise<void>
  stopEnrollment: (enrollmentId: string) => Promise<void>
  resumeEnrollment: (enrollmentId: string) => Promise<void>
  completeCall: (messageId: string, outcome: CallResult, note: string) => Promise<void>
}

const REACHED: CallResult[] = ['joint', 'interesse', 'refus', 'rappel']

export function useCampaign(id: string | undefined): UseCampaignResult {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [steps, setSteps] = useState<CampaignStep[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentWithLead[]>([])
  const [messages, setMessages] = useState<CampaignMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!id) return
    const [c, s, e] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', id).maybeSingle(),
      supabase.from('campaign_steps').select('*').eq('campaign_id', id).order('position'),
      supabase.from('campaign_enrollments').select('*, lead:leads(*)').eq('campaign_id', id).order('started_at'),
    ])
    if (c.error || s.error || e.error || !c.data) {
      setError('Impossible de charger la campagne')
      setIsLoading(false)
      return
    }
    // Jointure non déclarée dans database.ts (Relationships: []) : on caste.
    const enr = (e.data || []) as unknown as EnrollmentWithLead[]
    let msgs: CampaignMessage[] = []
    if (enr.length > 0) {
      const m = await supabase
        .from('campaign_messages').select('*').in('enrollment_id', enr.map((x) => x.id)).order('due_at')
      if (m.error) {
        setError('Impossible de charger les brouillons')
        setIsLoading(false)
        return
      }
      msgs = (m.data || []) as unknown as CampaignMessage[]
    }
    setCampaign(c.data as Campaign)
    setSteps(s.data as CampaignStep[])
    setEnrollments(enr)
    setMessages(msgs)
    setError(null)
    setIsLoading(false)
  }, [id])

  useEffect(() => {
    refresh()
    if (!id) return
    const channel = supabase
      .channel(`campaign-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_messages' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_enrollments', filter: `campaign_id=eq.${id}` }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, refresh])

  const stepById = useMemo(() => new Map(steps.map((s) => [s.id, s])), [steps])
  const enrollmentById = useMemo(() => new Map(enrollments.map((e) => [e.id, e])), [enrollments])

  const items = useMemo<ReviewItem[]>(
    () =>
      messages.flatMap((m) => {
        const enrollment = enrollmentById.get(m.enrollment_id)
        const step = stepById.get(m.step_id)
        return enrollment && step ? [{ ...m, enrollment, step }] : []
      }),
    [messages, enrollmentById, stepById],
  )

  const stats = useMemo<CampaignStats>(() => {
    const byEnrollment = new Map<string, CampaignMessage[]>()
    for (const m of messages) {
      const list = byEnrollment.get(m.enrollment_id) || []
      list.push(m)
      byEnrollment.set(m.enrollment_id, list)
    }
    const has = (e: CampaignEnrollment, pred: (m: CampaignMessage) => boolean) => (byEnrollment.get(e.id) || []).some(pred)
    const contacted = enrollments.filter((e) => has(e, (m) => m.status === 'sent'))
    const reached = enrollments.filter((e) => has(e, (m) => m.kind === 'call' && m.outcome != null && REACHED.includes(m.outcome)))
    const replied = enrollments.filter((e) => e.stop_reason === 'replied')
    const interested = enrollments.filter((e) => e.lead.status === 'en_discussion' || has(e, (m) => m.outcome === 'interesse'))
    const rdv = enrollments.filter((e) => e.lead.status === 'proposition' || e.lead.status === 'gagne')
    const refused = enrollments.filter((e) => e.stop_reason === 'refused' || e.stop_reason === 'lost')
    // Une réponse écrite est attribuée au dernier mail envoyé de l'inscription.
    const lastSentStep = new Map<string, string>()
    for (const e of replied) {
      const sent = (byEnrollment.get(e.id) || []).filter((m) => m.kind === 'email' && m.status === 'sent').sort((a, b) => (a.sent_at || '').localeCompare(b.sent_at || ''))
      const last = sent[sent.length - 1]
      if (last) lastSentStep.set(e.id, last.step_id)
    }
    const perStep = steps.map((step) => {
      const own = messages.filter((m) => m.step_id === step.id)
      return step.kind === 'call'
        ? { step, sent: own.filter((m) => m.status === 'done').length, replies: own.filter((m) => m.outcome != null && REACHED.includes(m.outcome)).length }
        : { step, sent: own.filter((m) => m.status === 'sent').length, replies: [...lastSentStep.values()].filter((sid) => sid === step.id).length }
    })
    return {
      total: enrollments.length,
      contacted: contacted.length,
      reached: reached.length,
      replied: replied.length,
      interested: interested.length,
      rdv: rdv.length,
      refused: refused.length,
      perStep,
    }
  }, [enrollments, messages, steps])

  // ── Actions ──────────────────────────────────────────────────────────────────

  const updateCampaign: UseCampaignResult['updateCampaign'] = async (patch) => {
    if (!id) return
    const { error: sbError } = await supabase.from('campaigns').update(patch).eq('id', id)
    if (sbError) throw sbError
    await refresh()
  }

  const updateStep: UseCampaignResult['updateStep'] = async (stepId, patch) => {
    const { error: sbError } = await supabase.from('campaign_steps').update(patch).eq('id', stepId)
    if (sbError) throw sbError
    await refresh()
  }

  const runTick = async (): Promise<TickResult> => {
    const { data, error: fnError } = await supabase.functions.invoke('campaign-tick', { body: { campaign_id: id } })
    if (fnError) throw fnError
    await refresh()
    return data as TickResult
  }

  const enrollLeads = async (leadIds: string[]): Promise<TickResult | null> => {
    if (!id || leadIds.length === 0) return null
    const now = new Date().toISOString()
    const { error: sbError } = await supabase
      .from('campaign_enrollments')
      .insert(leadIds.map((lead_id) => ({ campaign_id: id, lead_id, status: 'active' as const, next_due_at: now })))
    if (sbError) throw sbError
    // Les inscriptions existent : un tick en échec (Gemini lent, passerelle) n'est pas un échec
    // d'ajout, le prochain Actualiser rattrapera les brouillons.
    try {
      return await runTick()
    } catch {
      await refresh()
      return null
    }
  }

  const importCsv = async (text: string): Promise<ImportResult> => {
    const { contacts, skipped } = parseCampaignCsv(text)
    const emails = contacts.map((c) => c.contact_email)
    // contact_email n'est pas dans le type généré de leads (comme useLeads) : on caste.
    const { data: existing, error: findError } = emails.length
      ? await supabase.from('leads').select('id, contact_email, status, archived').in('contact_email', emails)
      : { data: [], error: null }
    if (findError) throw findError
    const found = (existing || []) as unknown as { id: string; contact_email: string | null; status: string; archived: boolean | null }[]
    const byEmail = new Map(found.map((l) => [(l.contact_email || '').toLowerCase(), l]))
    const today = new Date().toLocaleDateString('fr-FR')
    const ids: string[] = []
    let created = 0
    let reused = 0
    let notProspect = 0
    for (const c of contacts) {
      const found = byEmail.get(c.contact_email)
      if (found) {
        if (isProspect(found)) { ids.push(found.id); reused++ } else notProspect++
        continue
      }
      const insert = {
        name: c.name,
        type: 'cfa',
        canal: 'email',
        status: 'nouveau',
        contact_email: c.contact_email,
        contact_name: c.contact_name,
        contact_role: c.contact_role,
        contact_phone: c.contact_phone,
        notes: c.notes,
        source: `Import CSV ${today}`,
        assigned_to: campaign?.owner ?? null,
      }
      // Les colonnes contact_* n'existent pas dans le type Insert généré (comme useLeads).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: insertError } = await supabase.from('leads').insert(insert as any).select('id').single()
      if (insertError || !data) throw insertError || new Error('Insertion du lead impossible')
      byEmail.set(c.contact_email, { id: data.id, contact_email: c.contact_email, status: 'nouveau', archived: false })
      ids.push(data.id)
      created++
    }
    const already = new Set(enrollments.map((e) => e.lead_id))
    const toEnroll = [...new Set(ids)].filter((x) => !already.has(x))
    await enrollLeads(toEnroll)
    return { created, reused, enrolled: toEnroll.length, skipped, notProspect }
  }

  const sendMessage = async (messageId: string, subject: string, body: string): Promise<void> => {
    const { data, error: fnError } = await supabase.functions.invoke('campaign-send', { body: { message_id: messageId, subject, body } })
    let payload = data as { error?: string; checks?: MessageCheck[] } | null
    if (fnError instanceof FunctionsHttpError) {
      try { payload = await fnError.context.json() } catch { /* corps illisible : on garde l'erreur brute */ }
    }
    if (payload?.error === 'blocked' && payload.checks) throw new SendBlockedError(payload.checks)
    // Refus métier de l'edge (409 : a répondu, déjà en cours d'envoi…) : le code sert au message.
    if (payload?.error) { await refresh(); throw new Error(payload.error) }
    if (fnError) throw fnError
    await refresh()
  }

  /** Passe l'inscription à l'étape suivante, ou la termine s'il n'y en a pas. */
  const advance = async (enrollment: CampaignEnrollment): Promise<void> => {
    const next = steps.find((s) => s.position > enrollment.current_position)
    const patch = next
      ? { current_position: next.position, next_due_at: inDays(new Date(), next.wait_days) }
      : { status: 'done' as const, stop_reason: 'finished' }
    // Garde : un onglet pas à jour n'avance pas deux fois la même inscription.
    const { error: sbError } = await supabase
      .from('campaign_enrollments').update(patch).eq('id', enrollment.id).eq('current_position', enrollment.current_position)
    if (sbError) throw sbError
  }

  const skipDrafts = async (enrollmentId: string): Promise<void> => {
    const { error: sbError } = await supabase
      .from('campaign_messages').update({ status: 'skipped' }).eq('enrollment_id', enrollmentId).eq('status', 'draft')
    if (sbError) throw sbError
  }

  const requireMessage = (messageId: string) => {
    const message = messages.find((m) => m.id === messageId)
    const enrollment = message && enrollmentById.get(message.enrollment_id)
    if (!message || !enrollment) throw new Error('Message introuvable')
    return { message, enrollment }
  }

  const skipMessage = async (messageId: string): Promise<void> => {
    const { enrollment } = requireMessage(messageId)
    const { data: skipped, error: sbError } = await supabase
      .from('campaign_messages').update({ status: 'skipped' }).eq('id', messageId).eq('status', 'draft').select('id')
    if (sbError) throw sbError
    if (!skipped?.length) { await refresh(); throw new Error('message_not_sendable') }
    await advance(enrollment)
    await refresh()
  }

  const postponeMessage = async (messageId: string, days: number): Promise<void> => {
    const { enrollment } = requireMessage(messageId)
    const due = inDays(new Date(), days)
    const m = await supabase.from('campaign_messages').update({ due_at: due }).eq('id', messageId)
    if (m.error) throw m.error
    const e = await supabase.from('campaign_enrollments').update({ next_due_at: due }).eq('id', enrollment.id)
    if (e.error) throw e.error
    await refresh()
  }

  const stopEnrollment = async (enrollmentId: string): Promise<void> => {
    const { error: sbError } = await supabase
      .from('campaign_enrollments').update({ status: 'stopped', stop_reason: 'manual' }).eq('id', enrollmentId)
    if (sbError) throw sbError
    await skipDrafts(enrollmentId)
    await refresh()
  }

  const resumeEnrollment = async (enrollmentId: string): Promise<void> => {
    const { error: sbError } = await supabase
      .from('campaign_enrollments')
      // started_at repart de maintenant : sinon le tick retrouve l'ancienne réponse et réarrête aussitôt.
      .update({ status: 'active', stop_reason: null, next_due_at: new Date().toISOString(), started_at: new Date().toISOString() })
      .eq('id', enrollmentId)
    if (sbError) throw sbError
    await refresh()
  }

  const completeCall = async (messageId: string, outcome: CallResult, note: string): Promise<void> => {
    const { enrollment } = requireMessage(messageId)
    const trimmed = note.trim()
    // Garde d'abord : un onglet pas à jour ne rejoue pas un appel déjà enregistré ailleurs.
    const msg = await supabase
      .from('campaign_messages').update({ status: 'done', outcome, note: trimmed || null }).eq('id', messageId).eq('status', 'draft').select('id')
    if (msg.error) throw msg.error
    if (!msg.data?.length) { await refresh(); throw new Error('message_not_sendable') }

    const callOutcome: CallOutcome = outcome === 'pas_repondu' ? 'pas_repondu' : outcome === 'rappel' ? 'rappel' : 'repondu'
    const callNote = outcome === 'refus' ? `Refus. ${trimmed}`.trim() : trimmed || null
    const call = await supabase.from('lead_calls').insert({ lead_id: enrollment.lead_id, outcome: callOutcome, note: callNote })
    if (call.error) throw call.error

    const leadPatch: LeadUpdate = { last_contact_date: new Date().toISOString().slice(0, 10), canal: 'appel' }
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
      await skipDrafts(enrollment.id)
    } else if (outcome === 'rappel') {
      const e = await supabase.from('campaign_enrollments').update({ next_due_at: inDays(new Date(), 2) }).eq('id', enrollment.id)
      if (e.error) throw e.error
    } else {
      await advance(enrollment)
    }
    await refresh()
  }

  return {
    campaign,
    steps,
    enrollments,
    messages,
    items,
    stats,
    isLoading,
    error,
    refresh,
    updateCampaign,
    updateStep,
    enrollLeads,
    importCsv,
    runTick,
    sendMessage,
    skipMessage,
    postponeMessage,
    stopEnrollment,
    resumeEnrollment,
    completeCall,
  }
}

/** Étape à laquelle l'inscription est rendue, ou null si hors séquence. */
export function currentStep(enrollment: CampaignEnrollment, steps: CampaignStep[]): CampaignStep | null {
  return steps.find((s) => s.position === enrollment.current_position) || null
}

/** Étape qui suit celle-ci dans la séquence. */
export function nextStep(step: CampaignStep, steps: CampaignStep[]): CampaignStep | null {
  return steps.find((s) => s.position > step.position) || null
}
