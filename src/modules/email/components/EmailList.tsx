import { Paperclip, Star } from 'lucide-react'
import type { EmailMessage } from '@/types/email'

interface EmailListProps {
  messages: EmailMessage[]
  isLoading: boolean
  selectedUid: number | null
  onSelect: (uid: number) => void
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours < 24 && d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays < 7) {
    return d.toLocaleDateString('fr-FR', { weekday: 'short' })
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function getSenderInitial(msg: EmailMessage): string {
  const name = msg.from.name || msg.from.address || '?'
  return name.charAt(0).toUpperCase()
}

function getSenderLabel(msg: EmailMessage): string {
  return msg.from.name || msg.from.address
}

export function EmailList({ messages, isLoading, selectedUid, onSelect }: EmailListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl p-3"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <div
              className="h-9 w-9 shrink-0 animate-pulse rounded-full"
              style={{ backgroundColor: 'var(--border-color)' }}
            />
            <div className="flex-1 space-y-2">
              <div
                className="h-3 w-2/3 animate-pulse rounded"
                style={{ backgroundColor: 'var(--border-color)' }}
              />
              <div
                className="h-3 w-full animate-pulse rounded"
                style={{ backgroundColor: 'var(--border-color)' }}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Aucun email
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {messages.map((msg) => {
        const isSelected = msg.uid === selectedUid
        return (
          <button
            key={msg.uid}
            onClick={() => onSelect(msg.uid)}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
            style={{
              backgroundColor: isSelected
                ? 'var(--accent-purple-bg)'
                : 'transparent',
            }}
          >
            {/* Avatar */}
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--memovia-violet)' }}
            >
              {getSenderInitial(msg)}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="truncate text-sm"
                  style={{
                    color: 'var(--text-primary)',
                    fontWeight: msg.seen ? 400 : 600,
                  }}
                >
                  {getSenderLabel(msg)}
                </span>
                <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatDate(msg.date)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {!msg.seen && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: 'var(--memovia-violet)' }}
                  />
                )}
                <span
                  className="flex-1 truncate text-xs"
                  style={{
                    color: msg.seen ? 'var(--text-muted)' : 'var(--text-secondary)',
                    fontWeight: msg.seen ? 400 : 500,
                  }}
                >
                  {msg.subject}
                </span>
                {msg.flagged && (
                  <Star size={11} className="shrink-0" style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                )}
                {msg.hasAttachments && (
                  <Paperclip size={11} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
