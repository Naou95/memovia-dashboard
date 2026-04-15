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

// ─── getNavForRole ─────────────────────────────────────────────────────────────
describe('getNavForRole', () => {
  it('admin_full sees admin section items', () => {
    const sections = getNavForRole('admin_full')
    const allItems = sections.flatMap((s) => s.items)
    const adminItems = allItems.filter((i) => i.id.startsWith('admin'))
    expect(adminItems.length).toBeGreaterThan(0)
  })

  it('admin_bizdev does NOT see admin section items', () => {
    const sections = getNavForRole('admin_bizdev')
    const allItems = sections.flatMap((s) => s.items)
    const adminItems = allItems.filter((i) => i.allowedRoles.includes('admin_full') && !i.allowedRoles.includes('admin_bizdev'))
    expect(adminItems).toHaveLength(0)
  })

  it('admin_full sees overview', () => {
    const sections = getNavForRole('admin_full')
    const allItems = sections.flatMap((s) => s.items)
    const overview = allItems.find((i) => i.id === 'overview')
    expect(overview).toBeDefined()
  })

  it('admin_bizdev sees overview', () => {
    const sections = getNavForRole('admin_bizdev')
    const allItems = sections.flatMap((s) => s.items)
    const overview = allItems.find((i) => i.id === 'overview')
    expect(overview).toBeDefined()
  })

  it('sections with no visible items are filtered out', () => {
    // All returned sections must have at least one item
    const sections = getNavForRole('admin_bizdev')
    sections.forEach((section) => {
      expect(section.items.length).toBeGreaterThan(0)
    })
  })
})

// ─── "soon" items ─────────────────────────────────────────────────────────────
describe('Nav item status', () => {
  it('overview is the only active item', () => {
    const sections = getNavForRole('admin_full')
    const activeItems = sections.flatMap((s) => s.items).filter((i) => i.status === 'active')
    expect(activeItems).toHaveLength(1)
    expect(activeItems[0].id).toBe('overview')
  })

  it('all other items are "soon"', () => {
    const sections = getNavForRole('admin_full')
    const nonActiveItems = sections.flatMap((s) => s.items).filter((i) => i.id !== 'overview')
    nonActiveItems.forEach((item) => {
      expect(item.status).toBe('soon')
    })
  })
})

// Suppress console warnings during tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
