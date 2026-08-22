import { useMemo, useState } from 'react'
import { Pencil, Trash2, ArrowUp, ArrowDown, Phone, ArchiveRestore, Plus, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LeadStatusBadge } from './LeadStatusBadge'
import { LeadMaturityBadge } from './LeadMaturityBadge'
import { LeadScoreBadge } from './LeadScoreBadge'
import { computeLeadScore } from '@/lib/leadScoring'
import type { Lead } from '@/types/leads'

interface LeadTableProps {
  leads: Lead[]
  isLoading: boolean
  onEdit: (lead: Lead) => void
  onDelete: (id: string) => Promise<void>
  canDelete: boolean
  onLogCall: (lead: Lead) => void
  onUnarchive: (lead: Lead) => void
  onCreate: () => void
  onShowPitch: (lead: Lead) => void
}

type SortMode = 'action' | 'score-desc' | 'score-asc'

const DAY_MS = 86_400_000

function daysFromToday(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / DAY_MS)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** « il y a 12 j » — l'ancienneté se lit, elle ne se calcule pas de tête */
function agoLabel(dateStr: string | null): string {
  const d = daysFromToday(dateStr)
  if (d === null) return '—'
  if (d === 0) return "aujourd'hui"
  if (d >= -60) return `il y a ${-d} j`
  return formatDate(dateStr)
}

function SkeletonRow() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-[var(--border-color)]" />
        </td>
      ))}
    </tr>
  )
}

/**
 * Table leads (refonte conseil design 22/08) : 6 colonnes au lieu de 11 —
 * « Prochaine action » est la colonne reine (pattern Pipedrive activity-based :
 * un lead sans prochaine action ou en retard est visuellement flaggé), tri par
 * urgence de relance par défaut. Type/Canal/Assigné/Relances vivent dans la
 * fiche (crayon) — ils ne servent jamais à scanner.
 */
