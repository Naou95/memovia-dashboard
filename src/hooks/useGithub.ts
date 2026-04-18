import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { GitHubData } from '@/types/github'

const CACHE_TTL = 5 * 60 * 1000
let cache: { data: GitHubData; ts: number } | null = null

export interface UseGithubResult {
  data: GitHubData | null
  isLoading: boolean
  error: string | null
}

export function useGithub(): UseGithubResult {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<GitHubData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      setData(cache.data)
      setIsLoading(false)
      return
    }

    supabase.functions
      .invoke<GitHubData>('get-github')
      .then(({ data: d, error: e }) => {
        if (cancelled) return
        if (e || !d) {
          setError('Impossible de charger les données GitHub')
        } else {
          cache = { data: d, ts: Date.now() }
          setData(d)
        }
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { data, isLoading, error }
}

export function invalidateGithubCache(): void {
  cache = null
}
