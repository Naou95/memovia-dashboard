import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Financement, FinancementInsert, FinancementUpdate } from '@/types/financements'

export interface UseFinancementsResult {
  financements: Financement[]
  isLoading: boolean
  error: string | null
  createFinancement: (data: FinancementInsert) => Promise<void>
  updateFinancement: (id: string, data: FinancementUpdate) => Promise<void>
  deleteFinancement: (id: string) => Promise<void>
}

export function useFinancements(): UseFinancementsResult {
  const [financements, setFinancements] = useState<Financement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const { data, error: sbError } = await supabase
      .from('financements')
      .select('*')
      .order('deadline', { ascending: true, nullsFirst: false })

    if (sbError || !data) {
      setError('Impossible de charger les financements')
      setIsLoading(false)
      return
    }
    setFinancements(data as Financement[])
    setError(null)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('financements-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financements' }, fetchAll)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  const createFinancement = async (data: FinancementInsert): Promise<void> => {
    const { error: sbError } = await supabase.from('financements').insert(data)
    if (sbError) throw sbError
    await fetchAll()
  }

  const updateFinancement = async (id: string, data: FinancementUpdate): Promise<void> => {
    const { error: sbError } = await supabase
      .from('financements')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (sbError) throw sbError
    await fetchAll()
  }

  const deleteFinancement = async (id: string): Promise<void> => {
    const { error: sbError } = await supabase.from('financements').delete().eq('id', id)
    if (sbError) throw sbError
    await fetchAll()
  }

  return { financements, isLoading, error, createFinancement, updateFinancement, deleteFinancement }
}
