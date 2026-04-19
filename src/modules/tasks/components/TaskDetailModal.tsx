import { useRef, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Edit2, Calendar, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Task, TaskPriority, TaskAssignee, TaskStatus } from '@/types/tasks'
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_ASSIGNEE_LABELS } from '@/types/tasks'

const PRIORITY_BADGE: Record<TaskPriority, { bg: string; color: string }> = {
  haute: { bg: '#fee2e2', color: '#dc2626' },
  normale: { bg: '#e5e7eb', color: '#4b5563' },
  basse: { bg: '#dbeafe', color: '#2563eb' },
}

const ASSIGNEE_AVATAR: Record<TaskAssignee, { initials: string; bg: string; color: string }> = {
  naoufel: { initials: 'N', bg: '#ede9fe', color: '#7c3aed' },
  emir: { initials: 'E', bg: '#d1fae5', color: '#059669' },
}

const STATUS_STYLE: Record<TaskStatus, { bg: string; color: string }> = {
  todo: { bg: '#f3f4f6', color: '#6b7280' },
  en_cours: { bg: '#fef3c7', color: '#d97706' },
  done: { bg: '#d1fae5', color: '#059669' },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function isOverdue(task: Task): boolean {
  return task.due_date != null && task.status !== 'done' && new Date(task.due_date) < new Date()
}

interface TaskDetailModalProps {
  open: boolean
  task: Task | null
  onClose: () => void
  onEdit: (task: Task) => void
}

export function TaskDetailModal({ open, task, onClose, onEdit }: TaskDetailModalProps) {
  const editRef = useRef<Task | null>(null)

  useEffect(() => {
    if (task) editRef.current = task
  }, [task])

  if (!task && !open) return null

  const t = task ?? editRef.current
  if (!t) return null

  const overdue = isOverdue(t)
  const badge = PRIORITY_BADGE[t.priority]
  const statusStyle = STATUS_STYLE[t.status]
  const assignee = t.assigned_to ? ASSIGNEE_AVATAR[t.assigned_to] : null

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border-color)] px-6 py-5">
            <Dialog.Title className="text-[20px] font-semibold leading-snug text-[var(--text-primary)]">
              {t.title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="mt-0.5 shrink-0 rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="space-y-5 px-6 py-5">
            {/* Description */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Description
              </p>
              {t.description ? (
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--text-primary)]">
                  {t.description}
                </p>
              ) : (
                <p className="text-[13px] italic text-[var(--text-muted)]">Aucune description.</p>
              )}
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {/* Statut */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Statut
                </p>
                <span
                  className="inline-flex items-center rounded-md px-2.5 py-1 text-[12px] font-semibold"
                  style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                >
                  {TASK_STATUS_LABELS[t.status]}
                </span>
              </div>

              {/* Priorité */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Priorité
                </p>
                <span
                  className="inline-flex items-center rounded-md px-2.5 py-1 text-[12px] font-semibold"
                  style={{ backgroundColor: badge.bg, color: badge.color }}
                >
                  {TASK_PRIORITY_LABELS[t.priority]}
                </span>
              </div>

              {/* Assigné */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Assigné à
                </p>
                {assignee ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: assignee.bg, color: assignee.color }}
                    >
                      {assignee.initials}
                    </span>
                    <span className="text-[13px] text-[var(--text-primary)]">
                      {TASK_ASSIGNEE_LABELS[t.assigned_to!]}
                    </span>
                  </div>
                ) : (
                  <span className="text-[13px] text-[var(--text-muted)]">Non assigné</span>
                )}
              </div>

              {/* Échéance */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Échéance
                </p>
                {t.due_date ? (
                  <span
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium"
                    style={{ color: overdue ? '#dc2626' : 'var(--text-primary)' }}
                  >
                    {overdue ? (
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {formatDate(t.due_date)}
                    {overdue && (
                      <span className="text-[11px] font-normal text-red-500">(En retard)</span>
                    )}
                  </span>
                ) : (
                  <span className="text-[13px] text-[var(--text-muted)]">Aucune date</span>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-[var(--border-color)] px-6 py-4">
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
            <Button
              onClick={() => {
                onClose()
                onEdit(t)
              }}
            >
              <Edit2 className="mr-1.5 h-3.5 w-3.5" />
              Modifier
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
