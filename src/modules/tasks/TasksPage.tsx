import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { useTasks } from '@/hooks/useTasks'
import { useAuth } from '@/contexts/AuthContext'
import { TaskStats } from './components/TaskStats'
import { TaskKanban } from './components/TaskKanban'
import { TaskForm } from './components/TaskForm'
import type { Task, TaskStatus, TaskAssignee, TaskPriority, TaskInsert, TaskUpdate } from '@/types/tasks'

type FilterAssignee = TaskAssignee | null
type FilterPriority = TaskPriority | null

const ASSIGNEE_FILTERS: { label: string; value: FilterAssignee }[] = [
  { label: 'Tous', value: null },
  { label: 'Naoufel', value: 'naoufel' },
  { label: 'Emir', value: 'emir' },
]

const PRIORITY_FILTERS: { label: string; value: FilterPriority }[] = [
  { label: 'Toutes', value: null },
  { label: 'Haute', value: 'haute' },
  { label: 'Normale', value: 'normale' },
  { label: 'Basse', value: 'basse' },
]

export default function TasksPage() {
  const { tasks, isLoading, error, createTask, updateTask, deleteTask } = useTasks()
  const { user } = useAuth()

  const [filterAssignee, setFilterAssignee] = useState<FilterAssignee>(null)
  const [filterPriority, setFilterPriority] = useState<FilterPriority>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const filteredTasks = tasks
    .filter((t) => filterAssignee == null || t.assigned_to === filterAssignee)
    .filter((t) => filterPriority == null || t.priority === filterPriority)

  const activeCount = tasks.filter((t) => t.status !== 'done').length

  function handleNewTask() {
    setEditingTask(null)
    setFormOpen(true)
  }

  function handleEdit(task: Task) {
    setEditingTask(task)
    setFormOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setEditingTask(null)
  }

  async function handleFormSubmit(data: TaskInsert | TaskUpdate) {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, data as TaskUpdate)
        toast.success('Tâche mise à jour.')
      } else {
        await createTask(data as TaskInsert)
        toast.success('Tâche créée avec succès.')
      }
      handleFormClose()
    } catch {
      toast.error('Une erreur est survenue. Veuillez réessayer.')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTask(id)
      toast.success('Tâche supprimée.')
    } catch {
      toast.error('Impossible de supprimer la tâche.')
    }
  }

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    try {
      await updateTask(taskId, { status: newStatus })
      toast.success(
        newStatus === 'done'
          ? 'Tâche marquée comme terminée.'
          : newStatus === 'en_cours'
          ? 'Tâche déplacée en cours.'
          : 'Tâche remise à faire.'
      )
    } catch {
      toast.error('Impossible de déplacer la tâche.')
    }
  }

  const canDelete = user?.role === 'admin_full'
  const hasFilters = filterAssignee != null || filterPriority != null

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.header variants={staggerItem} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tighter text-[var(--text-primary)]">
              Tâches
            </h2>
            {!isLoading && (
              <span className="rounded-full bg-[var(--accent-purple-bg)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--memovia-violet)]">
                {activeCount} actives
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Kanban partagé Naoufel · Emir — synchronisé en temps réel.
          </p>
        </div>

        <Button onClick={handleNewTask} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nouvelle tâche
        </Button>
      </motion.header>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {error && !isLoading && (
        <motion.div variants={staggerItem} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </motion.div>
      )}

      {/* ── KPI Stats ────────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem}>
        <TaskStats tasks={tasks} isLoading={isLoading} />
      </motion.div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <motion.div
        variants={staggerItem}
        className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl px-4 py-3"
        style={{
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        {/* Assigné */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
            Assigné
          </span>
          {ASSIGNEE_FILTERS.map((pill) => {
            const isActive = filterAssignee === pill.value
            return (
              <button
                key={pill.label}
                onClick={() => setFilterAssignee(pill.value)}
                className="rounded-full px-3 py-1 text-[12px] font-medium transition-all"
                style={
                  isActive
                    ? { backgroundColor: 'var(--memovia-violet)', color: '#fff' }
                    : {
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                      }
                }
              >
                {pill.label}
              </button>
            )
          })}
        </div>

        {/* Divider */}
        <div className="hidden h-5 w-px sm:block" style={{ backgroundColor: 'var(--border-color)' }} />

        {/* Priorité */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
            Priorité
          </span>
          {PRIORITY_FILTERS.map((pill) => {
            const isActive = filterPriority === pill.value
            return (
              <button
                key={pill.label}
                onClick={() => setFilterPriority(pill.value)}
                className="rounded-full px-3 py-1 text-[12px] font-medium transition-all"
                style={
                  isActive
                    ? {
                        backgroundColor: 'color-mix(in oklab, var(--memovia-violet) 14%, var(--bg-primary))',
                        color: 'var(--memovia-violet)',
                        border: '1px solid var(--memovia-violet)',
                      }
                    : {
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                      }
                }
              >
                {pill.label}
              </button>
            )
          })}
        </div>

        {/* Reset */}
        {hasFilters && (
          <button
            onClick={() => { setFilterAssignee(null); setFilterPriority(null) }}
            className="ml-auto text-[12px] text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-secondary)] hover:underline"
          >
            Réinitialiser
          </button>
        )}
      </motion.div>

      {/* ── Kanban ───────────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem}>
        <TaskKanban
          tasks={filteredTasks}
          isLoading={isLoading}
          onEdit={handleEdit}
          onStatusChange={handleStatusChange}
        />
      </motion.div>

      {/* ── Modal Form ───────────────────────────────────────────────────────── */}
      <TaskForm
        open={formOpen}
        onClose={handleFormClose}
        task={editingTask}
        onSubmit={handleFormSubmit}
        onDelete={handleDelete}
        canDelete={canDelete}
      />
    </motion.div>
  )
}
