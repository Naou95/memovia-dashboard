import { Phone, PhoneCall, Pencil, ArchiveRestore } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LeadStatusBadge } from './LeadStatusBadge'
import type { Lead } from '@/types/leads'

interface LeadListMobileProps {
  leads: Lead[]
  isLoading: boolean
  onEdit: (lead: Lead) => void
  onLogCall: (lead: Lead) => void
  onUnarchive: (lead: Lead) => void
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

/**
 * Vue mobile des leads (refonte v2 Phase 1) : cartes au pouce, triées par
 * date de relance (le tri vient du hook), pensées pour l'usage d'Emir entre
 * deux rendez-vous — appeler, puis logger en < 30 s.
 */
export function LeadListMobile({ leads, isLoading, onEdit, onLogCall, onUnarchive }: LeadListMobileProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-[var(--border-color)]" />
        ))}
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-12 text-center">
        <p className="text-[15px] font-medium text-[var(--text-primary)]">Aucun lead</p>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          La nouvelle liste CFA France se construit ici.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {leads.map((lead) => (
        <li
          key={lead.id}
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-[var(--shadow-xs)]"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold text-[var(--text-primary)]">
                {lead.name}
              </div>
              {lead.contact_name && (
                <div className="truncate text-[13px] text-[var(--text-secondary)]">
                  {lead.contact_name}
                  {lead.contact_role ? ` · ${lead.contact_role}` : ''}
                </div>
              )}
            </div>
            <LeadStatusBadge status={lead.status} />
          </div>

          {lead.next_action && (
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)]">À faire :</span>{' '}
              {lead.next_action}
              {lead.follow_up_date && (
                <span className="ml-1 tabular-nums text-[var(--text-muted)]">
                  ({formatDate(lead.follow_up_date)})
                </span>
              )}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            {lead.archived ? (
              <Button variant="outline" onClick={() => onUnarchive(lead)} className="h-10 flex-1 gap-1.5">
                <ArchiveRestore className="h-4 w-4" />
                Désarchiver
              </Button>
            ) : (
              <>
                {lead.contact_phone && (
                  <Button asChild className="h-10 flex-1 gap-1.5">
                    <a href={`tel:${lead.contact_phone.replace(/\s/g, '')}`}>
                      <Phone className="h-4 w-4" />
                      Appeler
                    </a>
                  </Button>
                )}
                <Button
                  variant={lead.contact_phone ? 'outline' : 'default'}
                  onClick={() => onLogCall(lead)}
                  className="h-10 flex-1 gap-1.5"
                >
                  <PhoneCall className="h-4 w-4" />
                  Logger l'appel
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              onClick={() => onEdit(lead)}
              className="h-10 w-10 shrink-0 p-0 text-[var(--text-muted)]"
              aria-label="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
