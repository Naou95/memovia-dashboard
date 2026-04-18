import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  CalendarEventsResponse,
  CreateMeetPayload,
  CreateMeetResponse,
} from '@/types/calendar'

export interface UseCalendarResult {
  data: CalendarEventsResponse | null
  isLoading: boolean
  error: string | null
  refetch: (start?: Date, end?: Date) => Promise<void>
  createMeet: (payload: CreateMeetPayload) => Promise<CreateMeetResponse>
  startOAuth: (provider: 'google' | 'microsoft', owner: 'naoufel' | 'emir') => Promise<void>
}

function dateRangeForView(date: Date): { start: Date; end: Date } {
  // Plage large : 6 semaines centrées sur le mois pour couvrir les vues mois et semaine
  const start = new Date(date.getFullYear(), date.getMonth() - 1, 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 2, 0, 23, 59, 59)
  return { start, end }
}

export function useCalendar(currentDate = new Date()): UseCalendarResult {
  const [data, setData] = useState<CalendarEventsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async (start?: Date, end?: Date) => {
    setIsLoading(true)
    setError(null)

    const range = start && end
      ? { start, end }
      : dateRangeForView(currentDate)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Non authentifié')
      setIsLoading(false)
      return
    }

    const params = new URLSearchParams({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    })

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-calendar-events?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        },
      )

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const json: CalendarEventsResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setIsLoading(false)
    }
  }, [currentDate])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const createMeet = useCallback(async (payload: CreateMeetPayload): Promise<CreateMeetResponse> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Non authentifié')

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-google-meet`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(err.error ?? `HTTP ${res.status}`)
    }

    return res.json()
  }, [])

  const startOAuth = useCallback(async (
    provider: 'google' | 'microsoft',
    owner: 'naoufel' | 'emir',
  ): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Non authentifié')

    const params = new URLSearchParams({ provider, owner })
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-oauth-start?${params}`,
      {
        headers: { Authorization: `Bearer ${session.access_token}` },
      },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(err.error ?? `HTTP ${res.status}`)
    }

    const { authUrl } = await res.json()
    window.location.href = authUrl
  }, [])

  return { data, isLoading, error, refetch: fetchEvents, createMeet, startOAuth }
}
