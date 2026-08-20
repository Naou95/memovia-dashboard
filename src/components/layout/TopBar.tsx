import { Link, useLocation } from 'react-router-dom'
import { LogOut, ChevronDown, Eye, EyeOff, Bell, CheckCheck, AlertCircle, Mail, UserPlus, XCircle, Settings, Users as UsersIcon, Bug } from 'lucide-react'
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
import { NAV_ITEMS } from '@/config/navigation'

export function TopBar() {
  const { user, signOut } = useAuth()
  const { isPrivate, togglePrivacy } = usePrivacy()
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications()
  const location = useLocation()

  const pageTitle = getPageTitle(location.pathname)
  const initials = getInitials(user?.profile.full_name ?? '')

  return (
    <div className="flex flex-1 items-center justify-between">
      {/* Page title — mobile only ; <p> et pas <h1> : chaque page a déjà son h1,
          deux h1 par document cassent la hiérarchie d'accessibilité */}
      <p className="text-[17px] font-semibold tracking-tight text-white md:hidden">
        {pageTitle}
      </p>
      <span className="hidden md:block" aria-hidden />{/* spacer : garde les actions à droite */}

      <div className="flex items-center gap-1">
        {/* Privacy toggle */}
        <button
          type="button"
          onClick={togglePrivacy}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--nav-fg)] transition-colors hover:bg-[var(--nav-hover)] hover:text-white md:h-8 md:w-8"
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
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[var(--nav-fg)] transition-colors hover:bg-[var(--nav-hover)] hover:text-white md:h-8 md:w-8"
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

          <DropdownMenuContent
            align="end"
            className="w-[360px] p-0 rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.04)]"
            sideOffset={8}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-[var(--memovia-violet-light)] px-1.5 py-px text-[10px] font-bold text-[var(--memovia-violet)]">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--memovia-violet)]"
                >
                  <CheckCheck className="h-3 w-3" />
                  Tout marquer lu
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-primary)]">
                    <Bell className="h-5 w-5 text-[var(--text-muted)]" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">
                      Aucune notification
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      Tout est à jour — rien à traiter pour le moment.
                    </p>
                  </div>
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
              className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[var(--nav-hover)] transition-colors ml-1"
              aria-label="Menu utilisateur"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={user?.profile.avatar_url ?? undefined}
                  alt={user?.profile.full_name ?? ''}
                />
                <AvatarFallback className="bg-[var(--memovia-violet)] text-white text-[11px] font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-[13px] font-medium text-white">
                  {user?.profile.full_name ?? 'Admin'}
                </div>
                <div className="text-[11px] text-[var(--nav-fg)]">
                  {formatRole(user?.role)}
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--nav-fg)]" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="z-50 w-64 rounded-[var(--radius-card)] border border-[#E5E7EB] bg-white p-0 shadow-md"
            sideOffset={8}
          >
            {/* Header : avatar + nom + email + badge rôle */}
            <DropdownMenuLabel className="font-normal px-3 py-3">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage
                    src={user?.profile.avatar_url ?? undefined}
                    alt={user?.profile.full_name ?? ''}
                  />
                  <AvatarFallback className="bg-[var(--memovia-violet-light)] text-[var(--memovia-violet)] text-[12px] font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                      {user?.profile.full_name ?? 'Admin'}
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--memovia-violet-light)] px-1.5 py-px text-[10px] font-semibold text-[var(--memovia-violet)]">
                      {formatRole(user?.role)}
                    </span>
                  </div>
                  <div className="truncate text-[11px] text-[var(--text-muted)]">
                    {user?.profile.email}
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Liens */}
            <DropdownMenuItem asChild className="cursor-pointer px-3 py-2 text-[13px]">
              <Link to="/admin">
                <Settings className="mr-2 h-4 w-4 text-[var(--text-muted)]" />
                Paramètres
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer px-3 py-2 text-[13px]">
              <Link to="/admin">
                <UsersIcon className="mr-2 h-4 w-4 text-[var(--text-muted)]" />
                Gestion admins
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            {/* Déconnexion */}
            <DropdownMenuItem
              onClick={signOut}
              className="cursor-pointer px-3 py-2 text-[13px] text-[var(--danger)] focus:bg-[var(--danger-bg)] focus:text-[var(--danger)]"
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
  string,
  { icon: React.ElementType; iconColor: string; iconBg: string }
> = {
  lead_stale:      { icon: AlertCircle, iconColor: '#F59E0B', iconBg: 'rgba(245,158,11,0.12)' },
  email_critical:  { icon: Mail,        iconColor: '#EF4444', iconBg: 'rgba(239,68,68,0.12)' },
  new_lead:        { icon: UserPlus,    iconColor: '#10B981', iconBg: 'rgba(16,185,129,0.12)' },
  stripe_cancel:   { icon: XCircle,     iconColor: '#EF4444', iconBg: 'rgba(239,68,68,0.12)' },
  sentry_critical: { icon: Bug,         iconColor: '#EF4444', iconBg: 'rgba(239,68,68,0.12)' },
}

// Tout type absent du dictionnaire tombe ici. Sans ce repli, une notification
// d'un type inconnu (ex. `sentry_critical` créé par get-sentry, jamais ajouté
// ici) faisait crasher TOUTE l'app d'un clic sur la cloche — vu en prod le
// 20/08/2026. La colonne `type` est du texte libre côté base : ce dictionnaire
// ne peut jamais être supposé exhaustif.
const NOTIF_FALLBACK = { icon: Bell, iconColor: 'var(--text-muted)', iconBg: 'var(--bg-primary)' }

function NotificationItem({
  notification: n,
  onRead,
}: {
  notification: Notification
  onRead: (id: string) => void
}) {
  const cfg = NOTIF_CONFIG[n.type] ?? NOTIF_FALLBACK
  const Icon = cfg.icon

  return (
    <button
      type="button"
      onClick={() => !n.read && onRead(n.id)}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--bg-hover)] ${
        !n.read ? 'bg-[var(--bg-hover)]/50' : ''
      }`}
    >
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: cfg.iconBg }}
      >
        <Icon className="h-4 w-4" style={{ color: cfg.iconColor }} strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[13px] leading-snug ${n.read ? 'font-normal text-[var(--text-secondary)]' : 'font-semibold text-[var(--text-primary)]'}`}>
            {n.title}
          </p>
          {!n.read && (
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent-blue)]"
              aria-label="Non lu"
            />
          )}
        </div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
          {n.message}
        </p>
        <p className="mt-1 text-[11px] tabular-nums text-[var(--text-muted)]">
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
  const section = '/' + (pathname.split('/')[1] ?? '')
  const item = NAV_ITEMS.find((i) => i.path === section)
  return item?.label ?? 'Dashboard'
}

function formatRole(role: string | undefined): string {
  const map: Record<string, string> = {
    admin_full: 'Admin',
    admin_bizdev: 'Bizdev',
  }
  return map[role ?? ''] ?? 'Admin'
}
