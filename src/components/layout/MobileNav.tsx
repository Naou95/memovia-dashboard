import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, Sparkles } from 'lucide-react'
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
  const sections = getNavForRole(role)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Ouvrir le menu de navigation"
          className="flex items-center justify-center rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] transition-colors"
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
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--memovia-violet)]">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
            MEMOVIA
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Navigation mobile">
          {sections.map((section) => (
            <div key={section.id} className="mb-5">
              <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-label)]">
                {section.label}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <MobileNavItem
                    key={item.id}
                    item={item}
                    isActive={location.pathname === item.path}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </ul>
            </div>
          ))}
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
