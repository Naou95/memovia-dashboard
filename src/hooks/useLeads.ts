import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Lead, LeadInsert, LeadUpdate, CallOutcome } from '@/types/leads'

export interface LogCallInput {
  outcome: CallOutcome
  note?: string
  nextAction?: string
  followUpDate?: string
}

export interface UseLeadsResult {
  leads: Lead[]
  isLoading: boolean
  error: string | null
  createLead: (data: LeadInsert) => Promise<void>
  updateLead: (id: string, data: LeadUpdate) => Promise<void>
  deleteLead: (id: string) => Promise<void>
  logCall: (leadId: string, input: LogCallInput) => Promise<void>
}

export function useLeads(): UseLeadsResult {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const { data, error: sbError } = await supabase
      .from('leads')
      .select('*')
      .order('follow_up_date', { ascending: true, nullsFirst: false })

    if (sbError || !data) {
      setError('Impossible de charger les leads')
      setIsLoading(false)
      return
    }

    setLeads(data as Lead[])
    setError(null)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()

    const timeoutId = setTimeout(() => setIsLoading(false), 5000)

    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchAll)
      .subscribe()

    return () => {
      clearTimeout(timeoutId)
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  const createLead = async (data: LeadInsert): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await supabase.from('leads').insert(data as any)
    if (sbError) throw sbError
    await fetchAll()
  }

  const updateLead = async (id: string, data: LeadUpdate): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sbError } = await supabase.from('leads').update(data as any).eq('id', id)
    if (sbError) throw sbError
    await fetchAll()
  }

  const deleteLead = async (id: string): Promise<void> => {
    const { error: sbError } = await supabase.from('leads').delete().eq('id', id)
    if (sbError) throw sbError
    await fetchAll()
  }

  // Log d'appel < 30 s : insère l'appel puis met à jour le lead (dernier contact,
  // prochaine action). Deux écritures sans transaction : si la 2e échoue, l'appel
  // reste loggé — acceptable, la fiche se corrige à la main.
  const logCall = async (leadId: string, input: LogCallInput): Promise<void> => {
    const { error: callError } = await supabase.from('lead_calls').insert({
      lead_id: leadId,
      outcome: input.outcome,
      note: input.note || null,
    })
    if (callError) throw callError

    const update: LeadUpdate = {
      last_contact_date: new Date().toISOString().slice(0, 10),
      canal: 'appel',
    }
    if (input.nextAction) update.next_action = input.nextAction
    if (input.followUpDate) update.follow_up_date = input.followUpDate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: leadError } = await supabase.from('leads').update(update as any).eq('id', leadId)
    if (leadError) throw leadError
    await fetchAll()
  }

  return { leads, isLoading, error, createLead, updateLead, deleteLead, logCall }
}
