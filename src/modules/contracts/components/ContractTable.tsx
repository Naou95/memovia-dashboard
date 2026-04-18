import { useState } from 'react'
import { Pencil, Trash2, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContractStatusBadge } from './ContractStatusBadge'
import type { Contract } from '@/types/contracts'
import { ORG_TYPE_LABELS } from '@/types/contracts'

interface ContractTableProps {
  contracts: Contract[]
  isLoading: boolean
  onEdit: (contract: Contract) => void
  onDelete: (id: string) => Promise<void>
  onDocuments: (contract: Contract) => void
  canDelete: boolean
}

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
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-[var(--border-color)]" />
        </td>
      ))}
    </tr>
  )
}

export function ContractTable({
  contracts,
  isLoading,
  onEdit,
  onDelete,
  onDocuments,
  canDelete,
}: ContractTableProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
    <div className="overflow-x-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <table className="w-full text-sm" aria-label="Liste des contrats B2B">
        <thead>
          <tr className="border-b border-[var(--border-color)]">
            <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Organisation
            </th>
            <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Statut
            </th>
            <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Licences
            </th>
            <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              MRR
            </th>
            <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Contact
            </th>
            <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Renouvellement
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
          ) : contracts.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center">
                <p className="text-[15px] font-medium text-[var(--text-primary)]">
                  Aucun contrat trouvé
                </p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                  Créez votre premier contrat B2B pour commencer.
                </p>
              </td>
            </tr>
          ) : (
            contracts.map((contract) => (
              <tr
                key={contract.id}
                className="transition-colors hover:bg-[var(--accent-purple-bg)]"
              >
                {/* Organisation */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--text-primary)]">
                      {contract.organization_name}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {ORG_TYPE_LABELS[contract.organization_type]}
                    </span>
                  </div>
                </td>

                {/* Statut */}
                <td className="px-4 py-3">
                  <ContractStatusBadge status={contract.status} />
                </td>

                {/* Licences */}
                <td className="px-4 py-3 text-right tabular-nums text-[var(--text-primary)]">
                  {contract.license_count}
                </td>

                {/* MRR */}
                <td className="px-4 py-3 text-right tabular-nums text-[var(--text-primary)]">
                  {contract.mrr_eur != null ? `${contract.mrr_eur} €` : '—'}
                </td>

                {/* Contact */}
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {contract.contact_name ?? '—'}
                </td>

                {/* Renouvellement */}
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {formatDate(contract.renewal_date)}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDocuments(contract)}
                      className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-[var(--memovia-violet)]"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      <span className="sr-only">Documents</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(contract)}
                      className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-[var(--memovia-violet)]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">Modifier</span>
                    </Button>

                    {canDelete && (
                      confirmingId === contract.id ? (
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
                            onClick={() => handleDelete(contract.id)}
                            disabled={deletingId === contract.id}
                            className="h-7 px-2 text-[12px] text-[var(--danger)] hover:bg-[var(--trend-down-bg)]"
                          >
                            {deletingId === contract.id ? '...' : 'Confirmer'}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmingId(contract.id)}
                          className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-[var(--danger)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Supprimer</span>
                        </Button>
                      )
                    )}
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
