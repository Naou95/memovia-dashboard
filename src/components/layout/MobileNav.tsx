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
      <SheetContent side="left" className="w-[280px] bg-[var(--bg-sidebar)] p-0 border-r-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        {/* Logo area */}
        <div className="flex h-16 items-center border-b border-white/10 px-6">
          <span className="text-base font-semibold tracking-tight text-white">
            MEMOVIA
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4" aria-label="Navigation mobile">
          {sections.map((section) => (
            <div key={section.id} className="mb-4">
              <div className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-white/30">
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
        'flex h-10 items-center gap-3 rounded-lg px-4 text-sm font-medium transition-colors',
        isActive && 'relative bg-[var(--memovia-violet-light)] text-[var(--memovia-violet)]',
        isActive && 'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r before:bg-[var(--memovia-violet)]',
        !isActive && !isSoon && 'text-white/70 hover:bg-white/5 hover:text-white',
        isSoon && !isActive && 'cursor-default text-white/30',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon className={cn('h-4 w-4 shrink-0', isSoon && !isActive ? 'opacity-40' : '')} />
      <span className="flex-1 truncate">{item.label}</span>
      {isSoon && (
        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/30">
          bientôt
        </span>
      )}
    </span>
  )

  if (isSoon) {
    return <li><div role="presentation">{content}</div></li>
  }

  return (
    <li>
      <Link to={item.path} onClick={onNavigate}>
        {content}
      </Link>
    </li>
  )
}
