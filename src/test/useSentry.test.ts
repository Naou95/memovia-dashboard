import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { mockInvoke } = vi.hoisted(() => {
  const mockInvoke = vi.fn()
  return { mockInvoke }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
  },
}))

// Import APRÈS le mock
import { useSentry, invalidateSentryCache } from '@/hooks/useSentry'
import type { SentryData } from '@/types/sentry'

const mockData: SentryData = {
  stats: { totalIssues: 2, totalOccurrences: 15, usersAffected: 3 },
  issues: [
    {
      id: 'abc123',
      title: 'TypeError: Cannot read property of undefined',
      level: 'error',
      occurrences: 10,
      usersAffected: 2,
      firstSeen: '2026-04-12T10:00:00Z',
      lastSeen: '2026-04-19T08:00:00Z',
      permalink: 'https://memovia-ai.sentry.io/issues/abc123/',
      isCritical: true,
    },
    {
      id: 'def456',
      title: 'Warning: undefined behavior in hook',
      level: 'warning',
      occurrences: 5,
      usersAffected: 1,
      firstSeen: '2026-04-15T12:00:00Z',
      lastSeen: '2026-04-18T20:00:00Z',
      permalink: 'https://memovia-ai.sentry.io/issues/def456/',
      isCritical: false,
    },
  ],
  fetchedAt: '2026-04-19T09:00:00Z',
}

describe('useSentry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateSentryCache()
  })

  it('démarre avec isLoading=true et data=null', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useSentry())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('charge les données avec succès', async () => {
    mockInvoke.mockResolvedValue({ data: mockData, error: null })
    const { result } = renderHook(() => useSentry())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
  })

  it('gère les erreurs de la fonction Edge', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('invoke failed') })
    const { result } = renderHook(() => useSentry())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('Impossible de charger les données Sentry')
  })

  it('utilise le cache si données récentes', async () => {
    mockInvoke.mockResolvedValue({ data: mockData, error: null })
    const { result: r1 } = renderHook(() => useSentry())
    await waitFor(() => expect(r1.current.isLoading).toBe(false))

    const { result: r2 } = renderHook(() => useSentry())
    await waitFor(() => expect(r2.current.isLoading).toBe(false))

    // invoke appelé une seule fois (2e hook utilise le cache)
    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(r2.current.data).toEqual(mockData)
  })

  it('refresh() invalide le cache et re-fetche', async () => {
    mockInvoke.mockResolvedValue({ data: mockData, error: null })
    const { result } = renderHook(() => useSentry())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockInvoke.mockResolvedValue({ data: { ...mockData, fetchedAt: '2026-04-19T10:00:00Z' }, error: null })
    result.current.refresh()
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(mockInvoke).toHaveBeenCalledTimes(2)
    expect(result.current.data?.fetchedAt).toBe('2026-04-19T10:00:00Z')
  })
})
