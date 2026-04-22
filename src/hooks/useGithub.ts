import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { createCache } from '@/lib/cache'
import type { GitHubData } from '@/types/github'

const githubCache = createCache<GitHubData>('github', 30 * 60 * 1000)

export interface UseGithubResult {
  data: GitHubData | null
  isLoading: boolean
  error: string | null
  lastFetchedAt: number | null
}

export function useGithub(): UseGithubResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<GitHubData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const cached = githubCache.get()
    if (cached) {
      setData(cached.data)
      setLastFetchedAt(cached.ts)
      setIsLoading(false)
    }

    supabase.functions
      .invoke<GitHubData>('get-github')
      .then(({ data: d, error: e }) => {
        if (cancelled) return
        if (e || !d) {
          if (!cached) {
            setError('Impossible de charger les données GitHub')
            setIsLoading(false)
          }
        } else {
          githubCache.set(d)
          setData(d)
          setLastFetchedAt(Date.now())
          if (!cached) setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { data, isLoading, error, lastFetchedAt }
}

export function invalidateGithubCache(): void {
  githubCache.clear()
}
