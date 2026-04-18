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
import { GripVertical, Pencil, CalendarClock } from 'lucide-react'
import { LeadMaturityBadge } from './LeadMaturityBadge'
import type { Lead, LeadStatus } from '@/types/leads'
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_ORDER,
  LEAD_CANAL_LABELS,
  LEAD_ASSIGNEE_LABELS,
} from '@/types/leads'

interface LeadKanbanProps {
  leads: Lead[]
  isLoading: boolean
  onEdit: (lead: Lead) => void
  onStatusChange: (leadId: string, newStatus: LeadStatus) => Promise<void>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

const COLUMN_TOP_COLOR: Record<LeadStatus, string> = {
  nouveau: 'var(--text-label)',
  contacte: 'var(--accent-blue)',
  en_discussion: 'var(--memovia-violet)',
  proposition: '#f59e0b',
  gagne: 'var(--success)',
  perdu: 'var(--trend-down-text)',
}

// ── Card content (shared between draggable + overlay) ─────────────────────────

interface CardContentProps {
  lead: Lead
  onEdit?: (l: Lead) => void
  dragHandleProps?: Record<string, unknown>
  isOverlay?: boolean
  isPlaceholder?: boolean
}

function CardContent({ lead, onEdit, dragHandleProps, isOverlay, isPlaceholder }: CardContentProps) {
  const isOverdue =
    lead.follow_up_date != null &&
    new Date(lead.follow_up_date) < new Date() &&
    !['gagne', 'perdu'].includes(lead.status)

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
          <div className="flex items-start justify-between gap-2">
            <span className="text-[13px] font-medium leading-tight text-[var(--text-primary)]">
              {lead.name}
            </span>
            {!isOverlay && !isPlaceholder && onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(lead) }}
                className="shrink-0 rounded p-0.5 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--memovia-violet)]"
                aria-label="Modifier"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
              {LEAD_CANAL_LABELS[lead.canal]}
            </span>
            {lead.assigned_to && (
              <span className="rounded-full bg-[var(--accent-purple-bg)] px-2 py-0.5 text-[11px] text-[var(--memovia-violet)]">
                {LEAD_ASSIGNEE_LABELS[lead.assigned_to]}
              </span>
            )}
            {lead.maturity && <LeadMaturityBadge maturity={lead.maturity} />}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {lead.relance_count > 0 && (
              <span className="text-[11px] text-[var(--text-muted)]">
                {lead.relance_count} relance{lead.relance_count > 1 ? 's' : ''}
              </span>
            )}
            {lead.last_contact_date && (
              <span className="text-[11px] text-[var(--text-muted)]">
                Contact : {formatDate(lead.last_contact_date)}
              </span>
            )}
          </div>

          {lead.follow_up_date && (
            <div
              className="mt-2 flex items-center gap-1 text-[11px]"
              style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}
            >
              <CalendarClock className="h-3 w-3" />
              <span>{formatDate(lead.follow_up_date)}</span>
            </div>
          )}

          {lead.next_action && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
              {lead.next_action}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Draggable card ─────────────────────────────────────────────────────────────

function DraggableCard({ lead, onEdit }: { lead: Lead; onEdit: (l: Lead) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
    transition: isDragging ? undefined : 'transform 200ms ease',
  }

  return (
    <div ref={setNodeRef} style={style}>
      {isDragging ? (
        // Placeholder slot while dragging
        <CardContent lead={lead} isPlaceholder />
      ) : (
        <CardContent lead={lead} onEdit={onEdit} dragHandleProps={{ ...attributes, ...listeners }} />
      )}
    </div>
  )
}

// ── Droppable column ───────────────────────────────────────────────────────────

interface DroppableColumnProps {
  status: LeadStatus
  leads: Lead[]
  isLoading: boolean
  onEdit: (lead: Lead) => void
  activeLeadId: string | null
}

function DroppableColumn({ status, leads, isLoading, onEdit, activeLeadId }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  const topColor = COLUMN_TOP_COLOR[status]

  return (
    <div className="flex w-[240px] shrink-0 flex-col gap-2">
      {/* Column header */}
      <div
        className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2.5 transition-colors"
        style={{
          borderTopWidth: 2,
          borderTopColor: topColor,
          backgroundColor: isOver
            ? 'color-mix(in oklab, var(--memovia-violet) 6%, var(--bg-secondary))'
            : undefined,
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">
            {LEAD_STATUS_LABELS[status]}
          </span>
          <span className="rounded-full bg-[var(--bg-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
            {isLoading ? '—' : leads.length}
          </span>
        </div>
      </div>

      {/* Cards zone */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-2 rounded-xl p-1 transition-colors"
        style={{
          minHeight: 60,
          backgroundColor: isOver
            ? 'color-mix(in oklab, var(--memovia-violet) 5%, var(--bg-primary))'
            : 'transparent',
          outline: isOver ? `2px dashed ${topColor}` : '2px dashed transparent',
          outlineOffset: '-2px',
        }}
      >
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : leads.length === 0 && !activeLeadId ? (
          <div className="rounded-xl border border-dashed border-[var(--border-color)] px-3 py-5 text-center">
            <p className="text-[11px] text-[var(--text-muted)]">Aucun lead</p>
          </div>
        ) : (
          leads.map((lead) => (
            <DraggableCard key={lead.id} lead={lead} onEdit={onEdit} />
          ))
        )}
      </div>
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 space-y-2">
      <div className="h-4 animate-pulse rounded bg-[var(--border-color)]" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--border-color)]" />
    </div>
  )
}

// ── Main Kanban ────────────────────────────────────────────────────────────────

export function LeadKanban({ leads, isLoading, onEdit, onStatusChange }: LeadKanbanProps) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }, // slight movement required before drag starts
    })
  )

  function handleDragStart(event: DragStartEvent) {
    const lead = leads.find((l) => l.id === event.active.id)
    setActiveLead(lead ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveLead(null)

    if (!over) return
    const newStatus = over.id as LeadStatus
    const lead = leads.find((l) => l.id === active.id)
    if (!lead || lead.status === newStatus) return

    try {
      await onStatusChange(lead.id, newStatus)
    } catch {
      // toast is handled in ProspectionPage
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {LEAD_STATUS_ORDER.map((status) => (
            <DroppableColumn
              key={status}
              status={status}
              leads={leads.filter((l) => l.status === status)}
              isLoading={isLoading}
              onEdit={onEdit}
              activeLeadId={activeLead?.id ?? null}
            />
          ))}
        </div>
      </div>

      {/* Floating card during drag */}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
        {activeLead ? (
          <div style={{ width: 240 }}>
            <CardContent lead={activeLead} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
