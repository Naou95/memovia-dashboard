import { ArrowDownLeft, ArrowUpRight, RotateCcw } from 'lucide-react'
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
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

// Icône ronde teintée + libellés — langue de la maquette « Last Transaction »
const STATUS_STYLE = {
  succeeded: { icon: ArrowDownLeft, bg: 'rgba(21,128,61,0.12)', fg: '#15803D', label: 'Réussie' },
  failed: { icon: ArrowUpRight, bg: 'var(--danger-bg)', fg: 'var(--danger)', label: 'Échouée' },
  refunded: { icon: RotateCcw, bg: 'var(--accent-blue-bg)', fg: 'var(--accent-blue)', label: 'Remboursée' },
} as const

/**
 * Paiements Stripe en liste (22/08/2026, maquette Naoufel « argent ») :
 * icône ronde par statut, libellé + email, montant et date à droite.
 * Une liste à deux lignes bat la table 5 colonnes pour un flux de paiements.
 */
export function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-[var(--text-muted)]">
        Aucune transaction récente.
      </div>
    )
  }

  return (
    <ul aria-label="Paiements Stripe récents">
      {transactions.map((tx) => {
        const s = STATUS_STYLE[tx.status]
        const Icon = s.icon
        return (
          <li
            key={tx.id}
            className="flex items-center gap-3 border-b border-[var(--border-subtle)] py-2.5 transition-colors last:border-0 hover:bg-[var(--bg-hover)]"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: s.bg, color: s.fg }}
              title={s.label}
              aria-label={s.label}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">
                {tx.description}
              </span>
              <span className="block truncate text-[12px] text-[var(--text-secondary)]">
                {tx.customerEmail || '—'}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block tabular-nums text-[13px] font-semibold text-[var(--text-primary)]">
                {formatEur(tx.amount, tx.currency)}
              </span>
              <span className="block tabular-nums text-[11px] text-[var(--text-secondary)]">
                {formatDate(tx.date)}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
