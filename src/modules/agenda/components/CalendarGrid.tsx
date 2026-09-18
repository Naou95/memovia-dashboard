import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { DAY_END_MIN, DAY_START_MIN, blockHeight, blockTop, daySummary, fmtMinutes } from '@/lib/agenda'
import type { AgendaDay, SessionRow } from '@/types/agenda'
import { TONE_STYLE, dayNumber, dayShort, rowChip, rowLeadName } from '../display'

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
}

const HOURS = Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 }, (_, i) => DAY_START_MIN / 60 + i)
const SESSION_HEAD_PX = 42

/**
 * La grille façon Outlook : une colonne par jour, une ligne « journée » en haut, puis les heures.
 * Un seul composant pour la vue jour (1 colonne) et la vue semaine (5 colonnes). Lecture seule
 * dans cette PR : le glisser-déposer arrive avec la PR 5.
 */
export function CalendarGrid({ days, hourPx, nowMin, detailed, selectedKey, onOpenCall, onOpenDay }: CalendarGridProps) {
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

        {/* Ligne « journée » : ce qui n'a pas d'heure */}
        <div className="grid border-b border-[var(--border-color)] bg-[var(--bg-primary)]" style={cols}>
          <div className="px-1.5 pt-2 text-right text-[10.5px] text-[var(--text-muted)]">journée</div>
          {days.map((d) => (
            <div key={d.day} className="flex min-h-[34px] flex-col gap-1 border-l border-[var(--border-subtle)] px-1.5 py-1">
              {d.chips.map((c) => (
                <span key={c.label} className="rounded-md px-1.5 py-0.5 text-[11.5px] font-medium leading-snug" style={TONE_STYLE[c.tone]}>{c.label}</span>
              ))}
              {d.allDayTasks.map((t) => (
                <span
                  key={t.task.id}
                  title={t.task.title}
                  className={cn('flex items-start gap-1.5 rounded-md border px-1.5 py-0.5 text-[11.5px] leading-snug', t.task.status === 'done' && 'opacity-55')}
                  style={{ backgroundColor: 'var(--warning-bg)', borderColor: 'color-mix(in srgb, var(--warning) 35%, transparent)', color: '#78350F' }}
                >
                  <span className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-[3px] border border-current" aria-hidden />
                  <span className={cn('min-w-0 flex-1 truncate', t.task.status === 'done' && 'line-through')}>{t.task.title}</span>
                  {t.lateDays > 0 && <span className="shrink-0 font-semibold text-[var(--danger)]">{t.lateDays} j</span>}
                </span>
              ))}
            </div>
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
            const sessionHeight = d.session ? blockHeight(d.session.endMin - d.session.startMin, hourPx) : 0
            const capacity = d.session ? Math.max(1, Math.floor((d.session.endMin - d.session.startMin) / d.session.slotMinutes)) : 1
            const rowPx = Math.max(22, Math.floor((sessionHeight - SESSION_HEAD_PX) / capacity))
            return (
              <div
                key={d.day}
                className={cn('relative border-l border-[var(--border-subtle)]', d.isToday && 'bg-[color-mix(in_srgb,var(--memovia-violet-light)_22%,transparent)]')}
                style={{
                  height: bodyHeight,
                  backgroundImage: 'linear-gradient(var(--border-subtle) 1px, transparent 1px)',
                  backgroundSize: `100% ${hourPx}px`,
                }}
              >
                {d.session && (
                  <div
                    className="absolute left-1 right-1 z-[1] flex flex-col overflow-hidden rounded-lg border"
                    style={{
                      top: blockTop(d.session.startMin, hourPx),
                      height: sessionHeight,
                      backgroundColor: '#FAF8FF',
                      borderColor: '#DDD6FE',
                    }}
                  >
                    <div className="shrink-0 px-2 pt-1.5 leading-tight" style={{ height: SESSION_HEAD_PX }}>
                      <div className="truncate text-[12px] font-semibold text-[var(--memovia-violet)]">
                        Séance d’appels · {fmtMinutes(d.session.startMin)} – {fmtMinutes(d.session.endMin)}
                      </div>
                      <div className="truncate text-[11px] text-[var(--text-secondary)]">
                        {sum.total === 0 ? 'Aucun appel dû' : `${sum.total} appel${sum.total > 1 ? 's' : ''} · ${sum.done} fait${sum.done > 1 ? 's' : ''}`}
                      </div>
                    </div>
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
                      <Link
                        key={b.id}
                        to="/rdv"
                        title={b.title}
                        className="absolute left-1 right-1 z-[2] overflow-hidden rounded-lg border px-2 py-1 text-[12px] leading-tight hover:brightness-95"
                        style={{ ...style, backgroundColor: 'var(--accent-blue-bg)', borderColor: '#BFDBFE', color: 'var(--accent-blue)' }}
                      >
                        <span className="block truncate font-semibold">{fmtMinutes(b.startMin)} · {b.title}</span>
                        {b.leadName && <span className="block truncate text-[11px] opacity-85">{b.leadName}</span>}
                      </Link>
                    )
                  }
                  return (
                    <div
                      key={b.id}
                      title={b.title}
                      className={cn('absolute left-1 right-1 z-[2] flex items-start gap-1.5 overflow-hidden rounded-lg border px-2 py-1 text-[12px] leading-tight', b.done && 'opacity-55')}
                      style={{ ...style, backgroundColor: 'var(--warning-bg)', borderColor: 'color-mix(in srgb, var(--warning) 35%, transparent)', color: '#78350F' }}
                    >
                      <span className="mt-[2px] h-3 w-3 shrink-0 rounded-[3px] border border-current" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate font-medium', b.done && 'line-through')}>{b.title}</span>
                        {b.leadName && <span className="block truncate text-[11px] opacity-85">{b.leadName}</span>}
                      </span>
                    </div>
                  )
                })}

                {d.isToday && nowMin >= DAY_START_MIN && nowMin <= DAY_END_MIN && (
                  <div className="pointer-events-none absolute left-0 right-0 z-[3] border-t-2 border-[#EF4444]" style={{ top: blockTop(nowMin, hourPx) }}>
                    <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-[#EF4444]" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
