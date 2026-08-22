import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { getNavForRole } from '@/config/navigation'
import type { NavItem } from '@/config/navigation'
import { useAuth } from '@/contexts/AuthContext'

export function MobileNav() {
  const { user } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const role = user?.role ?? 'admin_bizdev'
  const items = getNavForRole(role)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Ouvrir le menu de navigation"
          className="flex items-center justify-center rounded-lg p-2 text-[var(--nav-fg)] hover:bg-[var(--nav-hover)] hover:text-white transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[280px] bg-[var(--bg-sidebar)] p-0 border-r border-[var(--border-color)]"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 px-5">
          {/* Monogramme M — même identité que le header desktop (AppLayout) */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path
              d="M2 17V4.5a1.5 1.5 0 0 1 2.56-1.06L10 8.88l5.44-5.44A1.5 1.5 0 0 1 18 4.5V17"
              stroke="#7C3AED"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="15.5" r="1.3" fill="#7C3AED" />
          </svg>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
            MEMOVIA
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Navigation mobile">
          <ul className="space-y-0.5">
            {items.map((item) => (
              <MobileNavItem
                key={item.id}
                item={item}
                isActive={location.pathname.startsWith(item.path)}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  )
}

// ── Mobile nav item ────────────────────────────────────────────────────────────
interface MobileNavItemProps {
  item: NavItem
  isActive: boolean
  onNavigate: () => void
}

function MobileNavItem({ item, isActive, onNavigate }: MobileNavItemProps) {
  const Icon = item.icon
  const isSoon = item.status === 'soon'

  const content = (
    <span
      className={cn(
        'flex h-10 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors',
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
      <Link to={item.path} onClick={onNavigate}>
        {content}
      </Link>
    </li>
  )
}
