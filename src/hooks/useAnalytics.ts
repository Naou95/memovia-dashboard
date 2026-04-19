import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { PostHogAppData, PostHogWebData, SupabaseAnalyticsData } from '@/types/analytics'

const CACHE_TTL = 10 * 60 * 1000

// ── Module-level caches ──────────────────────────────────────────────────────

let cacheApp: { data: PostHogAppData; ts: number } | null = null
let cacheWeb: { data: PostHogWebData; ts: number } | null = null
let cacheSupabase: { data: SupabaseAnalyticsData; ts: number } | null = null

// ── usePostHogApp ────────────────────────────────────────────────────────────

export interface UsePostHogAppResult {
  data: PostHogAppData | null
  isLoading: boolean
  error: string | null
}

export function usePostHogApp(): UsePostHogAppResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<PostHogAppData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (cacheApp && Date.now() - cacheApp.ts < CACHE_TTL) {
      setData(cacheApp.data)
      setError(null)
      setIsLoading(false)
      return
    }

    supabase.functions
      .invoke<PostHogAppData>('get-posthog', {
        body: { host: 'app.memovia.io' },
      })
      .then(({ data: d, error: e }) => {
        if (cancelled) return
        if (e || !d) {
          setError('Impossible de charger les données PostHog (app.memovia.io)')
        } else {
          cacheApp = { data: d, ts: Date.now() }
          setData(d)
        }
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Erreur réseau lors du chargement PostHog (app.memovia.io)')
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { data, isLoading, error }
}

// ── usePostHogWeb ────────────────────────────────────────────────────────────

export interface UsePostHogWebResult {
  data: PostHogWebData | null
  isLoading: boolean
  error: string | null
}

export function usePostHogWeb(): UsePostHogWebResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<PostHogWebData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (cacheWeb && Date.now() - cacheWeb.ts < CACHE_TTL) {
      setData(cacheWeb.data)
      setError(null)
      setIsLoading(false)
      return
    }

    supabase.functions
      .invoke<PostHogWebData>('get-posthog', {
        body: { host: 'memovia.io' },
      })
      .then(({ data: d, error: e }) => {
        if (cancelled) return
        if (e || !d) {
          setError('Impossible de charger les données PostHog (memovia.io)')
        } else {
          cacheWeb = { data: d, ts: Date.now() }
          setData(d)
        }
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Erreur réseau lors du chargement PostHog (memovia.io)')
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { data, isLoading, error }
}

// ── useAnalyticsSupabase ─────────────────────────────────────────────────────

export interface UseAnalyticsSupabaseResult {
  data: SupabaseAnalyticsData | null
  isLoading: boolean
  error: string | null
}

export function useAnalyticsSupabase(): UseAnalyticsSupabaseResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<SupabaseAnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (cacheSupabase && Date.now() - cacheSupabase.ts < CACHE_TTL) {
      setData(cacheSupabase.data)
      setError(null)
      setIsLoading(false)
      return
    }

    supabase.functions
      .invoke<SupabaseAnalyticsData>('get-analytics-supabase')
      .then(({ data: d, error: e }) => {
        if (cancelled) return
        if (e || !d) {
          setError('Impossible de charger les données Supabase (inscriptions / générations)')
        } else {
          cacheSupabase = { data: d, ts: Date.now() }
          setData(d)
        }
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Erreur réseau lors du chargement des données Supabase')
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { data, isLoading, error }
}

// ── Cache invalidation ───────────────────────────────────────────────────────

export function invalidateAllAnalyticsCache(): void {
  cacheApp = null
  cacheWeb = null
  cacheSupabase = null
}
