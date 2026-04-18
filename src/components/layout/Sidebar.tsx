import { Link, useLocation } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { motion, LayoutGroup } from 'framer-motion'
import { cn } from '@/lib/utils'
import { getNavForRole } from '@/config/navigation'
import type { NavItem } from '@/config/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { sidebarContainer, sidebarItem, spring } from '@/lib/motion'

interface SidebarProps {
  className?: string
}

/**
 * Light sidebar for the MEMOVIA dashboard.
 * - White background, subtle right border
 * - MEMOVIA logo at top (violet mark + wordmark)
 * - Grouped navigation with staggered mount animation
 * - Active item: sliding spring pill via framer-motion layoutId
 * - Bottom: user card (avatar + name + role)
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
      <motion.div
        className="flex h-16 items-center gap-2.5 px-5"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--memovia-violet)]">
          <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
          MEMOVIA
        </span>
      </motion.div>

      {/* Navigation — staggered mount + sliding active pill via LayoutGroup */}
      <LayoutGroup>
        <motion.nav
          className="flex-1 overflow-y-auto px-3 pb-2"
          aria-label="Navigation principale"
          variants={sidebarContainer}
          initial="hidden"
          animate="show"
        >
          {sections.map((section) => (
            <div key={section.id} className="mb-3">
              <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-label)]">
                {section.label}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <motion.li key={item.id} variants={sidebarItem}>
                    <SidebarNavItem
                      item={item}
                      isActive={location.pathname === item.path}
                    />
                  </motion.li>
                ))}
              </ul>
            </div>
          ))}
        </motion.nav>
      </LayoutGroup>

      {/* User card */}
      <motion.div
        className="border-t border-[var(--border-color)] p-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
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
      </motion.div>
    </aside>
  )
}

// ── Nav item — returns only the link/content, no <li> wrapper ─────────────────
// The parent <motion.li> in Sidebar provides the <li> element.

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
        'relative flex h-8 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium',
        isActive
          ? 'text-[var(--text-primary)]'
          : !isSoon
          ? 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
          : 'cursor-default text-[var(--text-muted)]',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      {/* Sliding active pill — springs between nav items on navigation */}
      {isActive && (
        <motion.span
          layoutId="sidebar-active-pill"
          className="absolute inset-0 rounded-lg bg-[var(--memovia-violet-light)]"
          transition={spring.slide}
        />
      )}

      <Icon
        className={cn(
          'relative z-10 h-[17px] w-[17px] shrink-0',
          isActive && 'text-[var(--memovia-violet)]',
          !isActive && !isSoon && 'text-[var(--text-muted)]',
          isSoon && !isActive && 'text-[var(--text-muted)] opacity-60'
        )}
        strokeWidth={2}
      />
      <span className="relative z-10 flex-1 truncate">{item.label}</span>
      {isSoon && (
        <span className="relative z-10 rounded-md bg-[var(--bg-primary)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Bientôt
        </span>
      )}
    </span>
  )

  if (isSoon) {
    return <div role="presentation">{content}</div>
  }

  return <Link to={item.path}>{content}</Link>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
