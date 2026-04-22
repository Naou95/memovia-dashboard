import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { createCache } from '@/lib/cache'
import type { PostHogAppData, PostHogWebData, SupabaseAnalyticsData } from '@/types/analytics'

const TTL = 15 * 60 * 1000

// In-memory only — payloads too large for localStorage quota
const cacheApp = createCache<PostHogAppData>('posthog-app', TTL, { inMemoryOnly: true })
const cacheWeb = createCache<PostHogWebData>('posthog-web', TTL, { inMemoryOnly: true })
const cacheSupabase = createCache<SupabaseAnalyticsData>('analytics-supabase', TTL, { inMemoryOnly: true })

// ── usePostHogApp ────────────────────────────────────────────────────────────

export interface UsePostHogAppResult {
  data: PostHogAppData | null
  isLoading: boolean
  error: string | null
  lastFetchedAt: number | null
}

export function usePostHogApp(): UsePostHogAppResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<PostHogAppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const cached = cacheApp.get()
    if (cached) {
      setData(cached.data)
      setLastFetchedAt(cached.ts)
      setIsLoading(false)
    }

    supabase.functions
      .invoke<PostHogAppData>('get-posthog', { body: { host: 'app.memovia.io' } })
      .then(({ data: d, error: e }) => {
        if (cancelled) return
        if (e || !d) {
          if (!cached) {
            setError('Impossible de charger les données PostHog (app.memovia.io)')
            setIsLoading(false)
          }
        } else {
          cacheApp.set(d)
          setData(d)
          setLastFetchedAt(Date.now())
          if (!cached) setIsLoading(false)
        }
      })
      .catch(() => {
        if (cancelled) return
        if (!cached) {
          setError('Erreur réseau lors du chargement PostHog (app.memovia.io)')
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { data, isLoading, error, lastFetchedAt }
}

// ── usePostHogWeb ────────────────────────────────────────────────────────────

export interface UsePostHogWebResult {
  data: PostHogWebData | null
  isLoading: boolean
  error: string | null
  lastFetchedAt: number | null
}

export function usePostHogWeb(): UsePostHogWebResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<PostHogWebData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const cached = cacheWeb.get()
    if (cached) {
      setData(cached.data)
      setLastFetchedAt(cached.ts)
      setIsLoading(false)
    }

    supabase.functions
      .invoke<PostHogWebData>('get-posthog', { body: { host: 'memovia.io' } })
      .then(({ data: d, error: e }) => {
        if (cancelled) return
        if (e || !d) {
          if (!cached) {
            setError('Impossible de charger les données PostHog (memovia.io)')
            setIsLoading(false)
          }
        } else {
          cacheWeb.set(d)
          setData(d)
          setLastFetchedAt(Date.now())
          if (!cached) setIsLoading(false)
        }
      })
      .catch(() => {
        if (cancelled) return
        if (!cached) {
          setError('Erreur réseau lors du chargement PostHog (memovia.io)')
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { data, isLoading, error, lastFetchedAt }
}

// ── useAnalyticsSupabase ─────────────────────────────────────────────────────

export interface UseAnalyticsSupabaseResult {
  data: SupabaseAnalyticsData | null
  isLoading: boolean
  error: string | null
  lastFetchedAt: number | null
}

export function useAnalyticsSupabase(): UseAnalyticsSupabaseResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<SupabaseAnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const cached = cacheSupabase.get()
    if (cached) {
      setData(cached.data)
      setLastFetchedAt(cached.ts)
      setIsLoading(false)
    }

    supabase.functions
      .invoke<SupabaseAnalyticsData>('get-analytics-supabase')
      .then(({ data: d, error: e }) => {
        if (cancelled) return
        if (e || !d) {
          if (!cached) {
            setError('Impossible de charger les données Supabase (inscriptions / générations)')
            setIsLoading(false)
          }
        } else {
          cacheSupabase.set(d)
          setData(d)
          setLastFetchedAt(Date.now())
          if (!cached) setIsLoading(false)
        }
      })
      .catch(() => {
        if (cancelled) return
        if (!cached) {
          setError('Erreur réseau lors du chargement des données Supabase')
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { data, isLoading, error, lastFetchedAt }
}

// ── Cache invalidation ───────────────────────────────────────────────────────

export function invalidateAllAnalyticsCache(): void {
  cacheApp.clear()
  cacheWeb.clear()
  cacheSupabase.clear()
}
