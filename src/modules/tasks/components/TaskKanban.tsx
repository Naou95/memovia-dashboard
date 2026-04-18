import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Pencil,
  CalendarClock,
  AlertCircle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
} from 'lucide-react'
import type { Task, TaskStatus, TaskPriority } from '@/types/tasks'
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  TASK_ASSIGNEE_LABELS,
} from '@/types/tasks'

interface TaskKanbanProps {
  tasks: Task[]
  isLoading: boolean
  onEdit: (task: Task) => void
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function isOverdue(task: Task): boolean {
  return (
    task.due_date != null &&
    task.status !== 'done' &&
    new Date(task.due_date) < new Date()
  )
}

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  todo: 'var(--text-label)',
  en_cours: 'var(--memovia-violet)',
  done: 'var(--success)',
}

const PRIORITY_ICON: Record<TaskPriority, React.ReactNode> = {
  haute: <ArrowUp className="h-3 w-3 text-[var(--danger)]" />,
  normale: <ArrowRight className="h-3 w-3 text-[var(--text-muted)]" />,
  basse: <ArrowDown className="h-3 w-3 text-[var(--accent-blue)]" />,
}

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  haute: 'var(--danger)',
  normale: 'var(--text-muted)',
  basse: 'var(--accent-blue)',
}

// ── Card content ───────────────────────────────────────────────────────────────

interface CardContentProps {
  task: Task
  onEdit?: (t: Task) => void
  dragHandleProps?: Record<string, unknown>
  isOverlay?: boolean
  isPlaceholder?: boolean
}

function CardContent({ task, onEdit, dragHandleProps, isOverlay, isPlaceholder }: CardContentProps) {
  const overdue = isOverdue(task)

  return (
    <div
      className={[
        'group rounded-xl border bg-[var(--bg-primary)] transition-all',
        isPlaceholder
          ? 'border-dashed border-[var(--memovia-violet)] opacity-30 pointer-events-none'
          : isOverlay
          ? 'border-[var(--memovia-violet)] shadow-[0_12px_32px_rgba(0,0,0,0.18)]'
          : 'border-[var(--border-color)] hover:border-[var(--memovia-violet)] hover:shadow-sm cursor-default',
      ].join(' ')}
      style={isOverlay ? { transform: 'rotate(1.5deg)' } : undefined}
    >
      <div className="flex items-start gap-2 p-3">
        {/* Drag handle */}
        <div
          {...(dragHandleProps ?? {})}
          className={[
            'mt-0.5 shrink-0 rounded p-0.5 transition-colors',
            isOverlay || isPlaceholder
              ? 'text-[var(--text-muted)]'
              : 'cursor-grab text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-secondary)] active:cursor-grabbing',
          ].join(' ')}
          aria-label="Déplacer"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        {/* Card body */}
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <span
              className={[
                'text-[13px] font-medium leading-tight',
                task.status === 'done'
                  ? 'line-through text-[var(--text-muted)]'
                  : 'text-[var(--text-primary)]',
              ].join(' ')}
            >
              {task.title}
            </span>
            {!isOverlay && !isPlaceholder && onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(task) }}
                className="shrink-0 rounded p-0.5 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--memovia-violet)]"
                aria-label="Modifier"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
              {task.description}
            </p>
          )}

          {/* Chips row */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {/* Priority */}
            <span
              className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: `color-mix(in oklab, ${PRIORITY_COLOR[task.priority]} 12%, var(--bg-secondary))`,
                color: PRIORITY_COLOR[task.priority],
              }}
            >
              {PRIORITY_ICON[task.priority]}
              {task.priority === 'haute' ? 'Haute' : task.priority === 'normale' ? 'Normale' : 'Basse'}
            </span>

            {/* Assignee */}
            {task.assigned_to && (
              <span className="rounded-full bg-[var(--accent-purple-bg)] px-2 py-0.5 text-[11px] text-[var(--memovia-violet)]">
                {TASK_ASSIGNEE_LABELS[task.assigned_to]}
              </span>
            )}
          </div>

          {/* Due date */}
          {task.due_date && (
            <div
              className="mt-2 flex items-center gap-1 text-[11px]"
              style={{ color: overdue ? 'var(--danger)' : 'var(--text-muted)' }}
            >
              {overdue ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <CalendarClock className="h-3 w-3" />
              )}
              <span>{formatDate(task.due_date)}{overdue ? ' · En retard' : ''}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Draggable card ─────────────────────────────────────────────────────────────

function DraggableCard({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
    transition: isDragging ? undefined : 'transform 200ms ease',
  }

  return (
    <div ref={setNodeRef} style={style}>
      {isDragging ? (
        <CardContent task={task} isPlaceholder />
      ) : (
        <CardContent task={task} onEdit={onEdit} dragHandleProps={{ ...attributes, ...listeners }} />
      )}
    </div>
  )
}

// ── Droppable column ───────────────────────────────────────────────────────────

interface DroppableColumnProps {
  status: TaskStatus
  tasks: Task[]
  isLoading: boolean
  onEdit: (task: Task) => void
  activeTaskId: string | null
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 space-y-2">
      <div className="h-4 animate-pulse rounded bg-[var(--border-color)]" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--border-color)]" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--border-color)]" />
    </div>
  )
}

function DroppableColumn({ status, tasks, isLoading, onEdit, activeTaskId }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const accent = COLUMN_ACCENT[status]

  return (
    <div className="flex w-[260px] shrink-0 flex-col gap-2">
      {/* Column header */}
      <div
        className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2.5 transition-colors"
        style={{
          borderTopWidth: 2,
          borderTopColor: accent,
          backgroundColor: isOver
            ? 'color-mix(in oklab, var(--memovia-violet) 6%, var(--bg-secondary))'
            : undefined,
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">
            {TASK_STATUS_LABELS[status]}
          </span>
          <span className="rounded-full bg-[var(--bg-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
            {isLoading ? '—' : tasks.length}
          </span>
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-2 rounded-xl p-1 transition-colors"
        style={{
          minHeight: 80,
          backgroundColor: isOver
            ? 'color-mix(in oklab, var(--memovia-violet) 5%, var(--bg-primary))'
            : 'transparent',
          outline: isOver ? `2px dashed ${accent}` : '2px dashed transparent',
          outlineOffset: '-2px',
        }}
      >
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : tasks.length === 0 && !activeTaskId ? (
          <div className="rounded-xl border border-dashed border-[var(--border-color)] px-3 py-6 text-center">
            <p className="text-[11px] text-[var(--text-muted)]">Aucune tâche</p>
          </div>
        ) : (
          tasks.map((task) => (
            <DraggableCard key={task.id} task={task} onEdit={onEdit} />
          ))
        )}
      </div>
    </div>
  )
}

// ── Main Kanban ────────────────────────────────────────────────────────────────

export function TaskKanban({ tasks, isLoading, onEdit, onStatusChange }: TaskKanbanProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return
    const newStatus = over.id as TaskStatus
    const task = tasks.find((t) => t.id === active.id)
    if (!task || task.status === newStatus) return

    await onStatusChange(task.id, newStatus)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {TASK_STATUS_ORDER.map((status) => (
            <DroppableColumn
              key={status}
              status={status}
              tasks={tasks.filter((t) => t.status === status)}
              isLoading={isLoading}
              onEdit={onEdit}
              activeTaskId={activeTask?.id ?? null}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
        {activeTask ? (
          <div style={{ width: 260 }}>
            <CardContent task={activeTask} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
