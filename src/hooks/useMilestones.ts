import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Milestone } from '@/types/milestones'

export interface UseMilestonesResult {
  milestones: Milestone[]
  isLoading: boolean
  error: string | null
  setStatus: (id: string, status: 'retenu' | 'ecarte') => Promise<void>
  updateTitle: (id: string, titlePublic: string) => Promise<void>
}

export function useMilestones(): UseMilestonesResult {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const { data, error: sbError } = await supabase
      .from('product_milestones')
      .select('*')
      .order('date', { ascending: false })

    if (sbError || !data) {
      setError("Impossible de charger l'historique produit")
      setIsLoading(false)
      return
    }

    setMilestones(data as Milestone[])
    setError(null)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()

    const timeoutId = setTimeout(() => setIsLoading(false), 5000)

    const channel = supabase
      .channel('product_milestones-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_milestones' }, fetchAll)
      .subscribe()

    return () => {
      clearTimeout(timeoutId)
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  const setStatus = async (id: string, status: 'retenu' | 'ecarte'): Promise<void> => {
    const { error: sbError } = await supabase
      .from('product_milestones')
      .update({ status })
      .eq('id', id)
    if (sbError) throw sbError
    await fetchAll()
  }

  // Relecture humaine de la phrase en clair (générée par Gemini) au moment du tri.
  const updateTitle = async (id: string, titlePublic: string): Promise<void> => {
    const { error: sbError } = await supabase
      .from('product_milestones')
      .update({ title_public: titlePublic.trim() || null })
      .eq('id', id)
    if (sbError) throw sbError
    await fetchAll()
  }

  return { milestones, isLoading, error, setStatus, updateTitle }
}
