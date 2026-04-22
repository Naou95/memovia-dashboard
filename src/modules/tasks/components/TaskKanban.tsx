import { useState, useRef, useEffect } from 'react'
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
  MoreHorizontal,
  Plus,
  Calendar,
  Paperclip,
  MessageSquare,
  AlertCircle,
  Lock,
} from 'lucide-react'
import type { Task, TaskStatus, TaskPriority, TaskAssignee } from '@/types/tasks'
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER, TASK_PRIORITY_LABELS } from '@/types/tasks'

interface TaskKanbanProps {
  tasks: Task[]
  isLoading: boolean
  onView: (task: Task) => void
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>
  onNewTask: (status: TaskStatus) => void
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function isOverdue(task: Task): boolean {
  return task.due_date != null && task.status !== 'done' && new Date(task.due_date) < new Date()
}

const COLUMN_DOT: Record<TaskStatus, string> = {
  todo: '#9ca3af',
  en_cours: '#f59e0b',
  done: '#10b981',
}

const PRIORITY_BADGE: Record<TaskPriority, { bg: string; color: string }> = {
  haute: { bg: '#fee2e2', color: '#dc2626' },
  normale: { bg: '#ffedd5', color: '#ea580c' },
  basse: { bg: '#dbeafe', color: '#2563eb' },
}

const ASSIGNEE_AVATAR: Record<TaskAssignee, { initials: string; bg: string; color: string }> = {
  naoufel: { initials: 'N', bg: '#ede9fe', color: '#7c3aed' },
  emir: { initials: 'E', bg: '#d1fae5', color: '#059669' },
}

function getEffectiveAssignees(task: Task): TaskAssignee[] {
  if (task.assignees && task.assignees.length > 0) {
    return task.assignees.filter((a): a is TaskAssignee => a in ASSIGNEE_AVATAR)
  }
  if (task.assigned_to) return [task.assigned_to]
  return []
}

// ── Card content ─────────────────────────────────────────────────────────────────

interface CardContentProps {
  task: Task
  onView?: (t: Task) => void
  isOverlay?: boolean
  isPlaceholder?: boolean
}

function CardContent({ task, onView, isOverlay, isPlaceholder }: CardContentProps) {
  const overdue = isOverdue(task)
  const badge = PRIORITY_BADGE[task.priority]

  return (
    <div
      className={[
        'group rounded-lg bg-[var(--bg-secondary)]',
        isPlaceholder
          ? 'border border-dashed border-[var(--memovia-violet)] opacity-30 pointer-events-none'
          : isOverlay
          ? 'border border-[var(--memovia-violet)] shadow-[0_12px_32px_rgba(0,0,0,0.18)]'
          : 'border border-[var(--border-color)] shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all duration-150 hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)] hover:scale-[1.01]',
      ].join(' ')}
      style={isOverlay ? { transform: 'rotate(1.5deg)' } : undefined}
    >
      <div className="px-5 py-4 space-y-2" style={{ minHeight: 140 }}>
        {/* Row 1: priority badge + ··· */}
        <div className="flex items-center justify-between min-h-[20px]">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none"
            style={{ backgroundColor: badge.bg, color: badge.color }}
          >
            {TASK_PRIORITY_LABELS[task.priority]}
          </span>
          {!isOverlay && !isPlaceholder && onView && (
            <button
              onClick={(e) => { e.stopPropagation(); onView(task) }}
              className="rounded p-0.5 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--bg-secondary)] hover:text-[var(--text-secondary)]"
              aria-label="Options"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Row 2: title */}
        <p
          className={[
            'text-[15px] font-semibold leading-snug',
            task.status === 'done'
              ? 'line-through text-[var(--text-muted)]'
              : 'text-[var(--text-primary)]',
          ].join(' ')}
        >
          {task.title}
        </p>

        {/* Row 3: description */}
        {task.description && (
          <p className="text-[12px] leading-relaxed text-[var(--text-muted)] line-clamp-3">
            {task.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 pt-3">
          {task.due_date && (
            <span
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: overdue ? '#fee2e2' : 'var(--bg-secondary)',
                color: overdue ? '#dc2626' : 'var(--text-muted)',
              }}
            >
              {overdue ? (
                <AlertCircle className="h-3 w-3 shrink-0" />
              ) : (
                <Calendar className="h-3 w-3 shrink-0" />
              )}
              {formatDate(task.due_date)}
            </span>
          )}

          <span className="flex items-center gap-0.5 text-[11px] text-[var(--text-muted)]">
            <Paperclip className="h-3 w-3" />
            <span>0</span>
          </span>

          <span className="flex items-center gap-0.5 text-[11px] text-[var(--text-muted)]">
            <MessageSquare className="h-3 w-3" />
            <span>0</span>
          </span>

          {task.is_private && (
            <span title="Tâche privée">
              <Lock className="h-3 w-3 text-[var(--memovia-violet)]" />
            </span>
          )}

          {(() => {
            const effAssignees = getEffectiveAssignees(task)
            if (effAssignees.length === 0) return null
            return (
              <div className="ml-auto flex shrink-0 items-center">
                {effAssignees.map((key, i) => {
                  const av = ASSIGNEE_AVATAR[key]
                  return (
                    <span
                      key={key}
                      className="flex items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-white"
                      style={{
                        width: 24,
                        height: 24,
                        backgroundColor: av.bg,
                        color: av.color,
                        marginLeft: i > 0 ? -8 : 0,
                      }}
                    >
                      {av.initials}
                    </span>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ── Draggable card ────────────────────────────────────────────────────────────────

function DraggableCard({ task, onView }: { task: Task; onView: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })
  const didDragRef = useRef(false)

  useEffect(() => {
    if (isDragging) didDragRef.current = true
  }, [isDragging])

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
    transition: isDragging ? undefined : 'transform 200ms ease',
  }

  function handleClick() {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    onView(task)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className="cursor-pointer active:cursor-grabbing focus:outline-none"
    >
      {isDragging ? (
        <CardContent task={task} isPlaceholder />
      ) : (
        <CardContent task={task} onView={onView} />
      )}
    </div>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-4 space-y-2">
      <div className="h-3 w-10 animate-pulse rounded bg-[var(--border-color)]" />
      <div className="h-4 animate-pulse rounded bg-[var(--border-color)]" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--border-color)]" />
      <div className="flex items-center gap-2 pt-1">
        <div className="h-3 w-14 animate-pulse rounded bg-[var(--border-color)]" />
        <div className="h-3 w-6 animate-pulse rounded bg-[var(--border-color)]" />
      </div>
    </div>
  )
}

// ── Droppable column ──────────────────────────────────────────────────────────────

interface DroppableColumnProps {
  status: TaskStatus
  tasks: Task[]
  isLoading: boolean
  onView: (task: Task) => void
  onNewTask: (status: TaskStatus) => void
  activeTaskId: string | null
}

function DroppableColumn({ status, tasks, isLoading, onView, onNewTask, activeTaskId }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const dot = COLUMN_DOT[status]

  return (
    <div className="flex min-w-[280px] flex-1 flex-col rounded-[10px] bg-[var(--bg-primary)] p-2.5">
      {/* Column header — transparent, inside grey column */}
      <div className="mb-2 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            {TASK_STATUS_LABELS[status]}
          </span>
          <span
            className="rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)]"
          >
            {isLoading ? '—' : tasks.length}
          </span>
        </div>
        <div className="flex items-center">
          <button
            className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-secondary)]"
            aria-label="Options colonne"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onNewTask(status)}
            className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-secondary)]"
            aria-label="Nouvelle tâche"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-[10px] rounded-lg transition-colors"
        style={{
          minHeight: 80,
          backgroundColor: isOver ? 'color-mix(in oklab, var(--memovia-violet) 8%, var(--bg-primary))' : 'transparent',
          outline: isOver ? '2px dashed var(--memovia-violet)' : '2px dashed transparent',
          outlineOffset: '-2px',
        }}
      >
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : tasks.length === 0 && !activeTaskId ? (
          <div className="rounded-lg border border-dashed border-[var(--border-color)] px-3 py-8 text-center">
            <p className="text-[11px] text-[var(--text-muted)]">Aucune tâche</p>
          </div>
        ) : (
          tasks.map((task) => (
            <DraggableCard key={task.id} task={task} onView={onView} />
          ))
        )}
      </div>
    </div>
  )
}

// ── Main Kanban ───────────────────────────────────────────────────────────────────

export function TaskKanban({ tasks, isLoading, onView, onStatusChange, onNewTask }: TaskKanbanProps) {
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
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4">
          {TASK_STATUS_ORDER.map((status) => (
            <DroppableColumn
              key={status}
              status={status}
              tasks={tasks.filter((t) => t.status === status)}
              isLoading={isLoading}
              onView={onView}
              onNewTask={onNewTask}
              activeTaskId={activeTask?.id ?? null}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
        {activeTask ? (
          <div style={{ width: 280 }}>
            <CardContent task={activeTask} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
