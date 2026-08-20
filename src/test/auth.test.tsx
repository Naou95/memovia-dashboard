/**
 * Auth unit tests — covers E2E-1 through E2E-7 at the unit level.
 * E2E-1/2/6 (full browser flows) are in playwright tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRoleFromSession } from '@/types/auth'
import { getNavForRole } from '@/config/navigation'
import type { Session } from '@supabase/supabase-js'

// ─── getRoleFromSession ────────────────────────────────────────────────────────
describe('getRoleFromSession', () => {
  it('returns null when session is null', () => {
    expect(getRoleFromSession(null)).toBeNull()
  })

  it('returns admin_full role from JWT app_metadata', () => {
    const session = {
      user: {
        app_metadata: { role: 'admin_full' },
      },
    } as unknown as Session

    expect(getRoleFromSession(session)).toBe('admin_full')
  })

  it('returns admin_bizdev role from JWT app_metadata', () => {
    const session = {
      user: {
        app_metadata: { role: 'admin_bizdev' },
      },
    } as unknown as Session

    expect(getRoleFromSession(session)).toBe('admin_bizdev')
  })

  it('returns null when app_metadata has no role', () => {
    const session = {
      user: {
        app_metadata: {},
      },
    } as unknown as Session

    expect(getRoleFromSession(session)).toBeNull()
  })
})

// ─── getNavForRole (nav v2 : 5 entrées plates, voir REFONT_PLAN.md) ───────────
describe('getNavForRole', () => {
  it('les 5 sections v2 sont visibles pour les deux rôles', () => {
    const expected = ['leads', 'rdv', 'financements', 'argent', 'bugs']
    for (const role of ['admin_full', 'admin_bizdev'] as const) {
      const ids = getNavForRole(role).map((i) => i.id)
      expect(ids).toEqual(expected)
    }
  })

  it('les anciens modules ne sont plus dans la nav', () => {
    const ids = getNavForRole('admin_full').map((i) => i.id)
    for (const dead of ['overview', 'stripe', 'qonto', 'email', 'github', 'seo', 'copilot']) {
      expect(ids).not.toContain(dead)
    }
  })

  it('financements est "soon" tant que la Phase 3 n\'est pas livrée', () => {
    const financements = getNavForRole('admin_full').find((i) => i.id === 'financements')
    expect(financements?.status).toBe('soon')
    const actives = getNavForRole('admin_full').filter((i) => i.status === 'active')
    expect(actives.map((i) => i.id)).toEqual(['leads', 'rdv', 'argent', 'bugs'])
  })
})

// Suppress console warnings during tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
