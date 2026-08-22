import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { RoadmapItem, RoadmapItemInsert, RoadmapItemUpdate, Horizon } from '@/types/roadmap'

export interface UseRoadmapResult {
  items: RoadmapItem[]
  isLoading: boolean
  error: string | null
  createItem: (data: RoadmapItemInsert) => Promise<void>
  updateItem: (id: string, data: RoadmapItemUpdate) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  /** Déplacement kanban : la carte part en tête de la colonne d'arrivée. */
  moveItem: (id: string, horizon: Horizon) => Promise<void>
}

export function useRoadmap(): UseRoadmapResult {
  const [items, setItems] = useState<RoadmapItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const { data, error: sbError } = await supabase
      .from('roadmap_items')
      .select('*')
      .order('ordre', { ascending: true })

    if (sbError || !data) {
      setError('Impossible de charger la roadmap')
      setIsLoading(false)
      return
    }
    setItems(data as RoadmapItem[])
    setError(null)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('roadmap-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roadmap_items' }, fetchAll)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  const createItem = async (data: RoadmapItemInsert): Promise<void> => {
    const { error: sbError } = await supabase.from('roadmap_items').insert(data)
    if (sbError) throw sbError
    await fetchAll()
  }

  const updateItem = async (id: string, data: RoadmapItemUpdate): Promise<void> => {
    const { error: sbError } = await supabase
      .from('roadmap_items')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (sbError) throw sbError
    await fetchAll()
  }

  const deleteItem = async (id: string): Promise<void> => {
    const { error: sbError } = await supabase.from('roadmap_items').delete().eq('id', id)
    if (sbError) throw sbError
    await fetchAll()
  }

  const moveItem = async (id: string, horizon: Horizon): Promise<void> => {
    const min = items
      .filter((i) => i.horizon === horizon)
      .reduce((acc, i) => Math.min(acc, i.ordre), 0)
    // Optimiste : le drag doit être instantané, le realtime confirme ensuite.
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, horizon, ordre: min - 1 } : i)))
    await updateItem(id, { horizon, ordre: min - 1 })
  }

  return { items, isLoading, error, createItem, updateItem, deleteItem, moveItem }
}
