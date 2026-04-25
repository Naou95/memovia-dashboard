import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  CalendarEventsResponse,
  CreateMeetPayload,
  CreateMeetResponse,
} from '@/types/calendar'

const CACHE_TTL = 5 * 60 * 1000
const calendarCache = new Map<string, { data: CalendarEventsResponse; ts: number }>()

export function invalidateCalendarCache(): void {
  calendarCache.clear()
}

export interface UseCalendarResult {
  data: CalendarEventsResponse | null
  allUsersData: CalendarEventsResponse | null
  isLoading: boolean
  isLoadingAll: boolean
  error: string | null
  refetch: () => Promise<void>
  refetchAll: () => Promise<void>
  createMeet: (payload: CreateMeetPayload) => Promise<CreateMeetResponse>
  startOAuth: () => Promise<void>
}

function dateRangeForView(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth() - 1, 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 2, 0, 23, 59, 59)
  return { start, end }
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

async function callCalendarAPI(
  accessToken: string,
  params: URLSearchParams,
): Promise<CalendarEventsResponse> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-calendar-events?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  )

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Génère une clé de cache stable pour une date donnée (mois courant ± 1) */
function cacheKeyForDate(date: Date, prefix: string): string {
  return `${prefix}_${date.getFullYear()}-${date.getMonth()}`
}

/** Déduplique les événements par (title + start) côté client */
function deduplicateEvents(response: CalendarEventsResponse): CalendarEventsResponse {
  const seen = new Set<string>()
  const events = response.events.filter((ev) => {
    const key = `${ev.title}::${ev.start}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { ...response, events }
}

export function useCalendar(currentDate = new Date(), options: { enabled?: boolean } = {}): UseCalendarResult {
  const { enabled = true } = options
  const [data, setData] = useState<CalendarEventsResponse | null>(null)
  const [allUsersData, setAllUsersData] = useState<CalendarEventsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(enabled)
  const [isLoadingAll, setIsLoadingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentDateRef = useRef(currentDate)
  const abortRef = useRef<{ aborted: boolean } | null>(null)
  const abortAllRef = useRef<{ aborted: boolean } | null>(null)
  // Empêche le double-fetch sur le même range au même render
  const lastFetchKey = useRef<string | null>(null)
  const lastFetchAllKey = useRef<string | null>(null)

  useEffect(() => { currentDateRef.current = currentDate }, [currentDate])

  const fetchEvents = useCallback(async (force = false) => {
    const key = cacheKeyForDate(currentDateRef.current, 'own')

    // Évite les appels redondants sur le même range
    if (!force && lastFetchKey.current === key) return
    lastFetchKey.current = key

    if (abortRef.current) abortRef.current.aborted = true
    const guard = { aborted: false }
    abortRef.current = guard

    setIsLoading(true)
    setError(null)

    const cached = calendarCache.get(key)
    if (!force && cached && Date.now() - cached.ts < CACHE_TTL) {
      if (!guard.aborted) setData(cached.data)
      if (!guard.aborted) setIsLoading(false)
      return
    }

    const range = dateRangeForView(currentDateRef.current)
    const session = await getSession()
    if (!session) {
      if (!guard.aborted) setError('Non authentifié')
      if (!guard.aborted) setIsLoading(false)
      return
    }

    const params = new URLSearchParams({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    })

    try {
      const raw = await callCalendarAPI(session.access_token, params)
      const json = deduplicateEvents(raw)
      calendarCache.set(key, { data: json, ts: Date.now() })
      if (!guard.aborted) setData(json)
    } catch (err) {
      if (!guard.aborted) setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      if (!guard.aborted) setIsLoading(false)
    }
  }, [])

  const fetchAllUsers = useCallback(async (force = false) => {
    const key = cacheKeyForDate(currentDateRef.current, 'all')

    if (!force && lastFetchAllKey.current === key) return
    lastFetchAllKey.current = key

    if (abortAllRef.current) abortAllRef.current.aborted = true
    const guard = { aborted: false }
    abortAllRef.current = guard

    setIsLoadingAll(true)

    const cached = calendarCache.get(key)
    if (!force && cached && Date.now() - cached.ts < CACHE_TTL) {
      if (!guard.aborted) setAllUsersData(cached.data)
      if (!guard.aborted) setIsLoadingAll(false)
      return
    }

    const range = dateRangeForView(currentDateRef.current)
    const session = await getSession()
    if (!session) {
      if (!guard.aborted) setIsLoadingAll(false)
      return
    }

    const params = new URLSearchParams({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      include_all_users: 'true',
    })

    try {
      const raw = await callCalendarAPI(session.access_token, params)
      const json = deduplicateEvents(raw)
      calendarCache.set(key, { data: json, ts: Date.now() })
      if (!guard.aborted) setAllUsersData(json)
    } catch {
      // silencieux — la vue standard reste disponible
    } finally {
      if (!guard.aborted) setIsLoadingAll(false)
    }
  }, [])

  // Fetch initial + refetch quand la date change de mois
  useEffect(() => {
    if (!enabled) return
    fetchEvents()
    return () => {
      if (abortRef.current) abortRef.current.aborted = true
    }
  }, [fetchEvents, enabled, currentDate])

  const refetch = useCallback(async () => {
    lastFetchKey.current = null // force bypass du guard
    await fetchEvents(true)
  }, [fetchEvents])

  const refetchAll = useCallback(async () => {
    lastFetchAllKey.current = null
    await fetchAllUsers(true)
  }, [fetchAllUsers])

  const createMeet = useCallback(async (payload: CreateMeetPayload): Promise<CreateMeetResponse> => {
    const session = await getSession()
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

  const startOAuth = useCallback(async (): Promise<void> => {
    const session = await getSession()
    if (!session) throw new Error('Non authentifié')

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-oauth-start`,
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

  return { data, allUsersData, isLoading, isLoadingAll, error, refetch, refetchAll, createMeet, startOAuth }
}
