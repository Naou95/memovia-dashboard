import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, PhoneIncoming, PhoneMissed, PhoneForwarded } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Lead, CallOutcome } from '@/types/leads'
import { CALL_OUTCOME_LABELS } from '@/types/leads'
import type { LogCallInput } from '@/hooks/useLeads'

interface LogCallDialogProps {
  lead: Lead | null
  onClose: () => void
  onSubmit: (leadId: string, input: LogCallInput) => Promise<void>
}

const OUTCOME_ICONS: Record<CallOutcome, typeof PhoneIncoming> = {
  repondu: PhoneIncoming,
  pas_repondu: PhoneMissed,
  rappel: PhoneForwarded,
}

/**
 * Log d'appel en < 30 s (refonte v2 Phase 1) : issue en un tap, note courte
 * optionnelle, prochaine action optionnelle. Pensé pouce sur téléphone.
 */
export function LogCallDialog({ lead, onClose, onSubmit }: LogCallDialogProps) {
  const [outcome, setOutcome] = useState<CallOutcome | null>(null)
  const [note, setNote] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (lead) {
      setOutcome(null)
      setNote('')
      setNextAction('')
      setFollowUpDate('')
    }
  }, [lead])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!lead || !outcome) return
    setIsSubmitting(true)
    try {
      await onSubmit(lead.id, {
        outcome,
        note: note.trim() || undefined,
        nextAction: nextAction.trim() || undefined,
        followUpDate: followUpDate || undefined,
      })
      onClose()
    } catch {
      // Le parent affiche le toast d'erreur ; on reste ouvert pour réessayer.
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={lead != null} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-[16px] font-semibold text-[var(--text-primary)]">
              Appel — {lead?.name}
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Issue de l'appel — 3 gros boutons, un tap */}
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Issue de l'appel">
              {(Object.keys(OUTCOME_ICONS) as CallOutcome[]).map((o) => {
                const Icon = OUTCOME_ICONS[o]
                const active = outcome === o
                return (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setOutcome(o)}
                    className={cn(
                      'flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[12px] font-medium transition-colors',
                      active
                        ? 'border-[var(--memovia-violet)] bg-[var(--memovia-violet-light)] text-[var(--memovia-violet)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2} />
                    {CALL_OUTCOME_LABELS[o]}
                  </button>
                )
              })}
            </div>

            {/* Note courte */}
            <div className="space-y-1.5">
              <Label htmlFor="call-note">Note (optionnel)</Label>
              <textarea
                id="call-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex : intéressé, veut voir une démo…"
                rows={2}
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]"
              />
            </div>

            {/* Prochaine action + date */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="call-next-action">Prochaine action</Label>
                <Input
                  id="call-next-action"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="Ex : envoyer la démo"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="call-follow-up">Quand</Label>
                <Input
                  id="call-follow-up"
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" disabled={!outcome || isSubmitting} className="w-full">
              {isSubmitting ? 'Enregistrement…' : 'Logger l\'appel'}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
