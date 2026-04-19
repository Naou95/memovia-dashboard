import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type Notification = Database['public']['Tables']['dashboard_notifications']['Row']

interface UseNotificationsResult {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  markAllAsRead: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
}

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('dashboard_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) setNotifications(data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchNotifications()

    // Realtime subscription
    const channel = supabase
      .channel('dashboard_notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dashboard_notifications' },
        () => { fetchNotifications() },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchNotifications])

  const markAsRead = useCallback(async (id: string) => {
    await supabase
      .from('dashboard_notifications')
      .update({ read: true })
      .eq('id', id)
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n),
    )
  }, [])

  const markAllAsRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('dashboard_notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  return { notifications, unreadCount, isLoading, markAllAsRead, markAsRead }
}
