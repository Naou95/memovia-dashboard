import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { logLeadCall, type LeadCallInput } from '@/lib/callActions'
import type { Lead, LeadInsert, LeadUpdate } from '@/types/leads'

/** L'écriture vit dans lib/callActions.ts (partagée avec l'agenda) ; le type garde son nom d'origine ici. */
export type LogCallInput = LeadCallInput

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

  // Log d'appel < 30 s : l'appel puis la fiche (dernier contact, prochaine action).
  const logCall = async (leadId: string, input: LogCallInput): Promise<void> => {
    await logLeadCall(leadId, input)
    await fetchAll()
  }

  return { leads, isLoading, error, createLead, updateLead, deleteLead, logCall }
}
