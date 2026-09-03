import { useState } from 'react'
import { Plus, LayoutList, Kanban as KanbanIcon } from 'lucide-react'
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
import { LeadListMobile } from './components/LeadListMobile'
import { LeadPitchDialog } from './components/LeadPitchDialog'
import { LogCallDialog } from './components/LogCallDialog'
import { ScriptPanel } from './components/ScriptPanel'
import type { Lead, LeadStatus, LeadAssignee, LeadInsert, LeadUpdate, LeadTab } from '@/types/leads'
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER, filterLeadsByTab } from '@/types/leads'


const STATUS_FILTERS: { label: string; value: LeadStatus | null }[] = [
  { label: 'Tous', value: null },
  ...LEAD_STATUS_ORDER.map((s) => ({ label: LEAD_STATUS_LABELS[s], value: s })),
]

const ASSIGNEE_FILTERS: { label: string; value: LeadAssignee | null }[] = [
  { label: 'Tous', value: null },
  { label: 'Naoufel', value: 'naoufel' },
  { label: 'Emir', value: 'emir' },
]

// Vue desktop : kanban par défaut (demande Naoufel 02/09/2026, qui revient sur
// le verdict du 22/08), tableau en repli. Le choix survit au rechargement.
type ViewMode = 'kanban' | 'table'
const VIEW_KEY = 'leads-view'
function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'kanban'
  } catch {
    return 'kanban'
  }
}

