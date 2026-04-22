import { useLocation } from 'react-router-dom'
import { LogOut, ChevronDown, Eye, EyeOff, Bell, CheckCheck, AlertCircle, Mail, UserPlus, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
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
import { usePrivacy } from '@/contexts/PrivacyContext'
import { useNotifications, type Notification } from '@/hooks/useNotifications'
import { NAV_SECTIONS } from '@/config/navigation'

export function TopBar() {
  const { user, signOut } = useAuth()
  const { isPrivate, togglePrivacy } = usePrivacy()
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications()
  const location = useLocation()

  const pageTitle = getPageTitle(location.pathname)
  const initials = getInitials(user?.profile.full_name ?? '')

  return (
    <div className="flex flex-1 items-center justify-between">
      {/* Page title */}
      <h1 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
        {pageTitle}
      </h1>

      <div className="flex items-center gap-1">
        {/* Privacy toggle */}
        <button
          type="button"
          onClick={togglePrivacy}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)]"
          aria-label={isPrivate ? 'Afficher les chiffres' : 'Masquer les chiffres'}
          title={isPrivate ? 'Afficher les chiffres sensibles' : 'Masquer les chiffres sensibles'}
        >
          {isPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>

        {/* Notification bell */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)]"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--danger)] text-[10px] font-bold leading-none text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 rounded-full bg-[var(--danger)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-[11px] text-[var(--memovia-violet)] hover:underline"
                >
                  <CheckCheck className="h-3 w-3" />
                  Tout marquer lu
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Bell className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
                  <p className="text-[13px] text-[var(--text-muted)]">Aucune notification</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <NotificationItem
                    key={notif.id}
                    notification={notif}
                    onRead={markAsRead}
                  />
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[var(--border-subtle)] transition-colors ml-1"
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
    </div>
  )
}

// ── Notification item ──────────────────────────────────────────────────────────

const NOTIF_CONFIG: Record<
  Notification['type'],
  { icon: React.ElementType; iconColor: string; iconBg: string }
> = {
  lead_stale:     { icon: AlertCircle, iconColor: '#F59E0B', iconBg: 'rgba(245,158,11,0.12)' },
  email_critical: { icon: Mail,        iconColor: '#EF4444', iconBg: 'rgba(239,68,68,0.12)' },
  new_lead:       { icon: UserPlus,    iconColor: '#10B981', iconBg: 'rgba(16,185,129,0.12)' },
  stripe_cancel:  { icon: XCircle,     iconColor: '#EF4444', iconBg: 'rgba(239,68,68,0.12)' },
}

function NotificationItem({
  notification: n,
  onRead,
}: {
  notification: Notification
  onRead: (id: string) => void
}) {
  const cfg = NOTIF_CONFIG[n.type]
  const Icon = cfg.icon

  return (
    <button
      type="button"
      onClick={() => !n.read && onRead(n.id)}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-primary)] border-b border-[var(--border-color)] last:border-0 ${
        !n.read ? 'bg-[var(--memovia-violet-light)]/30' : ''
      }`}
    >
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: cfg.iconBg }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: cfg.iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[12px] leading-snug ${n.read ? 'font-normal text-[var(--text-secondary)]' : 'font-semibold text-[var(--text-primary)]'}`}>
            {n.title}
          </p>
          {!n.read && (
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--memovia-violet)]" />
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)] leading-relaxed">
          {n.message}
        </p>
        <p className="mt-1 text-[10px] text-[var(--text-muted)]">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
        </p>
      </div>
    </button>
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
