import type { SubscriptionRow } from '@/types/stripe'

interface SubscriptionTableProps {
  subscriptions: SubscriptionRow[]
}

const formatEur = (val: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(val)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

export function SubscriptionTable({ subscriptions }: SubscriptionTableProps) {
  if (subscriptions.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-[var(--text-muted)]">
        Aucun abonnement actif.
      </div>
    )
  }

  // Tri : annulations en cours en dernier, puis par date de début décroissante
  const sorted = [...subscriptions].sort((a, b) => {
    if (a.cancelAtPeriodEnd !== b.cancelAtPeriodEnd)
      return a.cancelAtPeriodEnd ? 1 : -1
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Liste des abonnements Stripe actifs">
        <thead>
          <tr className="border-b border-[var(--border-color)]">
            <th scope="col" className="pb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Email
            </th>
            <th scope="col" className="pb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Plan
            </th>
            <th scope="col" className="pb-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Montant / mois
            </th>
            <th scope="col" className="pb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)] pl-6">
              Depuis
            </th>
            <th scope="col" className="pb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Statut
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((sub, i) => (
            <tr
              key={sub.id}
              className={
                'border-b border-[var(--border-color)] transition-colors hover:bg-[var(--memovia-violet-light)]/60' +
                (i % 2 === 0 ? '' : ' bg-[var(--bg-primary)]')
              }
            >
              <td className="py-3 pr-4 font-mono text-[13px] text-[var(--text-primary)]">
                {sub.customerEmail || (
                  <span className="text-[var(--text-muted)] italic">—</span>
                )}
              </td>
              <td className="py-3 pr-4 text-[13px] text-[var(--text-secondary)]">
                {sub.planName}
                {sub.interval === 'year' && (
                  <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">(annuel)</span>
                )}
              </td>
              <td className="py-3 text-right tabular-nums text-[13px] font-medium text-[var(--text-primary)]">
                {formatEur(sub.amount)}
              </td>
              <td className="py-3 pl-6 text-[13px] tabular-nums text-[var(--text-secondary)]">
                {formatDate(sub.startDate)}
              </td>
              <td className="py-3">
                <StatusBadge canceling={sub.cancelAtPeriodEnd} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ canceling }: { canceling: boolean }) {
  if (canceling) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
        style={{ backgroundColor: 'var(--trend-down-bg)', color: 'var(--trend-down-text)' }}>
        Annulation en cours
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: 'color-mix(in oklab, var(--success) 15%, white)', color: 'var(--success)' }}>
      Actif
    </span>
  )
}
