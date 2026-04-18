import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  FeedbackItemWithVotes,
  FeedbackItemInsert,
  FeedbackItemUpdate,
  FeedbackStatus,
} from '@/types/feedback'
import { toast } from 'sonner'

interface UseFeedbackResult {
  items: FeedbackItemWithVotes[]
  userVotes: Set<string>
  isLoading: boolean
  error: string | null
  toggleVote: (itemId: string) => Promise<void>
  createItem: (data: FeedbackItemInsert) => Promise<void>
  updateItem: (id: string, data: FeedbackItemUpdate) => Promise<void>
  updateStatus: (id: string, status: FeedbackStatus) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

export function useFeedback(): UseFeedbackResult {
  const [items, setItems] = useState<FeedbackItemWithVotes[]>([])
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const [itemsResult, allVotesResult, userResult] = await Promise.all([
      supabase.from('feedback_items').select('*').order('created_at', { ascending: false }),
      supabase.from('feedback_votes').select('item_id, user_id'),
      supabase.auth.getUser(),
    ])

    if (itemsResult.error) {
      setError('Impossible de charger les feedbacks')
      setIsLoading(false)
      return
    }

    const allVotes = allVotesResult.data ?? []
    const currentUserId = userResult.data.user?.id

    const voteCounts = allVotes.reduce<Record<string, number>>((acc, v) => {
      acc[v.item_id] = (acc[v.item_id] ?? 0) + 1
      return acc
    }, {})

    const myVoteSet = new Set(
      currentUserId
        ? allVotes.filter((v) => v.user_id === currentUserId).map((v) => v.item_id)
        : []
    )

    setItems(
      (itemsResult.data ?? []).map((item) => ({
        ...item,
        vote_count: voteCounts[item.id] ?? 0,
      })) as FeedbackItemWithVotes[]
    )
    setUserVotes(myVoteSet)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('feedback-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_items' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_votes' }, fetchAll)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  const toggleVote = async (itemId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const hasVoted = userVotes.has(itemId)

    setUserVotes((prev) => {
      const next = new Set(prev)
      if (hasVoted) next.delete(itemId)
      else next.add(itemId)
      return next
    })
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, vote_count: item.vote_count + (hasVoted ? -1 : 1) }
          : item
      )
    )

    if (hasVoted) {
      const { error } = await supabase
        .from('feedback_votes')
        .delete()
        .eq('item_id', itemId)
        .eq('user_id', user.id)
      if (error) {
        await fetchAll()
        toast.error('Erreur lors de la suppression du vote')
      }
    } else {
      const { error } = await supabase
        .from('feedback_votes')
        .insert({ item_id: itemId, user_id: user.id })
      if (error) {
        await fetchAll()
        toast.error('Erreur lors du vote')
      }
    }
  }

  const createItem = async (data: FeedbackItemInsert) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('feedback_items')
      .insert({ ...data, created_by: user?.id ?? null })
    if (error) {
      toast.error("Impossible de créer l'item")
      return
    }
    toast.success('Item créé')
    await fetchAll()
  }

  const updateItem = async (id: string, data: FeedbackItemUpdate) => {
    const { error } = await supabase.from('feedback_items').update(data).eq('id', id)
    if (error) {
      toast.error("Impossible de modifier l'item")
      return
    }
    await fetchAll()
  }

  const updateStatus = async (id: string, status: FeedbackStatus) => {
    await updateItem(id, { status })
  }

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('feedback_items').delete().eq('id', id)
    if (error) {
      toast.error("Impossible de supprimer l'item")
      return
    }
    toast.success('Item supprimé')
    await fetchAll()
  }

  return {
    items,
    userVotes,
    isLoading,
    error,
    toggleVote,
    createItem,
    updateItem,
    updateStatus,
    deleteItem,
  }
}
