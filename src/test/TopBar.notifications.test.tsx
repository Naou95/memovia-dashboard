/**
 * Régression FINDING notif : une notification d'un type ABSENT de NOTIF_CONFIG
 * (ex. `sentry_critical` créé par get-sentry) faisait crasher toute l'app d'un
 * clic sur la cloche (« Cannot read properties of undefined (reading 'icon') »,
 * vu en prod le 20/08/2026). Le dropdown doit rendre tout type inconnu avec le
 * repli, jamais crasher.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import type { Notification } from '@/hooks/useNotifications'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { profile: { full_name: 'Test', email: 't@memovia.io', avatar_url: null }, role: 'admin_full' },
    signOut: vi.fn(),
  }),
}))
vi.mock('@/contexts/PrivacyContext', () => ({
  usePrivacy: () => ({ isPrivate: false, togglePrivacy: vi.fn() }),
}))
vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [
      {
        id: 'n1',
        type: 'sentry_critical',
        title: 'Nouveau bug détecté',
        message: 'TypeError — 3 occurrences',
        read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'n2',
        type: 'type_jamais_vu',
        title: 'Type totalement inconnu',
        message: 'ne doit pas crasher',
        read: true,
        created_at: new Date().toISOString(),
      },
    ] as unknown as Notification[],
    unreadCount: 1,
    markAllAsRead: vi.fn(),
    markAsRead: vi.fn(),
  }),
}))

describe('TopBar notifications', () => {
  it('rend les types inconnus sans crasher (sentry_critical + type arbitraire)', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/leads']}>
        <TopBar />
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: /notifications/i }))

    expect(await screen.findByText('Nouveau bug détecté')).toBeInTheDocument()
    expect(screen.getByText('Type totalement inconnu')).toBeInTheDocument()
  })
})
