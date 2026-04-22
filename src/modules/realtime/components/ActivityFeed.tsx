import type { ActiveUser } from '@/hooks/useRealtimePresence'

interface ActivityFeedProps {
  users: ActiveUser[]
  isLoading: boolean
}

function getInitials(firstName: string, lastName: string | null, email: string): string {
  if (firstName && lastName) return (firstName[0] + lastName[0]).toUpperCase()
  if (firstName) return firstName.slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

function formatRelative(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `il y a ${diff}s`
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function formatAccountType(type: string): string {
  const map: Record<string, string> = {
    student: 'Étudiant',
    teacher: 'Formateur',
    teacher_b2c: 'Formateur',
    school_admin: 'Admin B2B',
    b2b: 'B2B',
    b2c: 'B2C',
  }
  return map[type] ?? type
}

function SkeletonRow() {
  return (
    <tr>
      {[...Array(4)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-[var(--border-color)]" />
        </td>
      ))}
    </tr>
  )
}

export function ActivityFeed({ users, isLoading }: ActivityFeedProps) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[var(--shadow-xs)]">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-3.5">
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
          Dernières connexions — 24h
        </h3>
        <span className="rounded-full bg-[var(--accent-purple-bg)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--memovia-violet)]">
          {isLoading ? '…' : users.length}
        </span>
      </div>

      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[36%]" />
          <col className="w-[16%]" />
          <col className="w-[26%]" />
          <col className="w-[22%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
            {['Utilisateur', 'Type', 'Organisation', 'Dernière connexion'].map((h) => (
              <th
                key={h}
                scope="col"
                className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-color)]">
          {isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : users.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-12 text-center">
                <p className="text-[15px] font-medium text-[var(--text-primary)]">
                  Aucune connexion dans les dernières 24h
                </p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                  Les données se rafraîchissent toutes les 30 secondes.
                </p>
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr
                key={user.id}
                className="transition-colors hover:bg-[var(--bg-hover)]"
              >
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: 'var(--accent-blue-bg)',
                        color: 'var(--accent-blue)',
                      }}
                    >
                      {getInitials(user.first_name, user.last_name, user.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--text-primary)]">
                        {user.last_name
                          ? `${user.first_name} ${user.last_name}`
                          : user.first_name}
                      </p>
                      <p className="truncate text-[12px] text-[var(--text-muted)]">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="truncate px-4 py-3 text-[var(--text-secondary)]">
                  {formatAccountType(user.account_type)}
                </td>
                <td className="truncate px-4 py-3 text-[var(--text-secondary)]">
                  {user.organization_name ?? '—'}
                </td>
                <td className="truncate px-4 py-3 tabular-nums text-[var(--text-secondary)]">
                  {user.last_sign_in_at ? formatRelative(user.last_sign_in_at) : '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
