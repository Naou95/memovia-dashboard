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

export function TopBar() {
  const { user, signOut } = useAuth()
  const location = useLocation()

  const pageTitle = getPageTitle(location.pathname)
  const initials = getInitials(user?.profile.full_name ?? '')

  return (
    <>
      {/* Breadcrumb / page title */}
      <div>
        <h1 className="text-sm font-semibold text-[var(--text-primary)]">
          {pageTitle}
        </h1>
      </div>

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--bg-primary)] transition-colors"
            aria-label="Menu utilisateur"
          >
            <Avatar className="h-7 w-7">
              <AvatarImage
                src={user?.profile.avatar_url ?? undefined}
                alt={user?.profile.full_name ?? ''}
              />
              <AvatarFallback className="bg-[var(--memovia-violet-light)] text-[var(--memovia-violet)] text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:block font-medium text-[var(--text-primary)]">
              {user?.profile.full_name ?? user?.profile.email ?? ''}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <div className="text-sm font-medium text-[var(--text-primary)]">
              {user?.profile.full_name}
            </div>
            <div className="text-xs text-[var(--text-muted)] truncate">
              {user?.profile.email}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={signOut}
            className="cursor-pointer text-[var(--danger)] focus:text-[var(--danger)] focus:bg-[var(--danger)]/10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function getPageTitle(pathname: string): string {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.path === pathname) return item.label
    }
  }
  return 'Dashboard'
}
