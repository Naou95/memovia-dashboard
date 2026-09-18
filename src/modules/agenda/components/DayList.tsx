import { Link } from 'react-router-dom'
import { Phone, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fmtMinutes } from '@/lib/agenda'
import type { AgendaDay, ClassifiedCall, SessionRow } from '@/types/agenda'
import { TONE_STYLE, rowChip, rowLeadName } from '../display'

interface DayListProps {
  day: AgendaDay
  onOpenCall: (row: SessionRow) => void
  onEditTask: (id: string) => void
  onToggleTask: (id: string, done: boolean) => void
  onNewTask: () => void
}

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/**
 * Vue jour sur téléphone : des cartes au pouce plutôt qu'une grille horaire (usage en séance
 * d'appels, d'une main). Mêmes données que la grille. Pas de glisser-déposer ici : une tâche se
 * déplace en l'ouvrant (jour, heure), ce que le formulaire fait aussi bien qu'un geste.
 */
export function DayList({ day, onOpenCall, onEditTask, onToggleTask, onNewTask }: DayListProps) {
  const overflowRows: SessionRow[] = day.overflow.map((call: ClassifiedCall) => ({ kind: 'pending', startMin: -1, call }))
  const tasks = [
    ...day.allDayTasks.map((t) => ({ id: t.task.id, title: t.task.title, when: t.lateDays > 0 ? `en retard de ${t.lateDays} j` : 'sans heure', late: t.lateDays > 0, done: t.task.status === 'done' })),
    ...day.blocks.filter((b) => b.kind === 'task').map((b) => ({ id: b.refId, title: b.title, when: `${fmtMinutes(b.startMin)} · ${b.durMin} min`, late: false, done: b.done })),
  ]
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
            {pending ? 'Fiche et issue' : row.call.debriefed ? 'Fiche' : 'CR à écrire'}
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

      <div className="mt-2 flex items-center justify-between">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Tâches</h2>
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1" onClick={onNewTask}><Plus className="h-3.5 w-3.5" /> Tâche</Button>
      </div>
      {tasks.length === 0 && <p className="text-[13px] text-[var(--text-muted)]">Aucune tâche ce jour-là.</p>}
      {tasks.map((t) => (
        <div key={t.id} className={cn('flex items-start gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3.5', t.done && 'opacity-55')}>
          <input
            type="checkbox"
            checked={t.done}
            aria-label={`${t.done ? 'Rouvrir' : 'Terminer'} : ${t.title}`}
            onChange={(e) => onToggleTask(t.id, e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--memovia-violet)]"
          />
          <button type="button" onClick={() => onEditTask(t.id)} className="min-w-0 flex-1 text-left">
            <span className={cn('block text-[14px] font-medium text-[var(--text-primary)]', t.done && 'line-through')}>{t.title}</span>
            <span className={cn('block text-[12.5px]', t.late ? 'text-[var(--danger)]' : 'text-[var(--text-secondary)]')}>{t.when}</span>
          </button>
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
