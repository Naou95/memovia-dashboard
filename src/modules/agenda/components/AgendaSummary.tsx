import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { daySummary, fmtMinutes } from '@/lib/agenda'
import type { AgendaDay, SessionRow } from '@/types/agenda'
import type { Task } from '@/types/tasks'
import { dayMonth, pendingChip, dateFr } from '../display'

interface AgendaSummaryProps {
  /** Le jour regardé (aujourd'hui par défaut). */
  day: AgendaDay | null
  mailsToReview: number
  undatedTasks: Task[]
  mineOnly: boolean
  onMineOnly: (v: boolean) => void
  onOpenCall: (row: SessionRow) => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-[var(--border-subtle)] py-2 text-[13.5px] first:border-t-0">
      <span className="text-[var(--text-primary)]">{label}</span>
      <span className="text-right font-semibold tabular-nums text-[var(--text-primary)]">{children}</span>
    </div>
  )
}

/** Le panneau au repos : le prochain appel, ce qui reste à faire, les tâches du jour. */
export function AgendaSummary({ day, mailsToReview, undatedTasks, mineOnly, onMineOnly, onOpenCall }: AgendaSummaryProps) {
  if (!day) return null
  const sum = daySummary(day)
  const next = day.rows.find((r) => r.kind === 'pending')
  const tasks = [
    ...day.allDayTasks.map((t) => ({ id: t.task.id, title: t.task.title, done: t.task.status === 'done', when: t.lateDays > 0 ? `en retard de ${t.lateDays} j` : 'sans heure', late: t.lateDays > 0 })),
    ...day.blocks.filter((b) => b.kind === 'task').map((b) => ({ id: b.refId, title: b.title, done: b.done, when: `${fmtMinutes(b.startMin)} · ${b.durMin} min`, late: false })),
  ]
  const rdvs = day.blocks.filter((b) => b.kind === 'rdv')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-[var(--border-color)] px-4 pb-3 pt-3.5">
        <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{day.isToday ? 'Aujourd’hui' : 'Le'} · {dayMonth(day.day)}</div>
        <h2 className="mt-0.5 text-[20px] font-bold tracking-tight text-[var(--text-primary)]">Séance d’appels</h2>
        <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
          {day.session
            ? `${fmtMinutes(day.session.startMin)} – ${fmtMinutes(day.session.endMin)} · ${sum.total} appel${sum.total > 1 ? 's' : ''}, ${sum.done} fait${sum.done > 1 ? 's' : ''}`
            : 'Pas de séance ce jour-là.'}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {next && next.kind === 'pending' ? (
          <div className="mt-3 flex flex-col gap-1 rounded-[10px] border px-3 py-2.5" style={{ borderColor: '#DDD6FE', backgroundColor: '#FAF8FF' }}>
            <span className="font-mono text-[12px] text-[var(--memovia-violet)]">Prochain · {fmtMinutes(next.startMin)}</span>
            <b className="text-[14px] text-[var(--text-primary)]">{next.call.lead.name}</b>
            <span className="text-[13px] text-[var(--text-secondary)]">{next.call.lead.contact_name || 'Contact à identifier'} · {pendingChip(next.call).label}</span>
            <Button type="button" variant="brand" size="sm" className="mt-1.5 self-start" onClick={() => onOpenCall(next)}>Ouvrir la fiche</Button>
          </div>
        ) : (
          <p className="mt-3 rounded-[10px] border border-dashed border-[var(--border-color)] px-3 py-3 text-[13px] text-[var(--text-secondary)]">
            {sum.total === 0
              ? 'Aucun appel dû. Les appels apparaissent quand une étape d’appel de campagne arrive à échéance, ou quand une relance de lead tombe.'
              : 'Tous les appels du jour sont passés.'}
          </p>
        )}

        <h3 className="mb-1 mt-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Reste à faire</h3>
        <Row label="Appels à passer">{sum.pending}</Row>
        <Row label="Appels sans CR"><span className={cn(sum.noCr > 0 && 'text-[var(--danger)]')}>{sum.noCr}</span></Row>
        <Row label="Mails à valider dans la Revue">
          {mailsToReview > 0 ? <Link to="/campagnes" className="text-[var(--memovia-violet)] hover:underline">{mailsToReview} → Campagnes</Link> : 0}
        </Row>
        {rdvs.map((b) => (
          <Row key={b.id} label="RDV"><Link to="/rdv" className="hover:underline">{fmtMinutes(b.startMin)} · {b.title}</Link></Row>
        ))}

        <div className="mb-1 mt-4 flex items-center justify-between gap-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Tâches · {day.isToday ? 'aujourd’hui' : dateFr(day.day)}</h3>
          <div className="inline-flex rounded-lg border border-[var(--border-color)] p-0.5 text-[12px]">
            {([[true, 'Les miennes'], [false, 'Toutes']] as const).map(([v, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => onMineOnly(v)}
                aria-pressed={mineOnly === v}
                className={cn('rounded-md px-2 py-0.5 font-medium', mineOnly === v ? 'bg-[var(--bg-active)] text-[var(--memovia-violet)]' : 'text-[var(--text-secondary)]')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {tasks.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">Aucune tâche ce jour-là.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {tasks.map((t) => (
              <li key={t.id} className={cn('flex items-start gap-2 rounded-lg border border-[var(--border-color)] px-2 py-1.5', t.done && 'opacity-55')}>
                <span className="mt-[3px] h-3.5 w-3.5 shrink-0 rounded border border-[var(--border-strong)]" aria-hidden />
                <span className="min-w-0">
                  <span className={cn('block text-[13px] font-medium text-[var(--text-primary)]', t.done && 'line-through')}>{t.title}</span>
                  <span className={cn('block text-[12px]', t.late ? 'text-[var(--danger)]' : 'text-[var(--text-secondary)]')}>{t.when}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {undatedTasks.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-[12.5px] text-[var(--text-secondary)]">{undatedTasks.length} tâche{undatedTasks.length > 1 ? 's' : ''} sans échéance, hors agenda</summary>
            <ul className="mt-1 space-y-0.5">
              {undatedTasks.map((t) => <li key={t.id} className="text-[13px] text-[var(--text-primary)]">{t.title}</li>)}
            </ul>
          </details>
        )}

        <p className="mt-4 text-[12px] text-[var(--text-muted)]">
          Lecture seule pour l’instant : créer, modifier et déplacer une tâche ou une séance arrivent à l’étape suivante.
        </p>
      </div>
    </div>
  )
}
