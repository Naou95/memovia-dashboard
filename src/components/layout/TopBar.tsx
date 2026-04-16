import { useLocation } from 'react-router-dom'
import { LogOut, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { NAV_SECTIONS } from '@/config/navigation'

/**
 * Minimal top bar per MEMOVIA plan.
 * Left: page title.
 * Right: user name + role + dropdown (logout).
 * No search, no date range, no period selector, no export.
 */
export function TopBar() {
  const { user, signOut } = useAuth()
  const location = useLocation()

  const pageTitle = getPageTitle(location.pathname)
  const initials = getInitials(user?.profile.full_name ?? '')

  return (
    <div className="flex flex-1 items-center justify-between">
      {/* Page title */}
      <h1 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
        {pageTitle}
      </h1>

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[var(--bg-primary)] transition-colors"
            aria-label="Menu utilisateur"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user?.profile.avatar_url ?? undefined}
                alt={user?.profile.full_name ?? ''}
              />
              <AvatarFallback className="bg-[var(--memovia-violet-light)] text-[var(--memovia-violet)] text-[11px] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-[13px] font-medium text-[var(--text-primary)]">
                {user?.profile.full_name ?? 'Admin'}
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                {formatRole(user?.role)}
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="font-normal">
            <div className="text-[13px] font-medium text-[var(--text-primary)]">
              {user?.profile.full_name}
            </div>
            <div className="truncate text-[11px] text-[var(--text-muted)]">
              {user?.profile.email}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={signOut}
            className="cursor-pointer text-[var(--danger)] focus:bg-[var(--danger)]/10 focus:text-[var(--danger)]"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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

function getPageTitle(pathname: string): string {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.path === pathname) return item.label
    }
  }
  return 'Dashboard'
}

function formatRole(role: string | undefined): string {
  const map: Record<string, string> = {
    admin_full: 'Admin',
    admin_bizdev: 'Bizdev',
  }
  return map[role ?? ''] ?? 'Admin'
}
