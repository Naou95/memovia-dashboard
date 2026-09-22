import { useState } from 'react'
import { PhoneIncoming, PhoneMissed, PhoneForwarded, PhoneOff, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CALL_RESULTS, CALL_RESULT_LABELS, type CallResult } from '@/types/leads'

// Mêmes issues, mêmes libellés et mêmes icônes que la Revue des campagnes et le log d'appel de Leads.
const ICONS: Record<CallResult, typeof PhoneIncoming> = {
  joint: PhoneIncoming,
  pas_repondu: PhoneMissed,
  rappel: PhoneForwarded,
  refus: PhoneOff,
  interesse: ThumbsUp,
}

interface CallOutcomeBarProps {
  onRecord: (outcome: CallResult, note: string, followUp?: string | null) => Promise<void>
  onPostpone: () => Promise<void>
  /** Relance hors campagne seulement : propose la prochaine date de relance selon l'issue. */
  suggestFollowUp?: (outcome: CallResult) => string | null
}

/**
 * L'issue d'un appel, en un geste, au bas de la fiche : l'issue, une note courte si on veut,
 * « Enregistrer ». Ce que ça déclenche (avancer, rappeler dans 2 jours, arrêter la séquence) est la
 * règle des campagnes, inchangée : ce composant ne fait que la déclencher depuis l'agenda.
 * Pour une relance hors campagne, il n'y a pas de séquence : la prochaine relance se choisit ici,
 * proposée selon l'issue tant qu'on ne l'a pas changée à la main.
 */
export function CallOutcomeBar({ onRecord, onPostpone, suggestFollowUp }: CallOutcomeBarProps) {
  const [outcome, setOutcome] = useState<CallResult | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [followUp, setFollowUp] = useState('')
  const [followUpTouched, setFollowUpTouched] = useState(false)

  function pick(o: CallResult) {
    setOutcome(o)
    if (suggestFollowUp && !followUpTouched) setFollowUp(suggestFollowUp(o) ?? '')
  }

  async function guard(work: () => Promise<void>) {
    setBusy(true)
    try {
      await work()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shrink-0 space-y-2 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-2.5">
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Issue de l'appel">
        {CALL_RESULTS.map((o) => {
          const Icon = ICONS[o]
          const active = outcome === o
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => pick(o)}
              className={cn(
                'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 text-center text-[10.5px] font-semibold leading-tight transition-colors',
                active
                  ? 'border-[var(--memovia-violet)] bg-[var(--memovia-violet-light)] text-[var(--memovia-violet)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {CALL_RESULT_LABELS[o]}
            </button>
          )
        })}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        aria-label="Note d'appel"
        placeholder="Note rapide : qui a répondu, ce qui a été dit, qui rappeler"
        className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] p-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]"
      />
      {suggestFollowUp && outcome && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
          <label htmlFor="agenda-relance" className="font-medium text-[var(--text-secondary)]">Prochaine relance</label>
          <input
            id="agenda-relance"
            type="date"
            value={followUp}
            onChange={(e) => { setFollowUp(e.target.value); setFollowUpTouched(true) }}
            className="rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-[13px] text-[var(--text-primary)]"
          />
          {!followUp && <span className="text-[var(--text-muted)]">aucune : le lead sort des relances</span>}
        </div>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="brand" disabled={!outcome || busy} className="h-11 flex-1 md:h-10" onClick={() => outcome && guard(() => (suggestFollowUp ? onRecord(outcome, note, followUp || null) : onRecord(outcome, note)))}>
          {busy ? 'Enregistrement…' : 'Enregistrer l’appel'}
        </Button>
        <Button type="button" variant="outline" disabled={busy} className="h-11 md:h-10" onClick={() => guard(onPostpone)}>Reporter</Button>
      </div>
    </div>
  )
}
