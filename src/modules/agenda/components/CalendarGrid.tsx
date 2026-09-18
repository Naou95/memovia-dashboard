import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DAY_END_MIN, DAY_START_MIN, blockHeight, blockTop, clampStart, daySummary, fmtMinutes } from '@/lib/agenda'
import type { AgendaDay, SessionRow } from '@/types/agenda'
import { TONE_STYLE, dayNumber, dayShort, rowChip, rowLeadName } from '../display'
import { dragId, dropId, type DragData } from '../dnd'

/** Où le bloc en cours de déplacement atterrirait : dessiné en pointillé dans la colonne visée. */
export interface DropHint {
  day: string
  startMin: number | null
  durMin: number
}

export interface GridHandlers {
  onCreateAt: (day: string, startMin: number) => void
  onEditTask: (id: string) => void
  onEditRdv: (id: string) => void
  onEditSession: (day: string) => void
  onToggleTask: (id: string, done: boolean) => void
}

interface CalendarGridProps {
  days: AgendaDay[]
  /** Hauteur d'une heure : 156 px en vue jour (la séance liste ses appels), 64 px en vue semaine. */
  hourPx: number
  nowMin: number
  /** Vue jour : la séance d'appels affiche la liste de ses appels. */
  detailed: boolean
  selectedKey: string | null
  onOpenCall: (row: SessionRow) => void
  onOpenDay?: (day: string) => void
  handlers: GridHandlers
  hint: DropHint | null
}

const HOURS = Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 }, (_, i) => DAY_START_MIN / 60 + i)
const SESSION_HEAD_PX = 42
const TASK_COLORS: CSSProperties = { backgroundColor: 'var(--warning-bg)', borderColor: 'color-mix(in srgb, var(--warning) 35%, transparent)', color: '#78350F' }

// ── Briques du glisser-déposer ─────────────────────────────────────────────────

interface DraggableBoxProps {
  id: string
  data: DragData
  className?: string
  style?: CSSProperties
  title?: string
  onClick?: () => void
  children: ReactNode
}

/**
 * Un bloc déplaçable. À la souris, on l'attrape n'importe où ; au doigt, par sa poignée seulement
 * (elle seule coupe le défilement du navigateur, sinon on ne pourrait plus faire défiler la grille).
 * Un clic sans déplacement reste un clic : le glisser ne démarre qu'après 5 px.
 */
function DraggableBox({ id, data, className, style, title, onClick, children }: DraggableBoxProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id, data })
  return (
    <div ref={setNodeRef} {...listeners} onClick={onClick} title={title} className={cn('cursor-grab active:cursor-grabbing', className, isDragging && 'opacity-35')} style={style}>
      {children}
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        aria-label={`Déplacer : ${data.title}`}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 grid h-5 w-4 touch-none place-items-center text-current opacity-45 hover:opacity-90"
      >
        <GripVertical className="h-3 w-3" />
      </button>
    </div>
  )
}

function TaskCheckbox({ id, done, title, onToggle }: { id: string; done: boolean; title: string; onToggle: (id: string, done: boolean) => void }) {
  return (
    <input
      type="checkbox"
      checked={done}
      aria-label={`${done ? 'Rouvrir' : 'Terminer'} : ${title}`}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onToggle(id, e.target.checked)}
      className="mt-[1px] h-3.5 w-3.5 shrink-0 cursor-pointer accent-[var(--memovia-violet)]"
    />
  )
}

// Les zones de dépôt se déclarent par leurs attributs data-drop-id et data-hour-px : le glisser les
// retrouve sous le pointeur (voir zoneAt dans ../dnd), pas par la surface du bloc déplacé.
function AllDayCell({ day, hourPx, active, children }: { day: string; hourPx: number; active: boolean; children: ReactNode }) {
  return (
    <div data-drop-id={dropId('allday', day)} data-hour-px={hourPx} className={cn('flex min-h-[34px] flex-col gap-1 border-l border-[var(--border-subtle)] px-1.5 py-1', active && 'bg-[var(--bg-active)]')}>
      {children}
    </div>
  )
}

interface DayColumnProps {
  day: AgendaDay
  hourPx: number
  height: number
  hint: DropHint | null
  onCreateAt: (day: string, startMin: number) => void
  children: ReactNode
}

function DayColumn({ day, hourPx, height, hint, onCreateAt, children }: DayColumnProps) {
  // Un clic sur un créneau VIDE crée ; un clic sur un bloc est pour ce bloc (il n'arrive pas jusqu'ici).
  function handleClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const raw = DAY_START_MIN + ((e.clientY - rect.top) / hourPx) * 60
    onCreateAt(day.day, clampStart(Math.floor(raw / 15) * 15, 30))
  }

  return (
    <div
      onClick={handleClick}
      data-drop-id={dropId('col', day.day)}
      data-hour-px={hourPx}
      data-testid={`agenda-colonne-${day.day}`}
      className={cn('relative cursor-cell border-l border-[var(--border-subtle)]', day.isToday && 'bg-[color-mix(in_srgb,var(--memovia-violet-light)_22%,transparent)]')}
      style={{ height, backgroundImage: 'linear-gradient(var(--border-subtle) 1px, transparent 1px)', backgroundSize: `100% ${hourPx}px` }}
    >
      {children}
      {hint && hint.day === day.day && hint.startMin !== null && (
        <div
          className="pointer-events-none absolute left-1 right-1 z-[4] rounded-lg border-2 border-dashed border-[var(--memovia-violet)] bg-[color-mix(in_srgb,var(--memovia-violet)_7%,transparent)]"
          style={{ top: blockTop(hint.startMin, hourPx), height: blockHeight(hint.durMin, hourPx) }}
        />
      )}
    </div>
  )
}