export default function ProspectionPage() {
  const { leads, isLoading, error, createLead, updateLead, deleteLead, logCall } = useLeads()
  const { user } = useAuth()

  const [tab, setTab] = useState<LeadTab>('cfa')
  const [view, setView] = useState<ViewMode>(readViewMode)
  const [filterStatus, setFilterStatus] = useState<LeadStatus | null>(null)
  const [filterAssignee, setFilterAssignee] = useState<LeadAssignee | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [logCallLead, setLogCallLead] = useState<Lead | null>(null)
  const [pitchLead, setPitchLead] = useState<Lead | null>(null)

  // Onglets : la prospection CFA garde strictement son comportement d'avant,
  // les partenaires (Compagnons, Paidea, TBS…) vivent à côté, hors pipeline.
  const isPartnersTab = tab === 'partenaires'
  const tabLeads = filterLeadsByTab(leads, tab)

  const visibleLeads = tabLeads.filter((l) => l.archived === showArchived)
  const archivedCount = tabLeads.filter((l) => l.archived).length

  const filteredLeads = visibleLeads
    .filter((l) => filterStatus == null || l.status === filterStatus)
    .filter((l) => filterAssignee == null || l.assigned_to === filterAssignee)

  const activeCount = tabLeads.filter((l) => !l.archived && !['gagne', 'perdu'].includes(l.status)).length

  function handleTabChange(next: LeadTab) {
    setTab(next)
    // Les pills de statut pipeline n'existent pas côté partenaires : un filtre
    // resté armé filtrerait en silence.
    setFilterStatus(null)
  }

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

  async function handleLogCall(leadId: string, input: Parameters<typeof logCall>[1]) {
    try {
      await logCall(leadId, input)
      toast.success('Appel loggé.')
    } catch {
      toast.error("Impossible d'enregistrer l'appel.")
      throw new Error('log call failed')
    }
  }

  function changeView(next: ViewMode) {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // navigation privée : le choix ne survit pas, tant pis
    }
  }

  async function handleStatusChange(leadId: string, status: LeadStatus) {
    try {
      await updateLead(leadId, { status })
      toast.success(`Déplacé vers « ${LEAD_STATUS_LABELS[status]} ».`)
    } catch {
      toast.error('Impossible de changer le statut.')
      throw new Error('status change failed')
    }
  }

  async function handleUnarchive(lead: Lead) {
    try {
      await updateLead(lead.id, { archived: false })
      toast.success(`« ${lead.name} » désarchivé.`)
    } catch {
      toast.error('Impossible de désarchiver.')
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
              Leads
            </h1>
            {!isLoading && (
              <span className="rounded-full bg-[var(--accent-purple-bg)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--memovia-violet)]">
                {activeCount} {isPartnersTab ? 'partenaires' : 'actifs'}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {isPartnersTab
              ? 'Partenaires & institutions — hors pipeline de prospection.'
              : 'Prospection CFA France — offre accessibilité.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Onglets Prospection / Partenaires (mémoire d'entreprise, 21/08/2026) */}
          <div
            className="flex items-center rounded-lg p-1"
            style={{
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            {([['cfa', 'Prospection CFA'], ['partenaires', 'Partenaires']] as const).map(
              ([value, label]) => (
                <button
                  key={value}
                  onClick={() => handleTabChange(value)}
                  aria-pressed={tab === value}
                  className="rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-2"
                  style={
                    tab === value
                      ? { backgroundColor: 'var(--memovia-violet)', color: '#fff' }
                      : { color: 'var(--text-secondary)' }
                  }
                >
                  {label}
                </button>
              )
            )}
          </div>

          {!isPartnersTab && <ScriptPanel />}
          {/* Kanban / Liste — desktop seulement : la vue mobile est la liste de cartes.
              Pas de kanban côté partenaires (hors pipeline). */}
          {!isPartnersTab && (
            <div
              role="group"
              aria-label="Vue"
              className="hidden items-center rounded-lg p-1 md:flex"
              style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
            >
              {([['kanban', 'Kanban', KanbanIcon], ['table', 'Liste', LayoutList]] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  onClick={() => changeView(value)}
                  aria-pressed={view === value}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-2"
                  style={view === value ? { backgroundColor: 'var(--memovia-violet)', color: '#fff' } : { color: 'var(--text-secondary)' }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          )}
          <Button onClick={handleNewLead} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {isPartnersTab ? 'Nouveau partenaire' : 'Nouveau lead'}
          </Button>
        </div>
      </motion.header>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {error && !isLoading && (
        <motion.div variants={staggerItem} className="rounded-md border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </motion.div>
      )}

      {/* ── KPI Stats — desktop seulement : sur mobile (l'écran d'Emir entre deux
          appels), 4 cartes empilées enterraient la liste sous deux écrans de chiffres.
          La liste EST la page ; les stats sont un bonus de grand écran.
          Alimentées par l'onglet courant : les partenaires ne polluent pas les
          chiffres de prospection (et n'ont pas de stats pipeline du tout). */}
      {!isPartnersTab && (
        <motion.div variants={staggerItem} className="hidden md:block">
          <LeadStats leads={tabLeads.filter((l) => !l.archived)} isLoading={isLoading} error={error} />
        </motion.div>
      )}

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <motion.div
        variants={staggerItem}
        className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 shadow-[var(--shadow-xs)]"
      >
        {/* Statut label + pills — pipeline de prospection uniquement */}
        {!isPartnersTab && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
            Statut
          </span>
          {STATUS_FILTERS.map((pill) => {
            const isActive = filterStatus === pill.value
            const count =
              pill.value == null
                ? visibleLeads.length
                : visibleLeads.filter((l) => l.status === pill.value).length
            return (
              <button
                key={pill.label}
                onClick={() => setFilterStatus(pill.value)}
                aria-pressed={isActive}
                className="rounded-full px-3 py-2 text-[12px] md:py-1 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-1"
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
                <span className="ml-1 tabular-nums opacity-70">{count}</span>
              </button>
            )
          })}
        </div>
        )}

        {/* Divider */}
        {!isPartnersTab && (
          <div className="hidden h-5 w-px sm:block" style={{ backgroundColor: 'var(--border-color)' }} />
        )}

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
                className="rounded-full px-3 py-2 text-[12px] md:py-1 font-medium transition-all"
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

        {/* Archivés (liste pré-refonte, récupérable) */}
        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived((v) => !v)}
            aria-pressed={showArchived}
            className="rounded-full px-3 py-2 text-[12px] md:py-1 font-medium transition-all"
            style={
              showArchived
                ? { backgroundColor: 'var(--memovia-violet)', color: '#fff' }
                : {
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-muted)',
                    border: '1px dashed var(--border-color)',
                  }
            }
          >
            Archivés ({archivedCount})
          </button>
        )}

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
        {/* Mobile : cartes au pouce (usage Emir) */}
        <div className="md:hidden">
          <LeadListMobile
            leads={filteredLeads}
            isLoading={isLoading}
            onEdit={handleEdit}
            onLogCall={setLogCallLead}
            onUnarchive={handleUnarchive}
            onCreate={handleNewLead}
            onShowPitch={setPitchLead}
          />
        </div>

        {/* Desktop : kanban (défaut) ou table dense. Les archivés et les
            partenaires restent en table : pas de pipeline à faire glisser. */}
        <div className="hidden md:block">
          {view === 'kanban' && !isPartnersTab && !showArchived ? (
            <LeadKanban
              leads={filteredLeads}
              isLoading={isLoading}
              onEdit={handleEdit}
              onLogCall={setLogCallLead}
              onShowPitch={setPitchLead}
              onCreate={handleNewLead}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <LeadTable
              leads={filteredLeads}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={handleDelete}
              canDelete={canDelete}
              onLogCall={setLogCallLead}
              onUnarchive={handleUnarchive}
              onCreate={handleNewLead}
              onShowPitch={setPitchLead}
            />
          )}
        </div>
      </motion.div>

      {/* ── Modal Form ───────────────────────────────────────────────────────── */}
      <LeadForm
        open={formOpen}
        onClose={handleFormClose}
        lead={editingLead}
        onSubmit={handleFormSubmit}
        partnerMode={isPartnersTab}
      />

      {/* ── Log d'appel ──────────────────────────────────────────────────────── */}
      <LogCallDialog
        lead={logCallLead}
        onClose={() => setLogCallLead(null)}
        onSubmit={handleLogCall}
      />

      {/* ── Fiche argumentaire (contact · pourquoi · pitch) ─────────────────── */}
      <LeadPitchDialog lead={pitchLead} onClose={() => setPitchLead(null)} />
    </motion.div>
  )
}
