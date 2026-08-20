import { Link, useLocation } from 'react-router-dom'
import { motion, LayoutGroup } from 'framer-motion'
import { cn } from '@/lib/utils'
import { getNavForRole } from '@/config/navigation'
import type { NavItem } from '@/config/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { spring } from '@/lib/motion'

/**
 * Horizontal navigation for the v2 top-bar (replaces the sidebar).
 * Active item: sliding spring pill via framer-motion layoutId.
 */
export function TopNav({ className }: { className?: string }) {
  const { user } = useAuth()
  const location = useLocation()

  const role = user?.role ?? 'admin_bizdev'
  const items = getNavForRole(role)
  const activeSection = '/' + (location.pathname.split('/')[1] ?? '')

  return (
    <LayoutGroup>
      <nav className={cn('flex items-center gap-1', className)} aria-label="Navigation principale">
        {items.map((item) => (
          <TopNavItem key={item.id} item={item} isActive={item.path === activeSection} />
        ))}
      </nav>
    </LayoutGroup>
  )
}

function TopNavItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon
  const isSoon = item.status === 'soon'

  const content = (
    <span
      className={cn(
        'relative flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-transform duration-150 ease-out',
        isActive
          ? 'text-[var(--memovia-violet)]'
          : !isSoon
          ? 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:scale-[0.98]'
          : 'cursor-default text-[var(--text-muted)]'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      {isActive && (
        <motion.span
          layoutId="topnav-active-pill"
          className="absolute inset-0 rounded-lg bg-[var(--memovia-violet-light)]"
          transition={spring.slide}
        />
      )}
      <Icon
        className={cn(
          'relative z-10 h-[15px] w-[15px] shrink-0',
          isActive ? 'text-[var(--memovia-violet)]' : 'text-[var(--text-muted)]',
          isSoon && 'opacity-60'
        )}
        strokeWidth={2}
      />
      <span className="relative z-10">{item.label}</span>
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
