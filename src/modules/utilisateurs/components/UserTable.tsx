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
    <div className="overflow-hidden rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[var(--shadow-xs)]">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[22%]" />
          <col className="w-[12%]" />
          <col className="w-[18%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
            {['Utilisateur', 'Organisation', 'Plan', 'Date inscription', 'Dernière connexion'].map(
              (h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]"
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
                className="transition-colors hover:bg-[var(--bg-hover)]"
              >
                {/* Utilisateur */}
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
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
                <td className="truncate px-4 py-3 text-[var(--text-secondary)]">
                  {user.organization_name ?? '—'}
                </td>

                {/* Plan */}
                <td className="px-4 py-3">
                  <UserPlanBadge plan={user.plan} />
                </td>

                {/* Date inscription */}
                <td className="truncate px-4 py-3 tabular-nums text-[var(--text-secondary)]">
                  {formatDate(user.created_at)}
                </td>

                {/* Dernière connexion */}
                <td className="truncate px-4 py-3 tabular-nums text-[var(--text-secondary)]">
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
