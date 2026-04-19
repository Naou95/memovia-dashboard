import { useState, useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Task, TaskInsert, TaskStatus, TaskUpdate } from '@/types/tasks'

interface TaskFormProps {
  open: boolean
  onClose: () => void
  task?: Task | null
  onSubmit: (data: TaskInsert | TaskUpdate) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  canDelete?: boolean
  defaultStatus?: TaskStatus
}

interface FormState {
  title: string
  description: string
  status: string
  priority: string
  due_date: string
  assigned_to: string
}

function emptyForm(): FormState {
  return {
    title: '',
    description: '',
    status: 'todo',
    priority: 'normale',
    due_date: '',
    assigned_to: '',
  }
}

function taskToForm(task: Task): FormState {
  return {
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    due_date: task.due_date ?? '',
    assigned_to: task.assigned_to ?? '',
  }
}

const selectClass =
  'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]'

export function TaskForm({ open, onClose, task, onSubmit, onDelete, canDelete, defaultStatus }: TaskFormProps) {
  const isEdit = task != null
  const [form, setForm] = useState<FormState>(emptyForm())
  const [titleError, setTitleError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setForm(task ? taskToForm(task) : { ...emptyForm(), status: defaultStatus ?? 'todo' })
      setTitleError(null)
    }
  }, [open, task, defaultStatus])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      const el = descriptionRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${Math.max(el.scrollHeight, 200)}px`
    }, 0)
    return () => clearTimeout(id)
  }, [open, form.description])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (name === 'title') setTitleError(null)
    if (name === 'description') {
      const el = e.target as HTMLTextAreaElement
      el.style.height = 'auto'
      el.style.height = `${Math.max(el.scrollHeight, 200)}px`
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setTitleError('Le titre de la tâche est requis.')
      return
    }

    setIsSubmitting(true)
    try {
      const payload: TaskInsert = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status as TaskInsert['status'],
        priority: form.priority as TaskInsert['priority'],
        due_date: form.due_date || null,
        assigned_to: (form.assigned_to || null) as TaskInsert['assigned_to'],
        created_by: null,
      }
      await onSubmit(payload)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!task || !onDelete) return
    setIsDeleting(true)
    try {
      await onDelete(task.id)
      onClose()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-[16px] font-semibold text-[var(--text-primary)]">
              {isEdit ? 'Modifier la tâche' : 'Nouvelle tâche'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Titre */}
            <div className="space-y-1.5">
              <Label htmlFor="title">
                Titre <span className="text-[var(--danger)]">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Ex : Préparer la démo client"
                aria-invalid={titleError != null}
              />
              {titleError && <p className="text-[12px] text-[var(--danger)]">{titleError}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <textarea
                ref={descriptionRef}
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Détails, contexte, liens utiles…"
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]"
                style={{ minHeight: 200, fontSize: 14, padding: 12, resize: 'none', overflow: 'hidden' }}
              />
            </div>

            {/* Statut + Priorité */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="status">Statut</Label>
                <select id="status" name="status" value={form.status} onChange={handleChange} className={selectClass}>
                  <option value="todo">À faire</option>
                  <option value="en_cours">En cours</option>
                  <option value="done">Terminé</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="priority">Priorité</Label>
                <select id="priority" name="priority" value={form.priority} onChange={handleChange} className={selectClass}>
                  <option value="haute">Haute</option>
                  <option value="normale">Normale</option>
                  <option value="basse">Basse</option>
                </select>
              </div>
            </div>

            {/* Assigné + Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="assigned_to">Assigné à</Label>
                <select id="assigned_to" name="assigned_to" value={form.assigned_to} onChange={handleChange} className={selectClass}>
                  <option value="">— Non assigné</option>
                  <option value="naoufel">Naoufel</option>
                  <option value="emir">Emir</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="due_date">Date d'échéance</Label>
                <Input
                  id="due_date"
                  name="due_date"
                  type="date"
                  value={form.due_date}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2">
              {isEdit && canDelete && onDelete ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-[13px] text-[var(--danger)] underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {isDeleting ? 'Suppression…' : 'Supprimer'}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? 'Enregistrement…'
                    : isEdit
                    ? 'Enregistrer'
                    : 'Créer la tâche'}
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
