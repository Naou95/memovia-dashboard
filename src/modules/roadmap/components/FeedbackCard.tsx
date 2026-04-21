import { ChevronUp, MoreVertical, Trash2, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FeedbackItemWithVotes } from '@/types/feedback'
import { FEEDBACK_CATEGORY_LABELS, FEEDBACK_CATEGORY_COLORS } from '@/types/feedback'

interface FeedbackCardProps {
  item: FeedbackItemWithVotes
  hasVoted: boolean
  isAdmin: boolean
  onVote: (id: string) => void
  onEdit: (item: FeedbackItemWithVotes) => void
  onDelete: (id: string) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function FeedbackCard({
  item,
  hasVoted,
  isAdmin,
  onVote,
  onEdit,
  onDelete,
  dragHandleProps,
}: FeedbackCardProps) {
  const catColor = FEEDBACK_CATEGORY_COLORS[item.category]

  return (
    <div
      className={['rounded-xl border p-3 flex flex-col gap-2 transition-shadow hover:shadow-sm', isAdmin ? 'cursor-pointer' : ''].join(' ')}
      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
      onClick={() => isAdmin && onEdit(item)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: catColor.bg, color: catColor.text }}
        >
          {FEEDBACK_CATEGORY_LABELS[item.category]}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && (
            <div
              {...dragHandleProps}
              className="cursor-grab p-0.5"
              style={{ color: 'var(--text-muted)' }}
              title="Déplacer"
            >
              <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                <circle cx="3" cy="2" r="1.5" />
                <circle cx="7" cy="2" r="1.5" />
                <circle cx="3" cy="7" r="1.5" />
                <circle cx="7" cy="7" r="1.5" />
                <circle cx="3" cy="12" r="1.5" />
                <circle cx="7" cy="12" r="1.5" />
              </svg>
            </div>
          )}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-500 focus:text-red-500"
                  onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
                >
                  <Trash2 size={14} className="mr-2" /> Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Title + description */}
      <div>
        <p
          className="text-sm font-semibold leading-snug"
          style={{ color: 'var(--text-primary)' }}
        >
          {item.title}
        </p>
        {item.description && (
          <p className="mt-0.5 text-xs line-clamp-2" style={{ color: 'var(--text-muted)' }}>
            {item.description}
          </p>
        )}
      </div>

      {/* Due date badge */}
      {item.due_date && (
        <div className="flex items-center gap-1">
          <CalendarClock size={11} style={{ color: 'var(--text-muted)' }} />
          <span
            className="rounded-md border px-1.5 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
          >
            {new Date(item.due_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
        {item.author_name ? (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {item.author_name}
          </span>
        ) : (
          <span />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onVote(item.id) }}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
          style={
            hasVoted
              ? {
                  backgroundColor: 'var(--accent-purple-bg)',
                  color: 'var(--memovia-violet)',
                }
              : {
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                }
          }
        >
          <ChevronUp size={14} strokeWidth={hasVoted ? 3 : 2} />
          {item.vote_count}
        </button>
      </div>
    </div>
  )
}
