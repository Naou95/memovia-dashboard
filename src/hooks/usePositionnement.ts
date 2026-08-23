import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { PositionnementItem, PositionnementSection } from '@/types/positionnement'

export interface UsePositionnementResult {
  isLoading: boolean
  error: string | null
  /** Les items d'une section, déjà triés par `ordre`. */
  bySection: (section: PositionnementSection) => PositionnementItem[]
  /** Le chapeau d'une section (section 'intro', repéré par sa clé). */
  intro: (key: string) => string
}

/**
 * Lecture seule : l'écriture passe par l'assistant IA (edge function
 * accueil-assistant, en service role). La page se rafraîchit toute seule
 * quand l'assistant modifie quelque chose (realtime activé en 00053).
 */
export function usePositionnement(): UsePositionnementResult {
  const [items, setItems] = useState<PositionnementItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const { data, error: sbError } = await supabase
      .from('positionnement_items')
      .select('*')
      .order('section', { ascending: true })
      .order('ordre', { ascending: true })

    if (sbError || !data) {
      setError('Impossible de charger le positionnement')
      setIsLoading(false)
      return
    }
    setItems(data as PositionnementItem[])
    setError(null)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('positionnement-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positionnement_items' }, fetchAll)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  const bySection = useCallback(
    (section: PositionnementSection) => items.filter((i) => i.section === section),
    [items],
  )

  const intro = useCallback(
    (key: string) => items.find((i) => i.section === 'intro' && i.title === key)?.body ?? '',
    [items],
  )

  return { isLoading, error, bySection, intro }
}
