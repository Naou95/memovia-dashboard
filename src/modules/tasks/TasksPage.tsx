import { useState } from 'react'
import { Plus, Filter, ArrowUpDown, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { useTasks } from '@/hooks/useTasks'
import { useAuth } from '@/contexts/AuthContext'
import { TaskKanban } from './components/TaskKanban'
import { TaskForm } from './components/TaskForm'
import { TaskDetailModal } from './components/TaskDetailModal'
import type { Task, TaskStatus, TaskInsert, TaskUpdate } from '@/types/tasks'

export default function TasksPage() {
  const { tasks, isLoading, error, createTask, updateTask, deleteTask } = useTasks()
  const { user } = useAuth()

  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo')
  const [detailOpen, setDetailOpen] = useState(false)
  const [viewingTask, setViewingTask] = useState<Task | null>(null)

  function handleNewTask(status?: TaskStatus) {
    setEditingTask(null)
    setDefaultStatus(status ?? 'todo')
    setFormOpen(true)
  }

  function handleView(task: Task) {
    setViewingTask(task)
    setDetailOpen(true)
  }

  function handleDetailClose() {
    setDetailOpen(false)
    setViewingTask(null)
  }

  function handleDetailEdit(task: Task) {
    setDetailOpen(false)
    setViewingTask(null)
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
    } catch {
      toast.error('Impossible de déplacer la tâche.')
    }
  }

  const canDelete = user?.role === 'admin_full'

  return (
    <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="show">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem} className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Tâches
        </h1>
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
            <span>Tout</span>
            <span className="text-[var(--text-muted)]">· 3 vues</span>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleNewTask()}
              className="h-8 gap-1.5 px-3 text-[13px]"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouvelle tâche
            </Button>
            <button className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)]">
              <Filter className="h-3.5 w-3.5" />
              Filtrer
            </button>
            <button className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)]">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Trier
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {error && !isLoading && (
        <motion.div
          variants={staggerItem}
          className="rounded-md border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          {error}
        </motion.div>
      )}

      {/* ── Kanban ───────────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem}>
        <TaskKanban
          tasks={tasks}
          isLoading={isLoading}
          onView={handleView}
          onStatusChange={handleStatusChange}
          onNewTask={handleNewTask}
        />
      </motion.div>

      {/* ── Detail Modal ─────────────────────────────────────────────────────── */}
      <TaskDetailModal
        open={detailOpen}
        task={viewingTask}
        onClose={handleDetailClose}
        onEdit={handleDetailEdit}
      />

      {/* ── Modal Form ───────────────────────────────────────────────────────── */}
      <TaskForm
        open={formOpen}
        onClose={handleFormClose}
        task={editingTask}
        onSubmit={handleFormSubmit}
        onDelete={handleDelete}
        canDelete={canDelete}
        defaultStatus={defaultStatus}
      />
    </motion.div>
  )
}
