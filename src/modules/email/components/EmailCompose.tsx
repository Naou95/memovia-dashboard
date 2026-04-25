import { useState, useEffect } from 'react'
import { Send, X, Minus, ChevronDown } from 'lucide-react'
import type { EmailMessageDetail, EmailSendPayload } from '@/types/email'

const FROM_ALIASES = [
  'naoufel@memovia.io',
  'support@memovia.io',
  'contact@memovia.io',
  'emir@memovia.io',
]

interface EmailComposeProps {
  replyTo?: EmailMessageDetail | null
  initialTemplate?: { subject: string; body: string } | null
  isSending: boolean
  onSend: (payload: EmailSendPayload) => Promise<boolean>
  onCancel: () => void
}

export function EmailCompose({ replyTo, initialTemplate, isSending, onSend, onCancel }: EmailComposeProps) {
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
    } else if (initialTemplate) {
      setSubject(initialTemplate.subject)
      setBody(initialTemplate.body)
    }
  }, [replyTo, initialTemplate])

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
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div
        className="flex shrink-0 items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid #e5e5ea', backgroundColor: '#f9f9f9' }}
      >
        <span className="text-[13px] font-semibold" style={{ color: '#1d1d1f' }}>
          {replyTo ? 'Répondre' : 'Nouveau message'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onCancel}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-black/5"
          >
            <Minus size={13} style={{ color: '#86868b' }} />
          </button>
          <button
            onClick={onCancel}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-black/5"
          >
            <X size={13} style={{ color: '#86868b' }} />
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-col" style={{ borderBottom: '1px solid #e5e5ea' }}>
          {/* De */}
          <div
            className="flex items-center gap-0 px-4 py-1.5"
            style={{ borderBottom: '1px solid #f0f0f0' }}
          >
            <span className="w-10 shrink-0 text-[13px]" style={{ color: '#86868b' }}>De :</span>
            <div className="relative flex-1">
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-7 w-full appearance-none bg-transparent pr-6 text-[13px] outline-none"
                style={{ color: '#1d1d1f' }}
              >
                {FROM_ALIASES.map((alias) => (
                  <option key={alias} value={alias}>{alias}</option>
                ))}
              </select>
              <ChevronDown
                size={11}
                className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2"
                style={{ color: '#86868b' }}
              />
            </div>
          </div>

          {/* À */}
          <div
            className="flex items-center gap-0 px-4 py-1.5"
            style={{ borderBottom: '1px solid #f0f0f0' }}
          >
            <span className="w-10 shrink-0 text-[13px]" style={{ color: '#86868b' }}>À :</span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="destinataire@exemple.com"
              type="email"
              required
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#c7c7cc]"
              style={{ color: '#1d1d1f' }}
            />
            <button
              type="button"
              onClick={() => setShowCc(!showCc)}
              className="text-[12px] transition-colors"
              style={{ color: '#007AFF' }}
            >
              Cc
            </button>
          </div>

          {/* Cc */}
          {showCc && (
            <div
              className="flex items-center gap-0 px-4 py-1.5"
              style={{ borderBottom: '1px solid #f0f0f0' }}
            >
              <span className="w-10 shrink-0 text-[13px]" style={{ color: '#86868b' }}>Cc :</span>
              <input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="copie@exemple.com"
                type="email"
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#c7c7cc]"
                style={{ color: '#1d1d1f' }}
              />
            </div>
          )}

          {/* Objet */}
          <div className="flex items-center gap-0 px-4 py-1.5">
            <span className="w-10 shrink-0 text-[13px]" style={{ color: '#86868b' }}>Objet</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet du message"
              required
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#c7c7cc]"
              style={{ color: '#1d1d1f' }}
            />
          </div>
        </div>

        {/* Body */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Rédigez votre message..."
          required
          className="flex-1 resize-none px-4 py-3 text-[13px] outline-none"
          style={{
            backgroundColor: 'transparent',
            color: '#1d1d1f',
            lineHeight: '1.6',
          }}
        />

        {/* Footer */}
        <div
          className="flex shrink-0 items-center justify-end px-4 py-2.5"
          style={{ borderTop: '1px solid #e5e5ea' }}
        >
          <button
            type="submit"
            disabled={isSending}
            className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: 'var(--memovia-violet)' }}
          >
            {isSending ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Envoi…
              </>
            ) : (
              <>
                <Send size={13} />
                Envoyer
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
