import { useState } from 'react'
import { Reply, ExternalLink, Loader2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EmailMessageDetail } from '@/types/email'

function formatFullDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTextPreview(email: EmailMessageDetail): string {
  if (email.text) {
    return email.text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('>'))
      .slice(0, 2)
      .join(' ')
      .substring(0, 150)
  }
  return ''
}

interface ThreadCardProps {
  email: EmailMessageDetail
  isExpanded: boolean
  isSent: boolean
  showDivider: boolean
}

function ThreadCard({ email, isExpanded: defaultExpanded, isSent, showDivider }: ThreadCardProps) {
  const [open, setOpen] = useState(defaultExpanded)
  const preview = getTextPreview(email)
  const fromLabel = email.from.name || email.from.address

  return (
    <div
      className={showDivider ? 'border-b' : ''}
      style={{ borderBottomColor: 'var(--border-color)' }}
    >
      <div
        className="border-l-[3px]"
        style={{
          borderLeftColor: isSent ? 'var(--memovia-violet)' : 'var(--border-color)',
          marginLeft: '1px',
        }}
      >
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-secondary)]"
          aria-expanded={open}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="truncate text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {fromLabel}
              </span>
              {isSent && (
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--accent-purple-bg)',
                    color: 'var(--memovia-violet)',
                  }}
                >
                  Envoyé
                </span>
              )}
            </div>
            {!open && preview && (
              <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                {preview}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatShortDate(email.date)}
            </span>
            <ChevronDown
              size={14}
              style={{
                color: 'var(--text-muted)',
                transform: open ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s',
              }}
            />
          </div>
        </button>

        {open && (
          <div className="px-4 pb-4">
            <div className="mb-3 space-y-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <p>
                <span style={{ color: 'var(--text-muted)' }}>De : </span>
                {email.from.name
                  ? `${email.from.name} <${email.from.address}>`
                  : email.from.address}
              </p>
              <p>
                <span style={{ color: 'var(--text-muted)' }}>À : </span>
                {email.to
                  .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
                  .join(', ')}
              </p>
              {email.cc && email.cc.length > 0 && (
                <p>
                  <span style={{ color: 'var(--text-muted)' }}>Cc : </span>
                  {email.cc
                    .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
                    .join(', ')}
                </p>
              )}
              <p style={{ color: 'var(--text-muted)' }}>{formatFullDate(email.date)}</p>
            </div>
            {email.html ? (
              <iframe
                srcDoc={email.html}
                className="w-full rounded-lg border-0"
                style={{ minHeight: '220px' }}
                sandbox=""
                title="Email content"
              />
            ) : (
              <pre
                className="whitespace-pre-wrap text-sm leading-relaxed"
                style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}
              >
                {email.text || '(Contenu vide)'}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface EmailDetailProps {
  email: EmailMessageDetail | null
  isLoading: boolean
  onReply: (email: EmailMessageDetail) => void
}

export function EmailDetail({ email, isLoading, onReply }: EmailDetailProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--memovia-violet)' }} />
      </div>
    )
  }

  if (!email) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-[8px]"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <ExternalLink size={24} style={{ color: 'var(--text-muted)' }} />
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Sélectionnez un email pour le lire
        </p>
      </div>
    )
  }

  const thread = email.thread
  const hasThread = thread && thread.length > 1

  const fromLabel = email.from.name
    ? `${email.from.name} <${email.from.address}>`
    : email.from.address

  const toLabel = email.to
    .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
    .join(', ')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 border-b px-6 py-4"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2
              className="text-base font-semibold leading-snug"
              style={{ color: 'var(--text-primary)' }}
            >
              {email.subject}
            </h2>
            {hasThread ? (
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                {thread.length} messages dans ce fil
              </p>
            ) : (
              <div className="mt-2 space-y-0.5">
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>
                    De :{' '}
                  </span>
                  {fromLabel}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>
                    À :{' '}
                  </span>
                  {toLabel}
                </p>
                {email.cc && email.cc.length > 0 && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-medium" style={{ color: 'var(--text-muted)' }}>
                      Cc :{' '}
                    </span>
                    {email.cc
                      .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
                      .join(', ')}
                  </p>
                )}
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatFullDate(email.date)}
                </p>
              </div>
            )}
          </div>
          <Button variant="brand" size="sm" onClick={() => onReply(email)}>
            <Reply size={14} className="mr-1.5" />
            Répondre
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {hasThread ? (
          <div className="flex flex-col">
            {thread.map((item, index) => (
              <ThreadCard
                key={`${item.folder}-${item.uid}`}
                email={item}
                isExpanded={index === thread.length - 1}
                isSent={item.folder === 'Sent'}
                showDivider={index < thread.length - 1}
              />
            ))}
          </div>
        ) : (
          <div className="px-6 py-4 h-full">
            {email.html ? (
              <iframe
                srcDoc={email.html}
                className="h-full w-full rounded-lg border-0"
                style={{ minHeight: '400px' }}
                sandbox=""
                title="Email content"
              />
            ) : (
              <pre
                className="whitespace-pre-wrap text-sm leading-relaxed"
                style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}
              >
                {email.text || '(Contenu vide)'}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
