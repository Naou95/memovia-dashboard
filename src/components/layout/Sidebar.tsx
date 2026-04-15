import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getNavForRole } from '@/config/navigation'
import type { NavItem } from '@/config/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const { user } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const role = user?.role ?? 'admin_bizdev'
  const sections = getNavForRole(role)

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-[var(--bg-sidebar)] transition-all duration-200',
        collapsed ? 'w-[60px]' : 'w-[220px]',
        className
      )}
      data-testid="sidebar"
    >
      {/* Logo area */}
      <div className={cn(
        'flex h-16 items-center border-b border-white/10 px-4',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <span className="text-base font-semibold tracking-tight text-white">
            MEMOVIA
          </span>
        )}
        {collapsed && (
          <span className="text-sm font-bold text-[var(--memovia-violet)]">M</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4" aria-label="Navigation principale">
        {sections.map((section) => (
          <div key={section.id} className="mb-4">
            {!collapsed && (
              <div className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                {section.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarNavItem
                  key={item.id}
                  item={item}
                  isActive={location.pathname === item.path}
                  collapsed={collapsed}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'absolute -right-3 top-[72px] flex h-6 w-6 items-center justify-center',
          'rounded-full border border-white/20 bg-[var(--bg-sidebar)] text-white/60',
          'hover:border-white/40 hover:text-white transition-colors z-10'
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  )
}

// ── Nav item ───────────────────────────────────────────────────────────────────
interface SidebarNavItemProps {
  item: NavItem
  isActive: boolean
  collapsed: boolean
}

function SidebarNavItem({ item, isActive, collapsed }: SidebarNavItemProps) {
  const Icon = item.icon
  const isSoon = item.status === 'soon'

  const content = (
    <span
      className={cn(
        'group flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
        // Active state: violet bg + 3px left border + violet text
        isActive && 'relative bg-[var(--memovia-violet-light)] text-[var(--memovia-violet)]',
        isActive && 'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r before:bg-[var(--memovia-violet)]',
        // Default state
        !isActive && !isSoon && 'text-white/70 hover:bg-white/5 hover:text-white',
        // Soon state
        isSoon && !isActive && 'cursor-default text-white/30',
        // Collapsed: center the icon
        collapsed && 'justify-center px-0'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          isActive ? 'text-[var(--memovia-violet)]' : '',
          isSoon && !isActive ? 'opacity-40' : ''
        )}
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {isSoon && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/30">
              bientôt
            </span>
          )}
        </>
      )}
    </span>
  )

  // "Soon" items are not clickable
  if (isSoon) {
    return (
      <li>
        <div
          role="presentation"
          title={collapsed ? item.label : undefined}
        >
          {content}
        </div>
      </li>
    )
  }

  return (
    <li>
      <Link
        to={item.path}
        title={collapsed ? item.label : undefined}
      >
        {content}
      </Link>
    </li>
  )
}
