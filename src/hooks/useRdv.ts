import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Rdv, RdvInsert, RdvUpdate } from '@/types/rdv'

export interface UseRdvResult {
  rdvs: Rdv[]
  isLoading: boolean
  error: string | null
  createRdv: (data: RdvInsert) => Promise<void>
  updateRdv: (id: string, data: RdvUpdate) => Promise<void>
  deleteRdv: (id: string) => Promise<void>
  /** Upload l'audio dans le bucket privé puis lance transcription + CR. */
  uploadAndTranscribe: (rdvId: string, file: File) => Promise<void>
}

export function useRdv(): UseRdvResult {
  const [rdvs, setRdvs] = useState<Rdv[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const { data, error: sbError } = await supabase
      .from('rdv')
      .select('*')
      .order('rdv_date', { ascending: false })

    if (sbError || !data) {
      setError('Impossible de charger les RDV')
      setIsLoading(false)
      return
    }
    setRdvs(data as Rdv[])
    setError(null)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('rdv-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rdv' }, fetchAll)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  const createRdv = async (data: RdvInsert): Promise<void> => {
    const { error: sbError } = await supabase.from('rdv').insert(data)
    if (sbError) throw sbError
    await fetchAll()
  }

  const updateRdv = async (id: string, data: RdvUpdate): Promise<void> => {
    const { error: sbError } = await supabase
      .from('rdv')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (sbError) throw sbError
    await fetchAll()
  }

  const deleteRdv = async (id: string): Promise<void> => {
    const { error: sbError } = await supabase.from('rdv').delete().eq('id', id)
    if (sbError) throw sbError
    await fetchAll()
  }

  const uploadAndTranscribe = async (rdvId: string, file: File): Promise<void> => {
    const path = `${rdvId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: uploadError } = await supabase.storage.from('rdv-audio').upload(path, file)
    if (uploadError) throw uploadError

    await updateRdv(rdvId, { audio_path: path, cr_status: 'en_cours' })

    // La fonction transcrit (Gladia) puis génère le CR (Gemini) ; elle remet
    // cr_status à « manquant » si ça échoue — le realtime rafraîchit la liste.
    const { error: fnError } = await supabase.functions.invoke('rdv-transcribe', {
      body: { rdv_id: rdvId },
    })
    if (fnError) throw fnError
    await fetchAll()
  }

  return { rdvs, isLoading, error, createRdv, updateRdv, deleteRdv, uploadAndTranscribe }
}
