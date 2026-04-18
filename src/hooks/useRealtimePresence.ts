import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ActiveUser {
  id: string
  email: string
  first_name: string
  last_name: string | null
  account_type: string
  plan: string | null
  organization_name: string | null
  last_sign_in_at: string | null
}

export interface RealtimeStats {
  activeLast30m: number
  activeLast1h: number
  activeLast24h: number
  totalUsers: number
}

export interface HourlyBucket {
  hour: string
  count: number
}

export interface UseRealtimePresenceResult {
  stats: RealtimeStats | null
  recentUsers: ActiveUser[]
  hourlyData: HourlyBucket[]
  isLoading: boolean
  error: string | null
  lastRefresh: Date | null
  isConnected: boolean
  refresh: () => void
}

const REFRESH_MS = 30_000
const FETCH_LIMIT = 500

function computeStats(users: ActiveUser[], totalUsers: number): RealtimeStats {
  const now = Date.now()
  const cutoff = (ms: number) => new Date(now - ms)

  const countSince = (since: Date) =>
    users.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= since).length

  return {
    activeLast30m: countSince(cutoff(30 * 60_000)),
    activeLast1h: countSince(cutoff(60 * 60_000)),
    activeLast24h: countSince(cutoff(24 * 60 * 60_000)),
    totalUsers,
  }
}

function buildHourlyData(users: ActiveUser[]): HourlyBucket[] {
  const now = new Date()
  return Array.from({ length: 24 }, (_, i) => {
    const hourStart = new Date(now)
    hourStart.setMinutes(0, 0, 0)
    hourStart.setHours(hourStart.getHours() - (23 - i))
    const hourEnd = new Date(hourStart.getTime() + 3_600_000)
    const count = users.filter((u) => {
      if (!u.last_sign_in_at) return false
      const t = new Date(u.last_sign_in_at)
      return t >= hourStart && t < hourEnd
    }).length
    return { hour: `${hourStart.getHours()}h`, count }
  })
}

export function useRealtimePresence(): UseRealtimePresenceResult {
  const [users, setUsers] = useState<ActiveUser[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      const { data, error: sbError, count } = await supabase
        .from('v_dashboard_users')
        .select(
          'id, email, first_name, last_name, account_type, plan, organization_name, last_sign_in_at',
          { count: 'exact' }
        )
        .not('last_sign_in_at', 'is', null)
        .order('last_sign_in_at', { ascending: false })
        .limit(FETCH_LIMIT)

      if (sbError) {
        setError(`Erreur chargement : ${sbError.message}`)
        return
      }

      setUsers((data ?? []) as ActiveUser[])
      setTotalUsers(count ?? 0)
      setError(null)
      setLastRefresh(new Date())
    } catch {
      setError('Erreur inattendue lors du chargement.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    intervalRef.current = setInterval(fetchUsers, REFRESH_MS)

    const channel = supabase
      .channel('realtime-presence-module')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers()
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      supabase.removeChannel(channel)
    }
  }, [fetchUsers])

  const cutoff24h = new Date(Date.now() - 24 * 60 * 60_000)
  const recentUsers = users.filter(
    (u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= cutoff24h
  )

  return {
    stats: !isLoading ? computeStats(users, totalUsers) : null,
    recentUsers,
    hourlyData: buildHourlyData(users),
    isLoading,
    error,
    lastRefresh,
    isConnected,
    refresh: fetchUsers,
  }
}