export function LeadTable({ leads, isLoading, onEdit, onDelete, canDelete, onLogCall, onUnarchive, onCreate, onShowPitch }: LeadTableProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('action')

  const scoredLeads = useMemo(() => {
    const now = new Date()
    const scored = leads.map((l) => ({ lead: l, score: computeLeadScore(l, now) }))
    if (sortMode === 'score-desc') return scored.sort((a, b) => b.score - a.score)
    if (sortMode === 'score-asc') return scored.sort((a, b) => a.score - b.score)
    // 'action' : relances datées par urgence (retards en tête), sans date ensuite (score desc)
    return scored.sort((a, b) => {
      const fa = a.lead.follow_up_date
      const fb = b.lead.follow_up_date
      if (fa && fb) return fa.localeCompare(fb)
      if (fa) return -1
      if (fb) return 1
      return b.score - a.score
    })
  }, [leads, sortMode])

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await onDelete(id)
    } finally {
      setDeletingId(null)
      setConfirmingId(null)
    }
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[var(--shadow-xs)]">
      <table className="w-full table-fixed text-sm" aria-label="Liste des leads commerciaux">
        <colgroup>
          <col className="w-[20%]" />
          <col className="w-[12%]" />
          <col className="w-[29%]" />
          <col className="w-[13%]" />
          <col className="w-[11%]" />
          <col className="w-[15%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--border-color)]">
            <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Organisation
            </th>
            <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Statut
            </th>
            <th
              scope="col"
              aria-sort={sortMode === 'action' ? 'ascending' : undefined}
              className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]"
            >
              <button
                onClick={() => setSortMode('action')}
                className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--memovia-violet)] focus-visible:text-[var(--memovia-violet)] focus-visible:outline-none ${
                  sortMode === 'action' ? 'text-[var(--memovia-violet)]' : ''
                }`}
                aria-label="Trier par urgence de relance"
              >
                Prochaine action
                {sortMode === 'action' && <ArrowUp className="h-3 w-3" />}
              </button>
            </th>
            <th
              scope="col"
              aria-sort={sortMode === 'score-desc' ? 'descending' : sortMode === 'score-asc' ? 'ascending' : undefined}
              className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]"
            >
              <button
                onClick={() => setSortMode((m) => (m === 'score-desc' ? 'score-asc' : 'score-desc'))}
                className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--memovia-violet)] focus-visible:text-[var(--memovia-violet)] focus-visible:outline-none ${
                  sortMode.startsWith('score') ? 'text-[var(--memovia-violet)]' : ''
                }`}
                aria-label="Trier par score"
              >
                Maturité · Score
                {sortMode === 'score-desc' && <ArrowDown className="h-3 w-3" />}
                {sortMode === 'score-asc' && <ArrowUp className="h-3 w-3" />}
              </button>
            </th>
            <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Dernier contact
            </th>
            <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Actions
            </th>
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
              <td colSpan={6} className="px-4 py-12 text-center">
                <p className="text-[15px] font-medium text-[var(--text-primary)]">Aucun lead trouvé</p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">La liste CFA France se construit ici.</p>
                <Button onClick={onCreate} className="mt-4 gap-1.5">
                  <Plus className="h-4 w-4" />
                  Créer le premier lead
                </Button>
              </td>
            </tr>
          ) : (
            scoredLeads.map(({ lead, score }) => {
              const followDays = daysFromToday(lead.follow_up_date)
              return (
                <tr key={lead.id} className="transition-colors hover:bg-[var(--accent-purple-bg)]">
                  {/* Organisation — cellule deux lignes (org + contact) */}
                  <td className="px-4 py-3">
                    <span className="block truncate font-medium text-[var(--text-primary)]">{lead.name}</span>
                    <span className="block truncate text-[12px] text-[var(--text-secondary)]">
                      {lead.contact_name ?? '—'}
                      {lead.contact_phone && (
                        <>
                          {' · '}
                          <a
                            href={`tel:${lead.contact_phone.replace(/\s/g, '')}`}
                            className="tabular-nums text-[var(--memovia-violet)] hover:underline"
                          >
                            {lead.contact_phone}
                          </a>
                        </>
                      )}
                    </span>
                  </td>

                  {/* Statut */}
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={lead.status} />
                  </td>

                  {/* Prochaine action — la colonne reine */}
                  <td className="px-4 py-3">
                    <span className="block truncate text-[13px] text-[var(--text-primary)]" title={lead.next_action ?? undefined}>
                      {lead.next_action ?? <span className="text-[var(--text-muted)]">—</span>}
                    </span>
                    {followDays !== null && (
                      <span
                        className={`block text-[12px] tabular-nums ${
                          followDays < 0
                            ? 'font-semibold text-[var(--danger)]'
                            : followDays === 0
                              ? 'font-semibold text-[var(--memovia-violet)]'
                              : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {followDays < 0
                          ? `En retard de ${-followDays} j`
                          : followDays === 0
                            ? "Aujourd'hui"
                            : `Dans ${followDays} j (${formatDate(lead.follow_up_date)})`}
                      </span>
                    )}
                  </td>

                  {/* Maturité + Score */}
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      {lead.maturity && <LeadMaturityBadge maturity={lead.maturity} />}
                      <LeadScoreBadge score={score} />
                    </span>
                  </td>

                  {/* Dernier contact */}
                  <td className="truncate px-4 py-3 text-[13px] tabular-nums text-[var(--text-secondary)]">
                    {agoLabel(lead.last_contact_date)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {(lead.why || lead.pitch) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onShowPitch(lead)}
                          className="h-7 w-7 p-0 text-[var(--memovia-violet)] hover:text-[var(--memovia-violet-hover)]"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span className="sr-only">Voir le pitch</span>
                        </Button>
                      )}
                      {lead.archived ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onUnarchive(lead)}
                          className="h-7 px-2 text-[12px] text-[var(--text-muted)] hover:text-[var(--memovia-violet)]"
                        >
                          <ArchiveRestore className="mr-1 h-3.5 w-3.5" />
                          Désarchiver
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onLogCall(lead)}
                          className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-[var(--memovia-violet)]"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          <span className="sr-only">Logger un appel</span>
                        </Button>
                      )}
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
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
