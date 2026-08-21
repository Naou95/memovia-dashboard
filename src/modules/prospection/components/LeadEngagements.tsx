import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTasks } from '@/hooks/useTasks'
import { splitTasksForLead, TASK_ASSIGNEE_LABELS } from '@/types/tasks'
import type { TaskAssignee } from '@/types/tasks'

// Engagements d'une fiche (mémoire d'entreprise, 21/08/2026) : ce qu'on doit à ce
// contact (ouvertes) + ce qu'on a fait (historique). Le briefing relance déjà les
// tâches échues — rien de nouveau à maintenir ici.

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const selectClass =
  'rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)]'

export function LeadEngagements({ leadId }: { leadId: string }) {
  const { tasks, isLoading, createTask, updateTask } = useTasks()
  const { ouvertes, faites } = splitTasksForLead(tasks, leadId)

  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState<TaskAssignee>('naoufel')
  const [dueDate, setDueDate] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  async function handleAdd() {
    if (!title.trim()) return
    setIsAdding(true)
    try {
      await createTask({
        title: title.trim(),
        description: null,
        status: 'todo',
        priority: 'normale',
        due_date: dueDate || null,
        assigned_to: assignee,
        assignees: [],
        is_private: false,
        created_by: null,
        lead_id: leadId,
      })
      setTitle('')
      setDueDate('')
      toast.success('Engagement ajouté.')
    } catch {
      toast.error("Impossible d'ajouter l'engagement.")
    } finally {
      setIsAdding(false)
    }
  }

  async function handleDone(id: string) {
    try {
      await updateTask(id, { status: 'done' })
      toast.success('Engagement tenu.')
    } catch {
      toast.error('Impossible de mettre à jour.')
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
      <Label>Engagements</Label>

      {isLoading && <p className="text-[13px] text-[var(--text-muted)]">Chargement…</p>}

      {!isLoading && ouvertes.length === 0 && faites.length === 0 && (
        <p className="text-[13px] text-[var(--text-muted)]">Aucun engagement lié à cette fiche.</p>
      )}

      {ouvertes.length > 0 && (
        <ul className="space-y-1.5">
          {ouvertes.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-[13px] text-[var(--text-primary)]">
              <input
                type="checkbox"
                aria-label={`Marquer « ${t.title} » comme fait`}
                onChange={() => handleDone(t.id)}
                className="h-3.5 w-3.5 accent-[var(--memovia-violet)]"
              />
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              {t.assigned_to && (
                <span className="text-[11px] text-[var(--text-muted)]">{TASK_ASSIGNEE_LABELS[t.assigned_to]}</span>
              )}
              {t.due_date && (
                <span className="text-[11px] tabular-nums text-[var(--text-muted)]">{formatDate(t.due_date)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {faites.length > 0 && (
        <details className="text-[13px]">
          <summary className="cursor-pointer text-[var(--text-muted)]">
            {faites.length} engagement{faites.length > 1 ? 's' : ''} tenu{faites.length > 1 ? 's' : ''}
          </summary>
          <ul className="mt-1.5 space-y-1 pl-1">
            {faites.map((t) => (
              <li key={t.id} className="text-[var(--text-muted)] line-through">{t.title}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex : Envoyer le devis promis"
          className="h-8 min-w-0 flex-1 text-[13px]"
        />
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value as TaskAssignee)}
          className={selectClass}
          aria-label="Assigné à"
        >
          <option value="naoufel">Naoufel</option>
          <option value="emir">Emir</option>
        </select>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-8 w-36 text-[13px]"
          aria-label="Échéance"
        />
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 px-2" disabled={isAdding || !title.trim()} onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </Button>
      </div>
    </div>
  )
}
