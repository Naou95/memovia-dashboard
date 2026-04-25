import { Paperclip, Star } from 'lucide-react'
import type { EmailMessage } from '@/types/email'

interface EnrichedEmailMessage extends EmailMessage {
  isUrgent?: boolean
}

interface EmailListProps {
  messages: EnrichedEmailMessage[]
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

function getSenderName(msg: EmailMessage): string {
  return msg.from.name || msg.from.address
}

// Generate a consistent color from sender name/email
function getAvatarColor(msg: EmailMessage): string {
  const str = msg.from.address || msg.from.name || ''
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = [
    '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF9500',
    '#34C759', '#00C7BE', '#30B0C7', '#FF6482', '#A2845E',
  ]
  return colors[Math.abs(hash) % colors.length]
}

export function EmailList({ messages, isLoading, selectedUid, onSelect }: EmailListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3" style={{ borderBottom: '1px solid #f0f0f0' }}>
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full" style={{ backgroundColor: '#e5e5ea' }} />
            <div className="flex-1 space-y-2 pt-0.5">
              <div className="h-3 w-28 animate-pulse rounded" style={{ backgroundColor: '#e5e5ea' }} />
              <div className="h-3 w-full animate-pulse rounded" style={{ backgroundColor: '#e5e5ea' }} />
              <div className="h-3 w-3/4 animate-pulse rounded" style={{ backgroundColor: '#e5e5ea' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <p className="text-[13px]" style={{ color: '#86868b' }}>
          Aucun email
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {messages.map((msg) => {
        const isSelected = msg.uid === selectedUid
        const isUnread = !msg.seen
        return (
          <button
            key={msg.uid}
            onClick={() => onSelect(msg.uid)}
            className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-[100ms]"
            style={{
              backgroundColor: isSelected ? '#EDE9FF' : 'transparent',
              borderBottom: '1px solid #f0f0f0',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = '#F5F5F7'
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            {/* Blue dot for unread */}
            <div className="flex w-2 shrink-0 items-center pt-4">
              {isUnread && (
                <span
                  className="block h-[8px] w-[8px] rounded-full"
                  style={{ backgroundColor: '#007AFF' }}
                />
              )}
            </div>

            {/* Avatar */}
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
              style={{ backgroundColor: getAvatarColor(msg) }}
            >
              {getSenderInitial(msg)}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="truncate text-[13px]"
                  style={{
                    color: '#1d1d1f',
                    fontWeight: isUnread ? 600 : 400,
                  }}
                >
                  {getSenderName(msg)}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  {msg.flagged && (
                    <Star size={11} style={{ color: '#FF9500', fill: '#FF9500' }} />
                  )}
                  {msg.hasAttachments && (
                    <Paperclip size={11} style={{ color: '#86868b' }} />
                  )}
                  <span className="text-[11px]" style={{ color: '#86868b' }}>
                    {formatDate(msg.date)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="truncate text-[13px]"
                  style={{
                    color: isUnread ? '#1d1d1f' : '#86868b',
                    fontWeight: isUnread ? 500 : 400,
                  }}
                >
                  {msg.subject}
                </span>
                {msg.isUrgent && (
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: '#FF3B30',
                      color: '#fff',
                    }}
                  >
                    URGENT
                  </span>
                )}
              </div>
              {/* Preview line - truncated */}
              <p
                className="mt-0.5 truncate text-[12px] leading-[1.4]"
                style={{ color: '#86868b' }}
              >
                {msg.subject}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
