import { useState } from 'react'
import { Plus, LayoutList, Kanban } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { useLeads } from '@/hooks/useLeads'
import { useAuth } from '@/contexts/AuthContext'
import { LeadStats } from './components/LeadStats'
import { LeadTable } from './components/LeadTable'
import { LeadKanban } from './components/LeadKanban'
import { LeadForm } from './components/LeadForm'
import type { Lead, LeadStatus, LeadAssignee, LeadInsert, LeadUpdate } from '@/types/leads'
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER } from '@/types/leads'

type ViewMode = 'table' | 'kanban'

const STATUS_FILTERS: { label: string; value: LeadStatus | null }[] = [
  { label: 'Tous', value: null },
  ...LEAD_STATUS_ORDER.map((s) => ({ label: LEAD_STATUS_LABELS[s], value: s })),
]

const ASSIGNEE_FILTERS: { label: string; value: LeadAssignee | null }[] = [
  { label: 'Tous', value: null },
  { label: 'Naoufel', value: 'naoufel' },
  { label: 'Emir', value: 'emir' },
]

export default function ProspectionPage() {
  const { leads, isLoading, error, createLead, updateLead, deleteLead } = useLeads()
  const { user } = useAuth()

  const [view, setView] = useState<ViewMode>('table')
  const [filterStatus, setFilterStatus] = useState<LeadStatus | null>(null)
  const [filterAssignee, setFilterAssignee] = useState<LeadAssignee | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)

  const filteredLeads = leads
    .filter((l) => filterStatus == null || l.status === filterStatus)
    .filter((l) => filterAssignee == null || l.assigned_to === filterAssignee)

  const activeCount = leads.filter((l) => !['gagne', 'perdu'].includes(l.status)).length

  function handleNewLead() {
    setEditingLead(null)
    setFormOpen(true)
  }

  function handleEdit(lead: Lead) {
    setEditingLead(lead)
    setFormOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setEditingLead(null)
  }

  async function handleFormSubmit(data: LeadInsert | LeadUpdate) {
    try {
      if (editingLead) {
        await updateLead(editingLead.id, data as LeadUpdate)
        toast.success('Lead mis à jour.')
      } else {
        await createLead(data as LeadInsert)
        toast.success('Lead créé avec succès.')
      }
      handleFormClose()
    } catch {
      toast.error('Une erreur est survenue. Veuillez réessayer.')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteLead(id)
      toast.success('Lead supprimé.')
    } catch {
      toast.error('Impossible de supprimer le lead.')
    }
  }

  async function handleStatusChange(leadId: string, newStatus: LeadStatus) {
    try {
      await updateLead(leadId, { status: newStatus })
      toast.success(`Lead déplacé vers « ${LEAD_STATUS_LABELS[newStatus]} ».`)
    } catch {
      toast.error('Impossible de déplacer le lead.')
    }
  }

  const canDelete = user?.role === 'admin_full'

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.header variants={staggerItem} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              Prospection CRM
            </h1>
            {!isLoading && (
              <span className="rounded-full bg-[var(--accent-purple-bg)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--memovia-violet)]">
                {activeCount} actifs
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Pipeline de leads et suivi commercial MEMOVIA AI.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div
            className="flex items-center rounded-lg p-1"
            style={{
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            {([['table', 'Tableau', LayoutList], ['kanban', 'Kanban', Kanban]] as const).map(
              ([mode, label, Icon]) => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  aria-pressed={view === mode}
                  aria-label={`Vue ${label}`}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-2"
                  style={
                    view === mode
                      ? { backgroundColor: 'var(--memovia-violet)', color: '#fff' }
                      : { color: 'var(--text-secondary)' }
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              )
            )}
          </div>

          <Button onClick={handleNewLead} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nouveau lead
          </Button>
        </div>
      </motion.header>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {error && !isLoading && (
        <motion.div variants={staggerItem} className="rounded-md border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </motion.div>
      )}

      {/* ── KPI Stats ────────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem}>
        <LeadStats leads={leads} isLoading={isLoading} error={error} />
      </motion.div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <motion.div
        variants={staggerItem}
        className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 shadow-[var(--shadow-xs)]"
      >
        {/* Statut label + pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
            Statut
          </span>
          {STATUS_FILTERS.map((pill) => {
            const isActive = filterStatus === pill.value
            return (
              <button
                key={pill.label}
                onClick={() => setFilterStatus(pill.value)}
                aria-pressed={isActive}
                className="rounded-full px-3 py-1 text-[12px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-1"
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

        {/* Assigné label + pills */}
        <div className="flex items-center gap-2">
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

        {/* Active filter count */}
        {(filterStatus != null || filterAssignee != null) && (
          <button
            onClick={() => { setFilterStatus(null); setFilterAssignee(null) }}
            className="ml-auto text-[12px] text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-secondary)] hover:underline"
          >
            Réinitialiser
          </button>
        )}
      </motion.div>

      {/* ── Content view ─────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem}>
        {view === 'table' ? (
          <LeadTable
            leads={filteredLeads}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            canDelete={canDelete}
          />
        ) : (
          <LeadKanban
            leads={filteredLeads}
            isLoading={isLoading}
            onEdit={handleEdit}
            onStatusChange={handleStatusChange}
          />
        )}
      </motion.div>

      {/* ── Modal Form ───────────────────────────────────────────────────────── */}
      <LeadForm
        open={formOpen}
        onClose={handleFormClose}
        lead={editingLead}
        onSubmit={handleFormSubmit}
      />
    </motion.div>
  )
}
