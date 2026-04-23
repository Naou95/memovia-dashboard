import { useMemo, useState } from 'react'
import { Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LeadStatusBadge } from './LeadStatusBadge'
import { LeadMaturityBadge } from './LeadMaturityBadge'
import { LeadScoreBadge } from './LeadScoreBadge'
import { computeLeadScore } from '@/lib/leadScoring'
import type { Lead } from '@/types/leads'
import {
  LEAD_TYPE_LABELS,
  LEAD_CANAL_LABELS,
  LEAD_ASSIGNEE_LABELS,
} from '@/types/leads'

interface LeadTableProps {
  leads: Lead[]
  isLoading: boolean
  onEdit: (lead: Lead) => void
  onDelete: (id: string) => Promise<void>
  canDelete: boolean
}

type SortDir = 'asc' | 'desc'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function SkeletonRow() {
  return (
    <tr>
      {[...Array(12)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-[var(--border-color)]" />
        </td>
      ))}
    </tr>
  )
}

export function LeadTable({ leads, isLoading, onEdit, onDelete, canDelete }: LeadTableProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const scoredLeads = useMemo(() => {
    const now = new Date()
    return leads
      .map((l) => ({ lead: l, score: computeLeadScore(l, now) }))
      .sort((a, b) => (sortDir === 'desc' ? b.score - a.score : a.score - b.score))
  }, [leads, sortDir])

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await onDelete(id)
    } finally {
      setDeletingId(null)
      setConfirmingId(null)
    }
  }

  function toggleSort() {
    setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
  }

  const HEADERS: { label: string; align?: 'right' }[] = [
    { label: 'Organisation' },
    { label: 'Contact' },
    { label: 'Type' },
    { label: 'Canal' },
    { label: 'Statut' },
    { label: 'Maturité' },
    { label: 'Score' },
    { label: 'Assigné' },
    { label: 'Prochaine action' },
    { label: 'Dernier contact' },
    { label: 'Relances' },
    { label: 'Actions', align: 'right' },
  ]

  return (
    <div className="overflow-hidden rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[var(--shadow-xs)]">
      <table className="w-full table-fixed text-sm" aria-label="Liste des leads commerciaux">
        <colgroup>
          <col className="w-[13%]" />
          <col className="w-[10%]" />
          <col className="w-[6%]" />
          <col className="w-[7%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[7%]" />
          <col className="w-[8%]" />
          <col className="w-[13%]" />
          <col className="w-[8%]" />
          <col className="w-[6%]" />
          <col className="w-[6%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--border-color)]">
            {HEADERS.map((h) => {
              const isScore = h.label === 'Score'
              const alignClass = h.align === 'right' ? 'text-right' : 'text-left'
              return (
                <th
                  key={h.label}
                  scope="col"
                  aria-sort={
                    isScore ? (sortDir === 'desc' ? 'descending' : 'ascending') : undefined
                  }
                  className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)] ${alignClass}`}
                >
                  {isScore ? (
                    <button
                      onClick={toggleSort}
                      className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--memovia-violet)] focus-visible:outline-none focus-visible:text-[var(--memovia-violet)]"
                      aria-label={`Trier par score ${sortDir === 'desc' ? 'croissant' : 'décroissant'}`}
                    >
                      {h.label}
                      {sortDir === 'desc' ? (
                        <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUp className="h-3 w-3" />
                      )}
                    </button>
                  ) : (
                    h.label
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-color)]">
          {isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : scoredLeads.length === 0 ? (
            <tr>
              <td colSpan={12} className="px-4 py-12 text-center">
                <p className="text-[15px] font-medium text-[var(--text-primary)]">
                  Aucun lead trouvé
                </p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                  Créez votre premier lead pour démarrer le pipeline.
                </p>
              </td>
            </tr>
          ) : (
            scoredLeads.map(({ lead, score }) => (
              <tr
                key={lead.id}
                className="transition-colors hover:bg-[var(--accent-purple-bg)]"
              >
                {/* Organisation */}
                <td className="truncate px-4 py-3">
                  <span className="font-medium text-[var(--text-primary)]">{lead.name}</span>
                </td>

                {/* Contact */}
                <td className="truncate px-4 py-3 text-[var(--text-secondary)]">
                  {lead.contact_name ?? '—'}
                </td>

                {/* Type */}
                <td className="truncate px-4 py-3 text-[var(--text-secondary)]">
                  {LEAD_TYPE_LABELS[lead.type]}
                </td>

                {/* Canal */}
                <td className="truncate px-4 py-3 text-[var(--text-secondary)]">
                  {LEAD_CANAL_LABELS[lead.canal]}
                </td>

                {/* Statut */}
                <td className="px-4 py-3">
                  <LeadStatusBadge status={lead.status} />
                </td>

                {/* Maturité */}
                <td className="px-4 py-3">
                  {lead.maturity ? (
                    <LeadMaturityBadge maturity={lead.maturity} />
                  ) : (
                    <span className="text-[var(--text-muted)]">—</span>
                  )}
                </td>

                {/* Score */}
                <td className="px-4 py-3">
                  <LeadScoreBadge score={score} />
                </td>

                {/* Assigné */}
                <td className="truncate px-4 py-3 text-[var(--text-secondary)]">
                  {lead.assigned_to ? LEAD_ASSIGNEE_LABELS[lead.assigned_to] : '—'}
                </td>

                {/* Prochaine action */}
                <td className="truncate px-4 py-3 text-[var(--text-secondary)]">
                  {lead.next_action ?? '—'}
                </td>

                {/* Dernier contact */}
                <td className="truncate px-4 py-3 text-[var(--text-secondary)]">
                  {formatDate(lead.last_contact_date)}
                </td>

                {/* Relances */}
                <td className="truncate px-4 py-3 text-[var(--text-secondary)]">
                  {lead.relance_count > 0 ? lead.relance_count : '—'}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(lead)}
                      className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-[var(--memovia-violet)]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">Modifier</span>
                    </Button>

                    {canDelete &&
                      (confirmingId === lead.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmingId(null)}
                            className="h-7 px-2 text-[12px] text-[var(--text-muted)]"
                          >
                            Annuler
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(lead.id)}
                            disabled={deletingId === lead.id}
                            className="h-7 px-2 text-[12px] text-[var(--danger)] hover:bg-[var(--trend-down-bg)]"
                          >
                            {deletingId === lead.id ? '...' : 'Confirmer'}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmingId(lead.id)}
                          className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-[var(--danger)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Supprimer</span>
                        </Button>
                      ))}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
