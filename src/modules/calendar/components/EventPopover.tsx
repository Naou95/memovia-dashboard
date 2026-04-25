import { useRef, useEffect } from 'react'
import { X, Clock, MapPin, Video, ExternalLink, User } from 'lucide-react'
import type { CalendarEvent } from '@/types/calendar'

const COLOR_NAOUFEL = '#7C3AED'
const COLOR_EMIR = '#00E5CC'

interface Props {
  event: CalendarEvent
  anchorRect: DOMRect | null
  onClose: () => void
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function EventPopover({ event, anchorRect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Position : centré horizontalement par rapport à l'ancre, en dessous
  const style: React.CSSProperties = {}
  if (anchorRect) {
    const popoverW = 320
    let left = anchorRect.left + anchorRect.width / 2 - popoverW / 2
    let top = anchorRect.bottom + 8

    // Clamp dans le viewport
    if (left < 12) left = 12
    if (left + popoverW > window.innerWidth - 12) left = window.innerWidth - popoverW - 12
    if (top + 300 > window.innerHeight) top = anchorRect.top - 308

    style.position = 'fixed'
    style.left = left
    style.top = top
    style.width = popoverW
  }

  const color = event.owner?.color ?? COLOR_NAOUFEL
  const isEmir = color === COLOR_EMIR
  const ownerName = isEmir ? 'Emir' : event.owner?.name || 'Naoufel'

  return (
    <div className="fixed inset-0 z-50" style={{ pointerEvents: 'auto' }}>
      <div
        ref={ref}
        style={style}
        className="z-50 rounded-xl border border-[var(--border-color)] bg-white shadow-xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Color stripe + close */}
        <div
          className="flex items-start justify-between rounded-t-xl px-4 pt-3 pb-2"
          style={{ backgroundColor: `${color}10` }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
              {event.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="ml-2 flex-shrink-0 rounded-lg p-1 text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3 px-4 py-3">
          {/* Date & time */}
          <div className="flex items-center gap-2.5 text-[13px] text-[var(--text-secondary)]">
            <Clock className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-muted)]" />
            <div>
              <span className="capitalize">{fmtDate(event.start)}</span>
              {!event.allDay && (
                <span className="ml-1">
                  · {fmtTime(event.start)} – {fmtTime(event.end)}
                </span>
              )}
              {event.allDay && <span className="ml-1">· Journée entière</span>}
            </div>
          </div>

          {/* Owner */}
          <div className="flex items-center gap-2.5 text-[13px] text-[var(--text-secondary)]">
            <User className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-muted)]" />
            <span>{ownerName}</span>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-2.5 text-[13px] text-[var(--text-secondary)]">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-muted)]" />
              <span className="truncate">{event.location}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed line-clamp-3 border-t border-[var(--border-color)] pt-2">
              {event.description}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 border-t border-[var(--border-color)] pt-2">
            {event.meetLink && (
              <a
                href={event.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--memovia-violet)] py-2 text-[12px] font-medium text-white hover:bg-[var(--memovia-violet-hover)] transition-colors"
              >
                <Video className="h-3.5 w-3.5" />
                Rejoindre
              </a>
            )}
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color)] py-2 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ouvrir
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
