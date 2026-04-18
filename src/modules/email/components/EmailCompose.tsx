import { useState, useEffect } from 'react'
import { Send, X, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EmailMessageDetail, EmailSendPayload } from '@/types/email'

const FROM_ALIASES = [
  'naoufel@memovia.io',
  'support@memovia.io',
  'contact@memovia.io',
  'emir@memovia.io',
]

interface EmailComposeProps {
  replyTo?: EmailMessageDetail | null
  isSending: boolean
  onSend: (payload: EmailSendPayload) => Promise<boolean>
  onCancel: () => void
}

export function EmailCompose({ replyTo, isSending, onSend, onCancel }: EmailComposeProps) {
  const [from, setFrom] = useState(FROM_ALIASES[0])
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showCc, setShowCc] = useState(false)

  useEffect(() => {
    if (replyTo) {
      setTo(replyTo.from.address)
      setSubject(
        replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`
      )
      const originalHeader = `Le ${new Date(replyTo.date).toLocaleString('fr-FR')}, ${replyTo.from.address} a écrit :`
      setBody(`\n\n---\n${originalHeader}\n${replyTo.text || ''}`)
    }
  }, [replyTo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!to.trim() || !subject.trim() || !body.trim()) return

    const ok = await onSend({
      from,
      to: to.trim(),
      cc: cc.trim() || undefined,
      subject: subject.trim(),
      body: body.trim(),
      inReplyTo: replyTo?.messageId,
    })
    if (ok) onCancel()
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-6 py-4"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {replyTo ? 'Répondre' : 'Nouveau message'}
        </h2>
        <button onClick={onCancel} className="rounded-lg p-1.5 transition-colors hover:bg-black/5">
          <X size={16} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div
          className="flex flex-col gap-3 border-b px-6 py-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          {/* De */}
          <div className="flex items-center gap-3">
            <Label className="w-10 shrink-0 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
              De
            </Label>
            <div className="relative flex-1">
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-8 w-full appearance-none rounded-md border px-3 pr-8 text-sm outline-none transition-colors"
                style={{
                  borderColor: 'var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                {FROM_ALIASES.map((alias) => (
                  <option key={alias} value={alias}>
                    {alias}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
            </div>
          </div>

          {/* À */}
          <div className="flex items-center gap-3">
            <Label className="w-10 shrink-0 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
              À
            </Label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="destinataire@exemple.com"
              type="email"
              required
              className="flex-1 h-8 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowCc(!showCc)}
              className="text-xs transition-colors hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Cc
            </button>
          </div>

          {/* Cc */}
          {showCc && (
            <div className="flex items-center gap-3">
              <Label className="w-10 shrink-0 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                Cc
              </Label>
              <Input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="copie@exemple.com"
                type="email"
                className="flex-1 h-8 text-sm"
              />
            </div>
          )}

          {/* Objet */}
          <div className="flex items-center gap-3">
            <Label className="w-10 shrink-0 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
              Objet
            </Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet du message"
              required
              className="flex-1 h-8 text-sm"
            />
          </div>
        </div>

        {/* Body */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Rédigez votre message..."
          required
          className="flex-1 resize-none px-6 py-4 text-sm outline-none"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--text-primary)',
            lineHeight: '1.6',
          }}
        />

        {/* Footer */}
        <div
          className="flex shrink-0 items-center justify-between border-t px-6 py-3"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="text-sm transition-colors hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Annuler
          </button>
          <Button type="submit" variant="brand" size="sm" disabled={isSending}>
            {isSending ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Envoi…
              </span>
            ) : (
              <>
                <Send size={14} className="mr-1.5" />
                Envoyer
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
