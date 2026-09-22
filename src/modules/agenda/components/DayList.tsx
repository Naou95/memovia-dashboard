import { Link } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fmtMinutes } from '@/lib/agenda'
import type { AgendaDay, ClassifiedCall, SessionRow } from '@/types/agenda'
import { TONE_STYLE, rowChip, rowLeadName } from '../display'

interface DayListProps {
  day: AgendaDay
  onOpenCall: (row: SessionRow) => void
}

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/**
 * Vue jour sur téléphone : des cartes au pouce plutôt qu'une grille horaire (usage en séance
 * d'appels, d'une main). Mêmes données que la grille.
 */
export function DayList({ day, onOpenCall }: DayListProps) {
  const overflowRows: SessionRow[] = day.overflow.map((call: ClassifiedCall) => ({ kind: 'pending', startMin: -1, call }))
  const tasks = [...day.allDayTasks.map((t) => ({ id: t.task.id, title: t.task.title, when: t.lateDays > 0 ? `en retard de ${t.lateDays} j` : 'sans heure', done: t.task.status === 'done' })),
    ...day.blocks.filter((b) => b.kind === 'task').map((b) => ({ id: b.refId, title: b.title, when: `${fmtMinutes(b.startMin)} · ${b.durMin} min`, done: b.done }))]
  const rdvs = day.blocks.filter((b) => b.kind === 'rdv')

  const card = (row: SessionRow, late = false) => {
    const chip = rowChip(row)
    const lead = row.call.lead
    const pending = row.kind === 'pending'
    return (
      <div key={row.call.key} className={cn('flex flex-col gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3.5', !pending && 'opacity-80')}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[12px] text-[var(--text-secondary)]">{late ? 'à reporter' : fmtMinutes(row.startMin)}</span>
          <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={TONE_STYLE[chip.tone]}>{chip.label}</span>
        </div>
        <div className="text-[15px] font-semibold text-[var(--text-primary)]">{rowLeadName(row)}</div>
        <div className="text-[13px] text-[var(--text-secondary)]">
          {lead?.contact_name || 'Contact à identifier'}{lead?.contact_role ? ` · ${lead.contact_role}` : ''}
        </div>
        <div className="mt-1 flex gap-2">
          {pending && lead?.contact_phone && (
            <Button asChild variant="brand" className="h-11 flex-1 gap-1.5">
              <a href={tel(lead.contact_phone)}><Phone className="h-4 w-4" /> Appeler</a>
            </Button>
          )}
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => onOpenCall(row)}>
            {row.kind === 'done' && !row.call.debriefed ? 'CR à écrire' : 'Fiche'}
          </Button>
        </div>
      </div>
    )
  }

  const heading = (label: string) => <h2 className="mt-2 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{label}</h2>

  return (
    <div className="flex flex-col gap-2">
      {heading(day.session ? `Appels · ${fmtMinutes(day.session.startMin)} – ${fmtMinutes(day.session.endMin)}` : 'Appels')}
      {day.rows.length === 0 && overflowRows.length === 0 && (
        <p className="rounded-xl border border-dashed border-[var(--border-color)] px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">
          {day.session ? 'Aucun appel dû ce jour-là.' : 'Pas de séance d’appels ce jour-là.'}
        </p>
      )}
      {day.rows.map((r) => card(r))}
      {overflowRows.length > 0 && heading(`À reporter · ${overflowRows.length}`)}
      {overflowRows.map((r) => card(r, true))}
      {day.chips.filter((c) => c.tone !== 'danger').map((c) => (
        <p key={c.label} className="text-[12.5px] text-[var(--text-secondary)]">{c.label}</p>
      ))}

      {tasks.length > 0 && heading('Tâches')}
      {tasks.map((t) => (
        <div key={t.id} className={cn('flex items-start gap-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3.5', t.done && 'opacity-55')}>
          <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--border-strong)]" aria-hidden />
          <div className="min-w-0">
            <div className={cn('text-[14px] font-medium text-[var(--text-primary)]', t.done && 'line-through')}>{t.title}</div>
            <div className="text-[12.5px] text-[var(--text-secondary)]">{t.when}</div>
          </div>
        </div>
      ))}

      {rdvs.length > 0 && heading('RDV')}
      {rdvs.map((b) => (
        <Link key={b.id} to="/rdv" className="rounded-xl border p-3.5 text-[14px] font-semibold" style={{ backgroundColor: 'var(--accent-blue-bg)', borderColor: '#BFDBFE', color: 'var(--accent-blue)' }}>
          {fmtMinutes(b.startMin)} · {b.title}
        </Link>
      ))}
    </div>
  )
}
