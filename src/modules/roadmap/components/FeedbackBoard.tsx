import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { FeedbackCard } from './FeedbackCard'
import type { FeedbackItemWithVotes, FeedbackStatus } from '@/types/feedback'
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_ORDER,
  FEEDBACK_STATUS_COLORS,
} from '@/types/feedback'

// ─── Draggable card wrapper ───────────────────────────────────────────────────
function DraggableCard({
  item,
  hasVoted,
  isAdmin,
  onVote,
  onEdit,
  onDelete,
}: {
  item: FeedbackItemWithVotes
  hasVoted: boolean
  isAdmin: boolean
  onVote: (id: string) => void
  onEdit: (item: FeedbackItemWithVotes) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: !isAdmin,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <FeedbackCard
        item={item}
        hasVoted={hasVoted}
        isAdmin={isAdmin}
        onVote={onVote}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={isAdmin ? { ...attributes, ...listeners } : undefined}
      />
    </div>
  )
}

// ─── Droppable column ─────────────────────────────────────────────────────────
function Column({
  status,
  items,
  userVotes,
  isAdmin,
  onVote,
  onEdit,
  onDelete,
}: {
  status: FeedbackStatus
  items: FeedbackItemWithVotes[]
  userVotes: Set<string>
  isAdmin: boolean
  onVote: (id: string) => void
  onEdit: (item: FeedbackItemWithVotes) => void
  onDelete: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const colors = FEEDBACK_STATUS_COLORS[status]

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div
        className="flex items-center justify-between rounded-lg px-3 py-2"
        style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: colors.text }}
        >
          {FEEDBACK_STATUS_LABELS[status]}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ backgroundColor: colors.border, color: colors.text }}
        >
          {items.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex flex-col gap-2 min-h-[120px] rounded-[8px] p-2 transition-colors"
        style={{
          backgroundColor: isOver ? 'var(--accent-purple-bg)' : 'var(--bg-secondary)',
          border: `1px dashed ${isOver ? 'var(--memovia-violet)' : 'var(--border-color)'}`,
        }}
      >
        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-6">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Aucun item
            </p>
          </div>
        ) : (
          items.map((item) => (
            <DraggableCard
              key={item.id}
              item={item}
              hasVoted={userVotes.has(item.id)}
              isAdmin={isAdmin}
              onVote={onVote}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Board ────────────────────────────────────────────────────────────────────
interface FeedbackBoardProps {
  items: FeedbackItemWithVotes[]
  userVotes: Set<string>
  isAdmin: boolean
  onVote: (id: string) => void
  onEdit: (item: FeedbackItemWithVotes) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: FeedbackStatus) => Promise<void>
}

export function FeedbackBoard({
  items,
  userVotes,
  isAdmin,
  onVote,
  onEdit,
  onDelete,
  onStatusChange,
}: FeedbackBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const itemsByStatus = FEEDBACK_STATUS_ORDER.reduce<
    Record<FeedbackStatus, FeedbackItemWithVotes[]>
  >(
    (acc, s) => {
      acc[s] = items
        .filter((i) => i.status === s)
        .sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return a.due_date.localeCompare(b.due_date)
        })
      return acc
    },
    { backlog: [], planifie: [], en_dev: [], livre: [] }
  )

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const newStatus = over.id as FeedbackStatus
    const item = items.find((i) => i.id === active.id)
    if (item && item.status !== newStatus) {
      await onStatusChange(item.id, newStatus)
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {FEEDBACK_STATUS_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            items={itemsByStatus[status]}
            userVotes={userVotes}
            isAdmin={isAdmin}
            onVote={onVote}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
      <DragOverlay>
        {activeItem && (
          <div style={{ transform: 'rotate(1.5deg)', opacity: 0.9 }}>
            <FeedbackCard
              item={activeItem}
              hasVoted={userVotes.has(activeItem.id)}
              isAdmin={isAdmin}
              onVote={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
