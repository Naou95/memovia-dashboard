import { useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { BookOpen, Pencil, Phone, PhoneCall, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { followUpLabel, groupLeadsByStatus, type FollowUpTone } from '@/lib/leadKanban'
import type { Lead, LeadStatus } from '@/types/leads'
import { LEAD_ASSIGNEE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_ORDER } from '@/types/leads'

interface LeadKanbanProps {
  leads: Lead[]
  isLoading: boolean
  onEdit: (lead: Lead) => void
  onLogCall: (lead: Lead) => void
  onShowPitch: (lead: Lead) => void
  onCreate: () => void
  onStatusChange: (leadId: string, status: LeadStatus) => Promise<void>
}

const COLUMN_DOT: Record<LeadStatus, string> = {
  nouveau: 'var(--text-label)',
  contacte: 'var(--accent-blue)',
  en_discussion: 'var(--memovia-violet)',
  proposition: 'var(--warning)',
  gagne: 'var(--success)',
  perdu: 'var(--trend-down-text)',
  actif: 'var(--success)', // jamais en colonne (hors LEAD_STATUS_ORDER), présent pour le Record
}

const TONE_STYLE: Record<FollowUpTone, React.CSSProperties> = {
  late: { color: 'var(--danger)', fontWeight: 600 },
  today: { color: 'var(--memovia-violet)', fontWeight: 600 },
  soon: { color: 'var(--text-secondary)' },
  none: {},
}

// ── Carte ─────────────────────────────────────────────────────────────────────

interface CardBodyProps {
  lead: Lead
  isOverlay?: boolean
  onEdit?: (lead: Lead) => void
  onLogCall?: (lead: Lead) => void
  onShowPitch?: (lead: Lead) => void
}

/** Le contenu de la carte : la prochaine action est la ligne reine, comme dans le tableau. */
function CardBody({ lead, isOverlay, onEdit, onLogCall, onShowPitch }: CardBodyProps) {
  const follow = followUpLabel(lead.follow_up_date)
  const closed = lead.status === 'gagne' || lead.status === 'perdu'
  return (
    <div
      className={[
        'group rounded-lg border bg-[var(--bg-secondary)] p-3 transition-[box-shadow,border-color] duration-150',
        isOverlay
          ? 'rotate-[1.5deg] border-[var(--memovia-violet)] shadow-[0_12px_32px_rgba(16,24,40,0.16)]'
          : 'border-[var(--border-color)] shadow-[var(--shadow-xs)] hover:border-[var(--memovia-violet)] hover:shadow-[var(--shadow-sm)]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-[var(--text-primary)]">{lead.name}</p>
          {lead.contact_name && (
            <p className="mt-0.5 truncate text-[12px] text-[var(--text-secondary)]">
              {lead.contact_name}
              {lead.contact_role ? ` · ${lead.contact_role}` : ''}
            </p>
          )}
        </div>
        {lead.assigned_to && (
          <span className="shrink-0 rounded-full bg-[var(--accent-purple-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--memovia-violet)]">
            {LEAD_ASSIGNEE_LABELS[lead.assigned_to]}
          </span>
        )}
      </div>

      {lead.next_action ? (
        <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-[var(--text-primary)]" title={lead.next_action}>
          {lead.next_action}
        </p>
      ) : (
        !closed && <p className="mt-2 text-[12px] italic text-[var(--text-muted)]">Pas de prochaine action</p>
      )}
      {follow.tone !== 'none' && !closed && (
        <p className="mt-1 text-[12px] tabular-nums" style={TONE_STYLE[follow.tone]}>
          {follow.text}
        </p>
      )}

      {/* Actions : toujours visibles (discrètes), jamais un départ de drag. */}
      {!isOverlay && (
        <div
          className="mt-2 flex items-center gap-1"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {lead.contact_phone && (
            <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-[var(--memovia-violet)]">
              <a href={`tel:${lead.contact_phone.replace(/\s/g, '')}`} title={`Appeler ${lead.contact_phone}`}>
                <Phone className="h-3.5 w-3.5" />
                <span className="sr-only">Appeler {lead.contact_phone}</span>
              </a>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onLogCall?.(lead)} className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-[var(--memovia-violet)]">
            <PhoneCall className="h-3.5 w-3.5" />
            <span className="sr-only">Logger un appel</span>
          </Button>
          {(lead.why || lead.pitch) && (
            <Button variant="ghost" size="sm" onClick={() => onShowPitch?.(lead)} className="h-7 w-7 p-0 text-[var(--memovia-violet)]">
              <BookOpen className="h-3.5 w-3.5" />
              <span className="sr-only">Pourquoi + pitch</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onEdit?.(lead)} className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-[var(--memovia-violet)]">
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Modifier</span>
          </Button>
        </div>
      )}
    </div>
  )
}

interface DraggableCardProps extends CardBodyProps {
  onOpen: (lead: Lead) => void
}

function DraggableCard({ lead, onOpen, ...rest }: DraggableCardProps) {
  // Drag au pointeur seulement (pas d'attributs ARIA de dnd-kit : ils posent
  // role="button" sur une carte qui contient de vrais boutons). Au clavier, le
  // statut se change dans la fiche (crayon), comme dans le tableau.
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      onClick={() => onOpen(lead)}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }}
      className="cursor-grab rounded-lg active:cursor-grabbing"
    >
      <CardBody lead={lead} {...rest} />
    </div>
  )
}

// ── Colonne ───────────────────────────────────────────────────────────────────

interface ColumnProps {
  status: LeadStatus
  leads: Lead[]
  isLoading: boolean
  isDragging: boolean
  children: React.ReactNode
}

function Column({ status, leads, isLoading, isDragging, children }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const dot = COLUMN_DOT[status]
  return (
    <section
      aria-label={LEAD_STATUS_LABELS[status]}
      className="flex min-w-0 flex-col rounded-xl bg-[var(--bg-primary)] p-2"
      style={{ border: '1px solid var(--border-color)' }}
    >
      <header className="mb-2 flex items-center gap-2 px-1 pt-1">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
        <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
          {LEAD_STATUS_LABELS[status]}
        </span>
        <span className="ml-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-[var(--text-muted)]">
          {isLoading ? '—' : leads.length}
        </span>
      </header>
      <div
        ref={setNodeRef}
        className="flex max-h-[calc(100vh-330px)] min-h-[96px] flex-col gap-2 overflow-y-auto rounded-lg p-0.5 transition-colors" /* 330 px = top-bar + en-tête + filtres : la colonne défile, pas la page */
        style={{
          backgroundColor: isOver ? 'color-mix(in oklab, var(--memovia-violet) 8%, var(--bg-primary))' : 'transparent',
          outline: isOver ? `2px dashed ${dot}` : '2px dashed transparent',
          outlineOffset: '-2px',
        }}
      >
        {isLoading ? (
          <>
            <div className="h-20 animate-pulse rounded-lg bg-[var(--border-color)]" />
            <div className="h-14 animate-pulse rounded-lg bg-[var(--border-color)]" />
          </>
        ) : leads.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border-color)] px-2 py-6 text-center text-[11px] text-[var(--text-muted)]">
            {isDragging ? 'Déposer ici' : 'Aucun lead'}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

// ── Kanban ────────────────────────────────────────────────────────────────────

/**
 * Kanban de prospection (rétabli le 02/09/2026 à la demande de Naoufel, après
 * le verdict inverse du 22/08) : une colonne par statut, la carte se glisse
 * d'une colonne à l'autre. Desktop seulement : sur mobile, la liste au pouce
 * reste la vue.
 */
export function LeadKanban({ leads, isLoading, onEdit, onLogCall, onShowPitch, onCreate, onStatusChange }: LeadKanbanProps) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  // Déplacement optimiste : la carte change de colonne à la dépose, sans
  // attendre le refetch. Se dissout de lui-même dès que la donnée rattrape.
  const [moved, setMoved] = useState<{ id: string; status: LeadStatus } | null>(null)
  // Un clic qui conclut un drag ne doit pas ouvrir la fiche.
  const justDragged = useRef(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const shown = useMemo(() => {
    if (!moved) return leads
    if (leads.find((l) => l.id === moved.id)?.status === moved.status) return leads
    return leads.map((l) => (l.id === moved.id ? { ...l, status: moved.status } : l))
  }, [leads, moved])
  const groups = useMemo(() => groupLeadsByStatus(shown), [shown])

  function handleDragStart(event: DragStartEvent) {
    justDragged.current = true
    setActiveLead(leads.find((l) => l.id === event.active.id) ?? null)
  }

  function releaseClick() {
    setTimeout(() => {
      justDragged.current = false
    }, 0)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveLead(null)
    releaseClick()
    const { active, over } = event
    const lead = leads.find((l) => l.id === active.id)
    const status = over?.id as LeadStatus | undefined
    if (!lead || !status || lead.status === status) return
    setMoved({ id: lead.id, status })
    try {
      await onStatusChange(lead.id, status)
    } catch {
      setMoved(null) // le toast vient de la page
    }
  }

  function handleOpen(lead: Lead) {
    if (!justDragged.current) onEdit(lead)
  }

  if (!isLoading && leads.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-12 text-center">
        <p className="text-[15px] font-medium text-[var(--text-primary)]">Aucun lead trouvé</p>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">La liste CFA France se construit ici.</p>
        <Button onClick={onCreate} className="mt-4 gap-1.5">
          <Plus className="h-4 w-4" />
          Créer le premier lead
        </Button>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveLead(null)
        releaseClick()
      }}
    >
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1080px] grid-cols-6 gap-3">
          {LEAD_STATUS_ORDER.map((status) => (
            <Column key={status} status={status} leads={groups[status]} isLoading={isLoading} isDragging={activeLead != null}>
              {groups[status].map((lead) => (
                <DraggableCard
                  key={lead.id}
                  lead={lead}
                  onOpen={handleOpen}
                  onEdit={onEdit}
                  onLogCall={onLogCall}
                  onShowPitch={onShowPitch}
                />
              ))}
            </Column>
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
        {activeLead ? <CardBody lead={activeLead} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