// ── La grille ──────────────────────────────────────────────────────────────────

/**
 * La grille façon Outlook : une colonne par jour, une ligne « journée » en haut, puis les heures.
 * Un seul composant pour la vue jour (1 colonne) et la vue semaine (5 colonnes). Tâches, RDV et
 * séance d'appels se déplacent (pas de 15 min) ; un clic sur un créneau vide crée, un clic sur un
 * bloc l'ouvre en modification. Doit vivre sous un DndContext (posé par AgendaView).
 */
export function CalendarGrid({ days, hourPx, nowMin, detailed, selectedKey, onOpenCall, onOpenDay, handlers, hint }: CalendarGridProps) {
  const cols: CSSProperties = { gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }
  const bodyHeight = HOURS.length * hourPx

  return (
    <div
      className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[var(--shadow-xs)]"
      style={detailed ? undefined : { maxHeight: 'calc(100vh - 220px)' }}
    >
      <div style={detailed ? undefined : { minWidth: 760 }}>
        {/* En-tête des jours, collant */}
        <div className="sticky top-0 z-10 grid border-b border-[var(--border-color)] bg-[var(--bg-secondary)]" style={cols}>
          <div />
          {days.map((d) => (
            <button
              key={d.day}
              type="button"
              onClick={() => onOpenDay?.(d.day)}
              disabled={!onOpenDay}
              className="flex items-baseline gap-1.5 border-l border-[var(--border-subtle)] px-2.5 py-2 text-left enabled:hover:bg-[var(--bg-hover)]"
            >
              <span className="text-[11.5px] uppercase tracking-wider text-[var(--text-secondary)]">{dayShort(d.day)}.</span>
              <span className={cn('text-[20px] font-bold leading-none', d.isToday ? 'text-[var(--memovia-violet)]' : 'text-[var(--text-primary)]')}>{dayNumber(d.day)}</span>
            </button>
          ))}
        </div>

        {/* Ligne « journée » : ce qui n'a pas d'heure. Y lâcher une tâche lui retire son heure. */}
        <div className="grid border-b border-[var(--border-color)] bg-[var(--bg-primary)]" style={cols}>
          <div className="px-1.5 pt-2 text-right text-[10.5px] text-[var(--text-muted)]">journée</div>
          {days.map((d) => (
            <AllDayCell key={d.day} day={d.day} hourPx={hourPx} active={!!hint && hint.day === d.day && hint.startMin === null}>
              {d.chips.map((c) => (
                <span key={c.label} className="rounded-md px-1.5 py-0.5 text-[11.5px] font-medium leading-snug" style={TONE_STYLE[c.tone]}>{c.label}</span>
              ))}
              {d.allDayTasks.map((t) => (
                <DraggableBox
                  key={t.task.id}
                  id={dragId('task', t.task.id)}
                  data={{ kind: 'task', id: t.task.id, durMin: t.task.duration_min ?? 30, title: t.task.title }}
                  title={t.task.title}
                  onClick={() => handlers.onEditTask(t.task.id)}
                  className={cn('relative flex items-start gap-1.5 rounded-md border py-0.5 pl-1.5 pr-4 text-[11.5px] leading-snug', t.task.status === 'done' && 'opacity-55')}
                  style={TASK_COLORS}
                >
                  <TaskCheckbox id={t.task.id} done={t.task.status === 'done'} title={t.task.title} onToggle={handlers.onToggleTask} />
                  <span className={cn('min-w-0 flex-1 truncate', t.task.status === 'done' && 'line-through')}>{t.task.title}</span>
                  {t.lateDays > 0 && <span className="shrink-0 font-semibold text-[var(--danger)]">{t.lateDays} j</span>}
                </DraggableBox>
              ))}
            </AllDayCell>
          ))}
        </div>

        {/* Heures et colonnes */}
        <div className="grid pt-2.5" style={cols}>
          <div className="relative" style={{ height: bodyHeight }}>
            {HOURS.map((h, i) => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 bg-[var(--bg-secondary)] px-0.5 font-mono text-[10.5px] text-[var(--text-muted)]" style={{ top: i * hourPx }}>
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {days.map((d) => {
            const sum = daySummary(d)
            const sessionMin = d.session ? d.session.endMin - d.session.startMin : 0
            const sessionHeight = d.session ? blockHeight(sessionMin, hourPx) : 0
            const capacity = d.session ? Math.max(1, Math.floor(sessionMin / d.session.slotMinutes)) : 1
            const rowPx = Math.max(22, Math.floor((sessionHeight - SESSION_HEAD_PX) / capacity))
            return (
              <DayColumn key={d.day} day={d} hourPx={hourPx} height={bodyHeight} hint={hint} onCreateAt={handlers.onCreateAt}>
                {d.session && (
                  <div
                    className="absolute left-1 right-1 z-[1] flex flex-col overflow-hidden rounded-lg border"
                    style={{ top: blockTop(d.session.startMin, hourPx), height: sessionHeight, backgroundColor: '#FAF8FF', borderColor: '#DDD6FE' }}
                  >
                    <DraggableBox
                      id={dragId('session', d.day)}
                      data={{ kind: 'session', id: d.day, durMin: sessionMin, title: 'Séance d’appels' }}
                      onClick={() => handlers.onEditSession(d.day)}
                      className="relative shrink-0 px-2 pr-4 pt-1.5 leading-tight"
                      style={{ height: SESSION_HEAD_PX }}
                    >
                      <div className="truncate text-[12px] font-semibold text-[var(--memovia-violet)]">
                        Séance d’appels · {fmtMinutes(d.session.startMin)} – {fmtMinutes(d.session.endMin)}
                      </div>
                      <div className="truncate text-[11px] text-[var(--text-secondary)]">
                        {sum.total === 0 ? 'Aucun appel dû' : `${sum.total} appel${sum.total > 1 ? 's' : ''} · ${sum.done} fait${sum.done > 1 ? 's' : ''}`}
                      </div>
                    </DraggableBox>
                    {detailed && d.rows.length > 0 && (
                      <div className="min-h-0 flex-1 overflow-y-auto border-t" style={{ borderColor: '#E9E3FF' }}>
                        {d.rows.map((row) => {
                          const chip = rowChip(row)
                          const key = row.call.key
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => onOpenCall(row)}
                              className={cn(
                                'grid w-full grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2 border-l-[3px] px-2 text-left text-[12.5px] hover:bg-[var(--bg-hover)]',
                                selectedKey === key ? 'border-l-[var(--memovia-violet)] bg-[var(--bg-active)]' : 'border-l-transparent',
                              )}
                              style={{ height: rowPx }}
                            >
                              <span className="font-mono text-[11.5px] text-[var(--text-secondary)]">{fmtMinutes(row.startMin)}</span>
                              <span className="truncate">
                                <b className={cn('font-semibold', row.kind === 'done' ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]')}>{rowLeadName(row)}</b>
                                {row.kind === 'pending' && row.call.lead.contact_name && <span className="text-[var(--text-secondary)]"> · {row.call.lead.contact_name}</span>}
                              </span>
                              <span className="whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold" style={TONE_STYLE[chip.tone]}>{chip.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {d.blocks.map((b) => {
                  const style: CSSProperties = { top: blockTop(b.startMin, hourPx), height: blockHeight(b.durMin, hourPx) }
                  if (b.kind === 'rdv') {
                    return (
                      <DraggableBox
                        key={b.id}
                        id={dragId('rdv', b.refId)}
                        data={{ kind: 'rdv', id: b.refId, durMin: b.durMin, title: b.title }}
                        title={b.title}
                        onClick={() => handlers.onEditRdv(b.refId)}
                        className="absolute left-1 right-1 z-[2] overflow-hidden rounded-lg border py-1 pl-2 pr-4 text-[12px] leading-tight hover:brightness-95"
                        style={{ ...style, backgroundColor: 'var(--accent-blue-bg)', borderColor: '#BFDBFE', color: 'var(--accent-blue)' }}
                      >
                        <span className="block truncate font-semibold">{fmtMinutes(b.startMin)} · {b.title}</span>
                        {b.leadName && <span className="block truncate text-[11px] opacity-85">{b.leadName}</span>}
                      </DraggableBox>
                    )
                  }
                  return (
                    <DraggableBox
                      key={b.id}
                      id={dragId('task', b.refId)}
                      data={{ kind: 'task', id: b.refId, durMin: b.durMin, title: b.title }}
                      title={b.title}
                      onClick={() => handlers.onEditTask(b.refId)}
                      className={cn('absolute left-1 right-1 z-[2] flex items-start gap-1.5 overflow-hidden rounded-lg border py-1 pl-2 pr-4 text-[12px] leading-tight', b.done && 'opacity-55')}
                      style={{ ...style, ...TASK_COLORS }}
                    >
                      <TaskCheckbox id={b.refId} done={b.done} title={b.title} onToggle={handlers.onToggleTask} />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate font-medium', b.done && 'line-through')}>{b.title}</span>
                        {b.leadName && <span className="block truncate text-[11px] opacity-85">{b.leadName}</span>}
                      </span>
                    </DraggableBox>
                  )
                })}

                {d.isToday && nowMin >= DAY_START_MIN && nowMin <= DAY_END_MIN && (
                  <div className="pointer-events-none absolute left-0 right-0 z-[3] border-t-2 border-[#EF4444]" style={{ top: blockTop(nowMin, hourPx) }}>
                    <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-[#EF4444]" />
                  </div>
                )}
              </DayColumn>
            )
          })}
        </div>
      </div>
    </div>
  )
}
