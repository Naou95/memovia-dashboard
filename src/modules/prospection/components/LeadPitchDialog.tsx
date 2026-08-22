import * as Dialog from '@radix-ui/react-dialog'
import { X, Phone, Mail } from 'lucide-react'
import type { Lead } from '@/types/leads'

interface LeadPitchDialogProps {
  lead: Lead | null
  onClose: () => void
}

/**
 * Fiche argumentaire (accueil v2, 22/08/2026) : le contact, pourquoi cette
 * école, et le pitch aligné sur le positionnement — lisible avant d'appeler.
 */
export function LeadPitchDialog({ lead, onClose }: LeadPitchDialogProps) {
  if (!lead) return null

  return (
    <Dialog.Root open onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <Dialog.Title className="text-[16px] font-semibold text-[var(--text-primary)]">
            {lead.name}
          </Dialog.Title>
          <Dialog.Close asChild>
            <button
              className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </div>

        {/* Contact */}
        {(lead.contact_name || lead.contact_phone || lead.contact_email) && (
          <div className="mb-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Contact
            </h3>
            {lead.contact_name && (
              <p className="text-[14px] font-medium text-[var(--text-primary)]">
                {lead.contact_name}
                {lead.contact_role && (
                  <span className="font-normal text-[var(--text-secondary)]"> · {lead.contact_role}</span>
                )}
              </p>
            )}
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {lead.contact_phone && (
                <a
                  href={`tel:${lead.contact_phone.replace(/\s/g, '')}`}
                  className="flex items-center gap-1.5 text-[13px] tabular-nums text-[var(--memovia-violet)] hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {lead.contact_phone}
                </a>
              )}
              {lead.contact_email && (
                <a
                  href={`mailto:${lead.contact_email}`}
                  className="flex items-center gap-1.5 text-[13px] text-[var(--memovia-violet)] hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {lead.contact_email}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Pourquoi */}
        <div className="mb-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
            {lead.type === 'partenaire' ? 'Pourquoi ce partenaire' : 'Pourquoi cette école'}
          </h3>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-primary)]">
            {lead.why ?? 'Pas encore renseigné — à compléter sur la fiche.'}
          </p>
        </div>

        {/* Pitch */}
        <div className="rounded-lg border border-[var(--memovia-violet)]/25 bg-[var(--accent-purple-bg)] p-3">
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--memovia-violet)]">
            Pitch
          </h3>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-primary)]">
            {lead.pitch ?? 'Pas encore renseigné — à compléter sur la fiche.'}
          </p>
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
