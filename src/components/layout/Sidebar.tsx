import { Link, useLocation } from 'react-router-dom'
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
        'flex h-full w-[220px] flex-col overflow-hidden border-r border-[var(--border-color)] bg-[var(--bg-sidebar)]',
        className
      )}
      data-testid="sidebar"
    >
      {/* Logo — monogramme M custom MEMOVIA */}
      <motion.div
        className="flex h-14 shrink-0 items-center gap-2.5 px-5"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <path
            d="M2 17V4.5a1.5 1.5 0 0 1 2.56-1.06L10 8.88l5.44-5.44A1.5 1.5 0 0 1 18 4.5V17"
            stroke="#7C3AED"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="15.5" r="1.3" fill="#7C3AED" />
        </svg>
        <span className="text-[14px] font-bold tracking-tight text-[var(--text-primary)]">
          MEMOVIA
        </span>
      </motion.div>

      {/* Navigation — staggered mount + sliding active pill via LayoutGroup */}
      <LayoutGroup>
        <motion.nav
          className="min-h-0 flex-1 overflow-hidden px-3 pb-2"
          aria-label="Navigation principale"
          variants={sidebarContainer}
          initial="hidden"
          animate="show"
        >
          {sections.map((section) => (
            <div key={section.id} className="mb-2.5">
              <div className="mb-0.5 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-label)]">
                {section.label}
              </div>
              <ul className="space-y-px">
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
        className="shrink-0 border-t border-[var(--border-color)] p-2"
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
        'relative flex h-7 items-center gap-2 rounded-lg px-2.5 text-[12px] font-medium transition-transform duration-150 ease-out',
        isActive
          ? 'text-[var(--memovia-violet)]'
          : !isSoon
          ? 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:scale-[0.98]'
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
          'relative z-10 h-[15px] w-[15px] shrink-0',
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
