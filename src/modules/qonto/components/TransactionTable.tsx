import { useMemo, useState } from 'react'
import type { QontoTransaction } from '@/types/qonto'

interface TransactionTableProps {
  transactions: QontoTransaction[]
}

type PeriodFilter = 'all' | '7d' | '30d' | '90d'

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'all', label: 'Toutes les périodes' },
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
  { value: '90d', label: '90 derniers jours' },
]

const PERIOD_DAYS: Record<PeriodFilter, number | null> = {
  all: null,
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

const formatEur = (val: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(val)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

/** Humanise un slug Qonto en label lisible. Ex: 'software_subscriptions' → 'Software subscriptions' */
function formatCategory(raw: string | null): string {
  if (!raw) return 'Autre'
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function TransactionTable({ transactions }: TransactionTableProps) {
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [category, setCategory] = useState<string>('all')

  // Catégories uniques extraites des données
  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const tx of transactions) {
      set.add(tx.category ?? 'Autre')
    }
    return Array.from(set).sort()
  }, [transactions])

  // Transactions filtrées
  const filtered = useMemo(() => {
    const days = PERIOD_DAYS[period]
    const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null

    return transactions.filter((tx) => {
      if (cutoff && new Date(tx.settledAt).getTime() < cutoff) return false
      if (category !== 'all' && (tx.category ?? 'Autre') !== category) return false
      return true
    })
  }, [transactions, period, category])

  return (
    <div>
      {/* Filtres */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[13px] text-[var(--text-primary)] outline-none transition-colors hover:border-[var(--border-strong)] focus:border-[var(--memovia-violet)]"
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[13px] text-[var(--text-primary)] outline-none transition-colors hover:border-[var(--border-strong)] focus:border-[var(--memovia-violet)]"
        >
          <option value="all">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{formatCategory(c)}</option>
          ))}
        </select>

        <span className="ml-auto text-[13px] text-[var(--text-muted)]">
          {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-sm text-[var(--text-muted)]">
          Aucune transaction pour ces filtres.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="pb-3 pr-4 text-left text-[12px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Date
                </th>
                <th className="pb-3 pr-4 text-left text-[12px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Libellé
                </th>
                <th className="hidden pb-3 pr-4 text-left text-[12px] font-medium uppercase tracking-wide text-[var(--text-muted)] sm:table-cell">
                  Catégorie
                </th>
                <th className="pb-3 text-right text-[12px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx, i) => (
                <tr
                  key={tx.id}
                  className={
                    'border-b border-[var(--border-color)] transition-colors hover:bg-[var(--accent-purple-bg)]' +
                    (i % 2 === 0 ? '' : ' bg-[#FAFAFA]')
                  }
                >
                  <td className="whitespace-nowrap py-3 pr-4 text-[13px] text-[var(--text-secondary)]">
                    {formatDate(tx.settledAt)}
                  </td>
                  <td className="max-w-[220px] truncate py-3 pr-4 text-[13px] text-[var(--text-primary)]">
                    {tx.label}
                  </td>
                  <td className="hidden py-3 pr-4 sm:table-cell">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: 'var(--accent-purple-bg)',
                        color: 'var(--accent-purple)',
                      }}
                    >
                      {formatCategory(tx.category)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-3 text-right text-[13px] font-medium tabular-nums"
                    style={{
                      color: tx.side === 'credit' ? 'var(--success)' : 'var(--trend-down-text)',
                    }}
                  >
                    {tx.side === 'credit' ? '+' : '−'}{formatEur(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
