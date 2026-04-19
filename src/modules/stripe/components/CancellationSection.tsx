import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Mail, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { SubscriptionRow } from '@/types/stripe'

interface Props {
  subscriptions: SubscriptionRow[]
}

function formatCancelDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function daysUntil(iso: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const end = new Date(iso)
  end.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function buildEmailBody(_email: string, cancelDate: string): string {
  return `Bonjour,

Nous avons vu que vous avez annulé votre abonnement MEMOVIA. Avant que celui-ci se termine le ${cancelDate}, nous aimerions comprendre ce qui n'a pas fonctionné pour vous.

Y a-t-il quelque chose qu'on aurait pu mieux faire ? Ou un problème qu'on peut encore résoudre ?

Je suis disponible pour un appel de 15 min si vous le souhaitez.

Naoufel
Co-fondateur MEMOVIA`
}

export function CancellationSection({ subscriptions }: Props) {
  const canceling = subscriptions.filter((s) => s.cancelAtPeriodEnd && s.cancelAt)
  if (canceling.length === 0) return null

  return (
    <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-[var(--danger)]" />
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
          Annulations en cours
        </h3>
        <span className="ml-auto rounded-full bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-2 py-0.5 text-[12px] font-medium text-[var(--danger)]">
          {canceling.length}
        </span>
      </div>
      <div className="space-y-3">
        {canceling.map((sub) => (
          <CancellationCard key={sub.id} sub={sub} />
        ))}
      </div>
    </section>
  )
}

// ── Card ────────────────────────────────────────────────────────────────────────

function CancellationCard({ sub }: { sub: SubscriptionRow }) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)

  const cancelDate = formatCancelDate(sub.cancelAt!)
  const days = daysUntil(sub.cancelAt!)
  const isUrgent = days < 7

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-3">
      {/* Info abonné */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
          {sub.customerEmail || '—'}
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
          {sub.planName} · fin le {cancelDate}
        </p>
      </div>

      {/* Badge jours restants */}
      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold tabular-nums ${
          isUrgent
            ? 'bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]'
            : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
        }`}
      >
        {days <= 0 ? 'Expire aujourd\'hui' : `${days}j restants`}
      </span>

      {/* Action */}
      {sent ? (
        <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--success,#16a34a)_12%,transparent)] px-3 py-1 text-[12px] font-medium text-[var(--success,#16a34a)]">
          Email envoyé
        </span>
      ) : (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--memovia-violet-light)] hover:text-[var(--memovia-violet)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)]">
              <Mail className="h-3.5 w-3.5" />
              Envoyer email de rétention
            </button>
          </Dialog.Trigger>
          <RetentionModal
            sub={sub}
            cancelDate={cancelDate}
            onClose={() => setOpen(false)}
            onSent={() => { setSent(true); setOpen(false) }}
          />
        </Dialog.Root>
      )}
    </div>
  )
}

// ── Modal ────────────────────────────────────────────────────────────────────────

interface ModalProps {
  sub: SubscriptionRow
  cancelDate: string
  onClose: () => void
  onSent: () => void
}

function RetentionModal({ sub, cancelDate, onClose, onSent }: ModalProps) {
  const [body, setBody] = useState(() => buildEmailBody(sub.customerEmail, cancelDate))
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  async function handleSend() {
    setIsSending(true)
    setSendError(null)
    try {
      const { error } = await supabase.functions.invoke('email-send', {
        body: {
          from: 'naoufel@memovia.io',
          to: sub.customerEmail,
          subject: 'On aimerait comprendre votre départ de MEMOVIA',
          body,
        },
      })
      if (error) throw error
      onSent()
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Erreur envoi email')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 shadow-xl focus:outline-none">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <Dialog.Title className="text-[15px] font-semibold text-[var(--text-primary)]">
              Email de rétention
            </Dialog.Title>
            <Dialog.Description className="mt-0.5 text-[13px] text-[var(--text-muted)]">
              À : {sub.customerEmail}
            </Dialog.Description>
          </div>
          <Dialog.Close asChild>
            <button className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)]">
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </div>

        {/* Champs en lecture seule */}
        <div className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[13px]">
          <span className="text-[var(--text-muted)]">De</span>
          <span className="text-[var(--text-primary)]">naoufel@memovia.io</span>
          <span className="text-[var(--text-muted)]">Sujet</span>
          <span className="text-[var(--text-primary)]">On aimerait comprendre votre départ de MEMOVIA</span>
        </div>

        {/* Corps éditable */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]"
        />

        {sendError && (
          <p className="mt-2 text-[12px] text-[var(--danger)]">{sendError}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSending}
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-primary)] disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !sub.customerEmail}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--memovia-violet)] px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mail className="h-3.5 w-3.5" />
            {isSending ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  )
}
