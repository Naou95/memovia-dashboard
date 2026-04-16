import { Link, useLocation } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getNavForRole } from '@/config/navigation'
import type { NavItem } from '@/config/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface SidebarProps {
  className?: string
}

/**
 * Light sidebar for the MEMOVIA dashboard.
 * - White background, subtle right border
 * - MEMOVIA logo at top (violet mark + wordmark)
 * - Grouped navigation (PRINCIPAL / FINANCE / OPÉRATIONS / PLATEFORME / GROWTH & IA)
 * - Active item: light lavender pill + violet icon
 * - Bottom: user card (avatar + name + role) — no utility items, no upgrade CTA
 */
export function Sidebar({ className }: SidebarProps) {
  const { user } = useAuth()
  const location = useLocation()

  const role = user?.role ?? 'admin_bizdev'
  const sections = getNavForRole(role)
  const initials = getInitials(user?.profile.full_name ?? '')

  return (
    <aside
      className={cn(
        'flex w-[240px] flex-col border-r border-[var(--border-color)] bg-[var(--bg-sidebar)]',
        className
      )}
      data-testid="sidebar"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--memovia-violet)]">
          <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
          MEMOVIA
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Navigation principale">
        {sections.map((section) => (
          <div key={section.id} className="mb-5">
            <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-label)]">
              {section.label}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarNavItem
                  key={item.id}
                  item={item}
                  isActive={location.pathname === item.path}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User card (minimal — avatar + name + role only) */}
      <div className="border-t border-[var(--border-color)] p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={user?.profile.avatar_url ?? undefined}
              alt={user?.profile.full_name ?? ''}
            />
            <AvatarFallback className="bg-[var(--memovia-violet-light)] text-[var(--memovia-violet)] text-[11px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">
              {user?.profile.full_name ?? user?.profile.email ?? ''}
            </div>
            <div className="truncate text-[11px] text-[var(--text-muted)]">
              {formatRole(role)}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Nav item ───────────────────────────────────────────────────────────────────
interface SidebarNavItemProps {
  item: NavItem
  isActive: boolean
}

function SidebarNavItem({ item, isActive }: SidebarNavItemProps) {
  const Icon = item.icon
  const isSoon = item.status === 'soon'

  const content = (
    <span
      className={cn(
        'flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors',
        isActive && 'bg-[var(--memovia-violet-light)] text-[var(--text-primary)]',
        !isActive && !isSoon && 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]',
        isSoon && !isActive && 'cursor-default text-[var(--text-muted)]',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon
        className={cn(
          'h-[17px] w-[17px] shrink-0',
          isActive && 'text-[var(--memovia-violet)]',
          !isActive && !isSoon && 'text-[var(--text-muted)]',
          isSoon && !isActive && 'text-[var(--text-muted)] opacity-60'
        )}
        strokeWidth={2}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {isSoon && (
        <span className="rounded-md bg-[var(--bg-primary)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Bientôt
        </span>
      )}
    </span>
  )

  if (isSoon) {
    return (
      <li>
        <div role="presentation">{content}</div>
      </li>
    )
  }

  return (
    <li>
      <Link to={item.path}>{content}</Link>
    </li>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || 'NA'
}

function formatRole(role: string): string {
  const map: Record<string, string> = {
    admin_full: 'Admin',
    admin_bizdev: 'Bizdev',
  }
  return map[role] ?? 'Admin'
}
