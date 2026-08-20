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

/** Consistent avatar color from sender address — uses MEMOVIA accent palette */
function getAvatarColor(msg: EmailMessage): string {
  const str = msg.from.address || msg.from.name || ''
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = [
    'var(--memovia-violet)',
    'var(--accent-blue)',
    'var(--success)',
    'var(--warning)',
    'var(--danger)',
    'var(--chart-purple-400)',
    'var(--memovia-violet-hover)',
    'var(--chart-purple-600)',
  ]
  return colors[Math.abs(hash) % colors.length]
}

/**
 * Liste dense « une ligne par mail » (refonte Mail du 20/08/2026, modèle
 * Dribbble Holesinsky) : point non-lu · avatar · expéditeur · chip urgent ·
 * objet · pièce jointe · date. Pas de fausse préview — on n'a que l'objet.
 */
export function EmailList({ messages, isLoading, selectedUid, onSelect }: EmailListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-5 py-[13px]"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-full" style={{ backgroundColor: 'var(--border-color)' }} />
            <div className="h-3 w-36 animate-pulse rounded" style={{ backgroundColor: 'var(--border-color)' }} />
            <div className="h-3 flex-1 animate-pulse rounded" style={{ backgroundColor: 'var(--border-color)' }} />
            <div className="h-3 w-14 animate-pulse rounded" style={{ backgroundColor: 'var(--border-color)' }} />
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20">
        <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
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
            className="group flex w-full items-center gap-3 px-5 py-[13px] text-left transition-colors"
            style={{
              transitionDuration: '120ms',
              transitionTimingFunction: 'var(--ease-out)',
              backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent',
              borderBottom: '1px solid var(--border-subtle)',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            {/* Point non-lu */}
            <span className="w-2 shrink-0">
              {isUnread && (
                <span className="block h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--memovia-violet)' }} />
              )}
            </span>

            {/* Avatar compact */}
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
              style={{ backgroundColor: getAvatarColor(msg) }}
            >
              {getSenderInitial(msg)}
            </span>

            {/* Expéditeur — colonne fixe pour l'alignement vertical des objets */}
            <span
              className="w-28 shrink-0 truncate text-[13px] sm:w-44"
              style={{ color: 'var(--text-primary)', fontWeight: isUnread ? 600 : 400 }}
            >
              {getSenderName(msg)}
            </span>

            {/* Chip urgent */}
            {msg.isUrgent && (
              <span
                className="hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:inline"
                style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}
              >
                Urgent
              </span>
            )}

            {/* Objet — la ligne respire, l'objet porte le poids du non-lu */}
            <span
              className="min-w-0 flex-1 truncate text-[13px]"
              style={{
                color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isUnread ? 500 : 400,
              }}
            >
              {msg.subject}
            </span>

            {/* Indicateurs + date */}
            <span className="flex shrink-0 items-center gap-2">
              {msg.flagged && <Star size={11} style={{ color: 'var(--warning)', fill: 'var(--warning)' }} />}
              {msg.hasAttachments && <Paperclip size={11} style={{ color: 'var(--text-muted)' }} />}
              <span className="w-14 text-right text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {formatDate(msg.date)}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
