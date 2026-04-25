import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Mail, AlertTriangle, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { SubscriptionRow } from '@/types/stripe'

interface RetentionRecord {
  sent_at: string
  sent_from: string
}

const SENDER_ALIASES = [
  'naoufel@memovia.io',
  'support@memovia.io',
  'contact@memovia.io',
  'emir@memovia.io',
] as const

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

// ── TEST temporaire — à supprimer après validation ─────────────────────────────
function TestEmailButton() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleTest() {
    setStatus('sending')
    setErrorMsg('')
    try {
      console.log('[test-email] Sending test email...')
      const { data, error } = await supabase.functions.invoke('email-send', {
        body: {
          from: 'naoufel@memovia.io',
          to: 'bassou.naoufel@gmail.com',
          subject: 'TEST rétention',
          body: 'Ceci est un email de test envoyé depuis le dashboard MEMOVIA pour vérifier que email-send fonctionne.',
        },
      })
      console.log('[test-email] Response:', { data, error })
      if (error) {
        let detail = ''
        if (error.context && typeof error.context.json === 'function') {
          try {
            const errBody = await error.context.json()
            console.error('[test-email] Error body:', errBody)
            detail = errBody?.error || ''
          } catch {
            try { detail = await error.context.text() } catch { /* ignore */ }
          }
        }
        throw new Error(detail || error.message || 'Erreur inconnue')
      }
      console.log('[test-email] Success:', data)
      toast.success('Email test envoyé — vérifie bassou.naoufel@gmail.com')
      setStatus('ok')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('[test-email] Error:', msg)
      toast.error(`Échec test email : ${msg}`)
      setErrorMsg(msg)
      setStatus('error')
    }
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-dashed border-amber-400/50 bg-amber-400/5 px-4 py-3">
      <span className="text-[12px] text-[var(--text-muted)]">🧪 TEST</span>
      <button
        onClick={handleTest}
        disabled={status === 'sending'}
        className="rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {status === 'sending' ? 'Envoi…' : status === 'ok' ? '✓ Envoyé' : 'Envoyer test → bassou.naoufel@gmail.com'}
      </button>
      {status === 'error' && (
        <span className="text-[12px] text-[var(--danger)]">{errorMsg}</span>
      )}
    </div>
  )
}

export function CancellationSection({ subscriptions }: Props) {
  const canceling = subscriptions.filter((s) => s.cancelAtPeriodEnd)
  const [retentionHistory, setRetentionHistory] = useState<Record<string, RetentionRecord>>({})

  // Fetch last retention email per subscriber
  useEffect(() => {
    if (canceling.length === 0) return
    const emails = canceling.map((s) => s.customerEmail).filter(Boolean) as string[]
    if (emails.length === 0) return

    supabase
      .from('retention_emails')
      .select('subscriber_email, sent_at, sent_from')
      .in('subscriber_email', emails)
      .order('sent_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, RetentionRecord> = {}
        for (const row of data) {
          // Keep only the most recent per subscriber
          if (!map[row.subscriber_email]) {
            map[row.subscriber_email] = { sent_at: row.sent_at, sent_from: row.sent_from }
          }
        }
        setRetentionHistory(map)
      })
  }, [canceling.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRecordSent(email: string, sentFrom: string) {
    setRetentionHistory((prev) => ({
      ...prev,
      [email]: { sent_at: new Date().toISOString(), sent_from: sentFrom },
    }))
  }

  if (canceling.length === 0) return null

  return (
    <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
      {/* TEST temporaire — à supprimer */}
      <TestEmailButton />

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
          <CancellationCard
            key={sub.id}
            sub={sub}
            lastRetention={sub.customerEmail ? retentionHistory[sub.customerEmail] : undefined}
            onRecordSent={handleRecordSent}
          />
        ))}
      </div>
    </section>
  )
}

// ── Card ────────────────────────────────────────────────────────────────────────

interface CardProps {
  sub: SubscriptionRow
  lastRetention?: RetentionRecord
  onRecordSent: (email: string, sentFrom: string) => void
}

