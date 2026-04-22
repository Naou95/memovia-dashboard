import type { TransactionRow } from '@/types/stripe'

interface TransactionListProps {
  transactions: TransactionRow[]
}

const formatEur = (val: number, currency: string) => {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(val)
  } catch {
    return `${val.toFixed(2)} ${currency}`
  }
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

export function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-[var(--text-muted)]">
        Aucune transaction récente.
      </div>
    )
  }

  return (
    <div className="overflow-hidden">
      <table className="w-full table-fixed text-sm" aria-label="Liste des transactions Stripe récentes">
        <colgroup>
          <col className="w-[14%]" />
          <col className="w-[32%]" />
          <col className="w-[24%]" />
          <col className="w-[14%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--border-color)]">
            <th scope="col" className="pb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Date
            </th>
            <th scope="col" className="pb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Description
            </th>
            <th scope="col" className="pb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Utilisateur
            </th>
            <th scope="col" className="pb-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Montant
            </th>
            <th scope="col" className="pb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)] pl-6">
              Statut
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, i) => (
            <tr
              key={tx.id}
              className={
                'border-b border-[var(--border-color)] transition-colors hover:bg-[var(--memovia-violet-light)]/60' +
                (i % 2 === 0 ? '' : ' bg-[var(--bg-primary)]')
              }
            >
              <td className="truncate py-3 pr-4 text-[13px] tabular-nums text-[var(--text-secondary)]">
                {formatDate(tx.date)}
              </td>
              <td className="truncate py-3 pr-4 text-[13px] text-[var(--text-primary)]">
                {tx.description}
              </td>
              <td className="truncate py-3 pr-4 font-mono text-[12px] text-[var(--text-secondary)]">
                {tx.customerEmail || <span className="text-[var(--text-muted)] italic">—</span>}
              </td>
              <td className="truncate py-3 text-right tabular-nums text-[13px] font-medium text-[var(--text-primary)]">
                {formatEur(tx.amount, tx.currency)}
              </td>
              <td className="py-3 pl-6">
                <TxStatusBadge status={tx.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TxStatusBadge({ status }: { status: TransactionRow['status'] }) {
  const styles: Record<TransactionRow['status'], { bg: string; fg: string; label: string }> = {
    succeeded: {
      bg: 'color-mix(in oklab, var(--success) 15%, white)',
      fg: 'var(--success)',
      label: 'Réussie',
    },
    failed: {
      bg: 'var(--trend-down-bg)',
      fg: 'var(--trend-down-text)',
      label: 'Échouée',
    },
    refunded: {
      bg: 'var(--accent-blue-bg)',
      fg: 'var(--accent-blue)',
      label: 'Remboursée',
    },
  }
  const s = styles[status]
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  )
}
