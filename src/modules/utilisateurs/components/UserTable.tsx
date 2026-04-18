import { UserPlanBadge } from './UserPlanBadge'
import type { MemoviaUser } from '@/types/users'

interface UserTableProps {
  users: MemoviaUser[]
  isLoading: boolean
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getInitials(firstName: string, lastName: string | null, email: string): string {
  if (firstName && lastName) return (firstName[0] + lastName[0]).toUpperCase()
  if (firstName) return firstName.slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

function SkeletonRow() {
  return (
    <tr>
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-[var(--border-color)]" />
        </td>
      ))}
    </tr>
  )
}

export function UserTable({ users, isLoading }: UserTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-color)]">
            {['Utilisateur', 'Organisation', 'Plan', 'Date inscription', 'Dernière connexion'].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-[var(--text-label)]"
                >
                  {h}
                </th>
              )
            )}
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
              <td colSpan={5} className="px-4 py-12 text-center">
                <p className="text-[15px] font-medium text-[var(--text-primary)]">
                  Aucun utilisateur trouvé
                </p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                  Essayez d'autres filtres.
                </p>
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr
                key={user.id}
                className="transition-colors hover:bg-[var(--accent-purple-bg)]"
              >
                {/* Utilisateur */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* Avatar initial */}
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: 'var(--accent-purple-bg)',
                        color: 'var(--memovia-violet)',
                      }}
                    >
                      {getInitials(user.first_name, user.last_name, user.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--text-primary)]">
                        {user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name}
                      </p>
                      <p className="truncate text-[12px] text-[var(--text-muted)]">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Organisation */}
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {user.organization_name ?? '—'}
                </td>

                {/* Plan */}
                <td className="px-4 py-3">
                  <UserPlanBadge plan={user.plan} />
                </td>

                {/* Date inscription */}
                <td className="px-4 py-3 tabular-nums text-[var(--text-secondary)]">
                  {formatDate(user.created_at)}
                </td>

                {/* Dernière connexion */}
                <td className="px-4 py-3 tabular-nums text-[var(--text-secondary)]">
                  {formatDate(user.last_sign_in_at)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