function CancellationCard({ sub, lastRetention, onRecordSent }: CardProps) {
  const [open, setOpen] = useState(false)

  const cancelDate = sub.cancelAt ? formatCancelDate(sub.cancelAt) : 'fin de période inconnue'
  const days = sub.cancelAt ? daysUntil(sub.cancelAt) : null
  const isUrgent = days !== null && days < 7

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
        {lastRetention && (
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            Email envoyé le{' '}
            {new Date(lastRetention.sent_at).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}{' '}
            par {lastRetention.sent_from}
          </p>
        )}
      </div>

      {/* Badge jours restants */}
      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold tabular-nums ${
          isUrgent
            ? 'bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]'
            : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
        }`}
      >
        {days === null ? '—' : days <= 0 ? 'Expire aujourd\'hui' : `${days}j restants`}
      </span>

      {/* Action — toujours cliquable pour renvoyer */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--memovia-violet-light)] hover:text-[var(--memovia-violet)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)]">
            <Mail className="h-3.5 w-3.5" />
            {lastRetention ? 'Renvoyer un email' : 'Envoyer email de rétention'}
          </button>
        </Dialog.Trigger>
        <RetentionModal
          sub={sub}
          cancelDate={cancelDate}
          onClose={() => setOpen(false)}
          onSent={(sentFrom: string) => {
            if (sub.customerEmail) onRecordSent(sub.customerEmail, sentFrom)
            setOpen(false)
          }}
        />
      </Dialog.Root>
    </div>
  )
}

// ── Modal ────────────────────────────────────────────────────────────────────────

interface ModalProps {
  sub: SubscriptionRow
  cancelDate: string
  onClose: () => void
  onSent: (sentFrom: string) => void
}

function RetentionModal({ sub, cancelDate, onClose, onSent }: ModalProps) {
  const [body, setBody] = useState(() => buildEmailBody(sub.customerEmail, cancelDate))
  const [sender, setSender] = useState<string>(SENDER_ALIASES[0])
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  async function handleSend() {
    setIsSending(true)
    setSendError(null)
    try {
      console.log('[retention-email] Sending email...', {
        from: sender,
        to: sub.customerEmail,
        subject: 'On aimerait comprendre votre départ de MEMOVIA',
      })

      const { data, error } = await supabase.functions.invoke('email-send', {
        body: {
          from: sender,
          to: sub.customerEmail,
          subject: 'On aimerait comprendre votre départ de MEMOVIA',
          body,
        },
      })

      console.log('[retention-email] Response:', { data, error })

      if (error) {
        // Extract the real error message from the Edge Function response
        let detail = ''
        if (error.context && typeof error.context.json === 'function') {
          try {
            const errBody = await error.context.json()
            console.error('[retention-email] Error body:', errBody)
            detail = errBody?.error || ''
          } catch {
            // context.json() failed, try text
            try {
              detail = await error.context.text()
              console.error('[retention-email] Error text:', detail)
            } catch { /* ignore */ }
          }
        }
        const message = detail || error.message || 'Erreur inconnue'
        throw new Error(message)
      }

      console.log('[retention-email] Success:', data)

      // Track in retention_emails table
      const subject = 'On aimerait comprendre votre départ de MEMOVIA'
      const { error: dbError } = await supabase
        .from('retention_emails')
        .insert({ subscriber_email: sub.customerEmail, sent_from: sender, subject })
      if (dbError) console.error('[retention-email] DB insert error:', dbError)

      toast.success(`Email de rétention envoyé à ${sub.customerEmail}`)
      onSent(sender)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur envoi email'
      console.error('[retention-email] Final error:', message)
      setSendError(message)
      toast.error(`Échec envoi email : ${message}`)
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

        {/* Champs */}
        <div className="mb-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-[13px]">
          <span className="text-[var(--text-muted)]">De</span>
          <div className="relative">
            <select
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="w-full appearance-none rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] py-1.5 pl-3 pr-8 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]"
            >
              {SENDER_ALIASES.map((alias) => (
                <option key={alias} value={alias}>{alias}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          </div>
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
