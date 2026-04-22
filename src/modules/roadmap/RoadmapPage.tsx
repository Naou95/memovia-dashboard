import { useState } from 'react'
import { Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { useFeedback } from '@/hooks/useFeedback'
import { useAuth } from '@/contexts/AuthContext'
import { RoadmapStats } from './components/RoadmapStats'
import { FeedbackBoard } from './components/FeedbackBoard'
import { FeedbackForm } from './components/FeedbackForm'
import type {
  FeedbackItemWithVotes,
  FeedbackCategory,
  FeedbackItemInsert,
} from '@/types/feedback'
import { FEEDBACK_CATEGORY_LABELS } from '@/types/feedback'

const CATEGORY_FILTERS: Array<{ value: FeedbackCategory | 'all'; label: string }> = [
  { value: 'all', label: 'Toutes' },
  { value: 'fonctionnalite', label: FEEDBACK_CATEGORY_LABELS.fonctionnalite },
  { value: 'bug', label: FEEDBACK_CATEGORY_LABELS.bug },
  { value: 'amelioration', label: FEEDBACK_CATEGORY_LABELS.amelioration },
]

const pillBase: React.CSSProperties = {
  padding: '0.25rem 0.75rem',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
  border: '1px solid var(--border-color)',
  transition: 'all 0.15s',
}

export default function RoadmapPage() {
  const { user } = useAuth()
  const isAdmin = !!user

  const {
    items,
    userVotes,
    isLoading,
    error,
    toggleVote,
    createItem,
    updateItem,
    updateStatus,
    deleteItem,
  } = useFeedback()

  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | 'all'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<FeedbackItemWithVotes | null>(null)

  const filteredItems =
    categoryFilter === 'all' ? items : items.filter((i) => i.category === categoryFilter)

  const handleEdit = (item: FeedbackItemWithVotes) => {
    setEditTarget(item)
    setFormOpen(true)
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setEditTarget(null)
  }

  const handleFormSubmit = async (data: FeedbackItemInsert) => {
    if (editTarget) {
      await updateItem(editTarget.id, data)
    } else {
      await createItem(data)
    }
  }

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Roadmap & Feedback
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Idées, demandes et avancement produit MEMOVIA.
          </p>
        </div>
        {isAdmin && (
          <Button variant="brand" size="sm" onClick={() => setFormOpen(true)} className="h-8 gap-1.5 px-3 text-[13px]">
            <Plus className="h-3.5 w-3.5" />
            Nouvelle idée
          </Button>
        )}
      </motion.div>

      {/* Error banner */}
      {error && !isLoading && (
        <motion.div
          variants={staggerItem}
          className="rounded-[8px] border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          {error}
        </motion.div>
      )}

      {/* Stats */}
      <motion.div variants={staggerItem}>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-20 skeleton rounded-[8px]"
              />
            ))}
          </div>
        ) : (
          <RoadmapStats items={items} />
        )}
      </motion.div>

      {/* Category filter */}
      <motion.div variants={staggerItem} className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setCategoryFilter(f.value)}
            style={
              categoryFilter === f.value
                ? {
                    ...pillBase,
                    backgroundColor: 'var(--memovia-violet)',
                    color: '#fff',
                    borderColor: 'var(--memovia-violet)',
                  }
                : {
                    ...pillBase,
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-secondary)',
                  }
            }
          >
            {f.label}
          </button>
        ))}
      </motion.div>

      {/* Board */}
      <motion.div variants={staggerItem}>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-64 skeleton rounded-[8px]"
              />
            ))}
          </div>
        ) : (
          <FeedbackBoard
            items={filteredItems}
            userVotes={userVotes}
            isAdmin={isAdmin}
            onVote={toggleVote}
            onEdit={handleEdit}
            onDelete={deleteItem}
            onStatusChange={updateStatus}
          />
        )}
      </motion.div>

      {/* Create / Edit form */}
      <FeedbackForm
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialItem={editTarget}
      />
    </motion.div>
  )
}
