import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { DAY_END_MIN, DAY_START_MIN, fmtMinutes, parisDay, parisMinutes } from '@/lib/agenda'
import type { UseAgendaResult } from '@/hooks/useAgenda'
import { dayLong } from '../display'

/** Ce que le panneau édite : un créneau vide à remplir, une tâche, un RDV, ou la séance d'appels d'un jour. */
export type Editor =
  | { mode: 'create'; day: string; startMin: number | null }
  | { mode: 'task'; id: string }
  | { mode: 'rdv'; id: string }
  | { mode: 'session'; day: string }

type Kind = 'task' | 'rdv' | 'session'

interface BlockFormProps {
  editor: Editor
  agenda: UseAgendaResult
  onClose: () => void
}

const DURATIONS = [15, 20, 30, 45, 60, 90, 120, 150, 180]
const TIMES = Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 15 }, (_, i) => DAY_START_MIN + i * 15)
const fmtDuration = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`)
const selectClass =
  'h-10 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]'

interface Initial {
  kind: Kind
  title: string
  day: string
  startMin: number | null
  durMin: number
  leadId: string | null
  done: boolean
  /** Séance : le jour d'origine, pour le marquer « sans séance » si elle change de jour. */
  fromDay?: string
}

function initialOf(editor: Editor, agenda: UseAgendaResult): Initial | null {
  if (editor.mode === 'create') return { kind: 'task', title: '', day: editor.day, startMin: editor.startMin, durMin: 30, leadId: null, done: false }
  if (editor.mode === 'task') {
    const t = agenda.tasks.find((x) => x.id === editor.id)
    if (!t) return null
    const day = (t.scheduled_at ? parisDay(t.scheduled_at) : t.due_date) ?? agenda.today
    return { kind: 'task', title: t.title, day, startMin: t.scheduled_at ? parisMinutes(t.scheduled_at) : null, durMin: t.duration_min ?? 30, leadId: t.lead_id, done: t.status === 'done' }
  }
  if (editor.mode === 'rdv') {
    const b = agenda.week.flatMap((d) => d.blocks).find((x) => x.kind === 'rdv' && x.refId === editor.id)
    if (!b) return null
    return { kind: 'rdv', title: b.title, day: b.day, startMin: b.startMin, durMin: b.durMin, leadId: b.leadId, done: false }
  }
  const s = agenda.week.find((d) => d.day === editor.day)?.session
  if (!s) return null
  return { kind: 'session', title: 'Séance d’appels', day: editor.day, startMin: s.startMin, durMin: s.endMin - s.startMin, leadId: null, done: false, fromDay: editor.day }
}

/**
 * Créer ou modifier un bloc du calendrier. C'est aussi l'autre façon de « déplacer » : tout ce que fait
 * le glisser-déposer se fait ici au clavier ou au doigt (jour, heure, durée).
 */
export function BlockForm({ editor, agenda, onClose }: BlockFormProps) {
  const initial = initialOf(editor, agenda)
  const [kind, setKind] = useState<Kind>(initial?.kind ?? 'task')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [day, setDay] = useState(initial?.day ?? agenda.today)
  const [startMin, setStartMin] = useState<number | null>(initial?.startMin ?? null)
  const [durMin, setDurMin] = useState(initial?.durMin ?? 30)
  const [leadId, setLeadId] = useState<string | null>(initial?.leadId ?? null)
  const [done, setDone] = useState(initial?.done ?? false)
  const [busy, setBusy] = useState(false)

  if (!initial) {
    return (
      <div className="p-4 text-[13.5px] text-[var(--text-secondary)]">
        Cet élément n’existe plus. <button type="button" className="font-medium text-[var(--memovia-violet)] hover:underline" onClick={onClose}>Retour à l’agenda</button>
      </div>
    )
  }

  const creating = editor.mode === 'create'
  const task = editor.mode === 'task' ? agenda.tasks.find((t) => t.id === editor.id) ?? null : null
  const needsTime = kind !== 'task'
  const durations = DURATIONS.includes(durMin) ? DURATIONS : [...DURATIONS, durMin].sort((a, b) => a - b)
  const heading = creating ? 'Créer' : kind === 'task' ? 'Tâche' : kind === 'rdv' ? 'RDV' : 'Séance d’appels'

  async function run(work: () => Promise<void>, message: string) {
    setBusy(true)
    try {
      await work()
      toast.success(message)
      onClose()
    } catch (err) {
      console.error('[agenda] écriture en échec :', err)
      toast.error('Enregistrement impossible. Rien n’a été modifié.')
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = title.trim()
    if (kind !== 'session' && !name) { toast.error('Un titre, au moins.'); return }
    const start = needsTime ? startMin ?? 9 * 60 : startMin
    const input = { title: name, day, startMin: start, durMin, leadId }
    const at = start == null ? 'sans heure' : `à ${fmtMinutes(start)}`
    if (kind === 'session') return run(() => agenda.actions.saveSession(day, start ?? 9 * 60, durMin, initial?.fromDay), `Séance d’appels : ${dayLong(day).toLowerCase()} ${at}.`)
    if (creating) {
      return kind === 'rdv'
        ? run(() => agenda.actions.createRdv(input), `RDV créé : ${dayLong(day).toLowerCase()} ${at}.`)
        : run(() => agenda.actions.createTask(input), `Tâche créée : ${dayLong(day).toLowerCase()}, ${at}.`)
    }
    if (editor.mode === 'rdv') return run(() => agenda.actions.updateRdv(editor.id, input), 'RDV enregistré.')
    if (editor.mode === 'task') return run(() => agenda.actions.updateTask(editor.id, { ...input, done }), 'Tâche enregistrée.')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-[var(--border-color)] px-4 pb-3 pt-3.5">
        <button type="button" onClick={onClose} className="mb-2 inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)]">
          <ChevronLeft className="h-4 w-4" /> Agenda
        </button>
        <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--memovia-violet)]">{heading}</div>
        <h2 className="mt-0.5 text-[20px] font-bold tracking-tight text-[var(--text-primary)]">{creating ? dayLong(day) : initial.title}</h2>
      </header>

      <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-4">
        {creating && (
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="inline-flex rounded-lg border border-[var(--border-color)] p-0.5" role="radiogroup" aria-label="Type">
              {([['task', 'Tâche'], ['rdv', 'RDV'], ['session', 'Séance d’appels']] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => { setKind(k); if (k === 'session') setDurMin(150); else if (durMin === 150) setDurMin(30) }}
                  className={cn('rounded-md px-3 py-1 text-[13px] font-medium', kind === k ? 'bg-[var(--bg-active)] text-[var(--memovia-violet)]' : 'text-[var(--text-secondary)]')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {kind !== 'session' && (
          <div className="space-y-1.5">
            <Label htmlFor="agenda-titre">Titre</Label>
            <Input id="agenda-titre" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'rdv' ? 'Ex : Visio · démo formatrice CAP' : 'Ex : Rappeler Mme Lefranc'} autoFocus={creating} autoComplete="off" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="agenda-jour">Jour</Label>
            <Input id="agenda-jour" type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agenda-heure">Heure</Label>
            <select id="agenda-heure" className={selectClass} value={startMin ?? ''} onChange={(e) => setStartMin(e.target.value === '' ? null : Number(e.target.value))}>
              {!needsTime && <option value="">Sans heure</option>}
              {startMin != null && !TIMES.includes(startMin) && <option value={startMin}>{fmtMinutes(startMin)}</option>}
              {TIMES.map((m) => <option key={m} value={m}>{fmtMinutes(m)}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="agenda-duree">Durée</Label>
            <select id="agenda-duree" className={selectClass} value={durMin} onChange={(e) => setDurMin(Number(e.target.value))}>
              {durations.map((m) => <option key={m} value={m}>{fmtDuration(m)}</option>)}
            </select>
          </div>
          {kind !== 'session' && (
            <div className="space-y-1.5">
              <Label htmlFor="agenda-lead">Lead</Label>
              <select id="agenda-lead" className={selectClass} value={leadId ?? ''} onChange={(e) => setLeadId(e.target.value || null)}>
                <option value="">Aucun</option>
                {agenda.leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {kind === 'session' && (
          <p className="text-[12.5px] text-[var(--text-muted)]">
            Les appels dus ce jour-là suivent la séance. Si elle change de jour, le jour quitté n’a plus de séance et ses appels s’affichent à la suivante.
          </p>
        )}

        {editor.mode === 'task' && (
          <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-[var(--text-primary)]">
            <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} className="h-4 w-4 accent-[var(--memovia-violet)]" /> Terminée
          </label>
        )}

        {editor.mode === 'rdv' && (
          <p className="text-[12.5px] text-[var(--text-muted)]">Trame de préparation, document et compte rendu : <Link to="/rdv" className="font-medium text-[var(--memovia-violet)] hover:underline">section RDV</Link>.</p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" variant="brand" disabled={busy} className="h-11 md:h-10">{busy ? 'Enregistrement…' : creating ? 'Créer' : 'Enregistrer'}</Button>
          <Button type="button" variant="outline" onClick={onClose} className="h-11 md:h-10">Annuler</Button>
          {editor.mode === 'session' && initial.fromDay && agenda.week.find((d) => d.day === editor.day)?.session?.overridden && (
            <Button type="button" variant="ghost" disabled={busy} className="h-11 md:h-10" onClick={() => run(() => agenda.actions.resetSession(editor.day), 'Séance remise au créneau par défaut.')}>
              Créneau par défaut
            </Button>
          )}
          {task && (agenda.actions.canDeleteTask(task) ? (
            <Button type="button" variant="ghost" disabled={busy} className="h-11 text-[var(--danger)] md:h-10" onClick={() => run(() => agenda.actions.deleteTask(task.id), 'Tâche supprimée.')}>
              Supprimer
            </Button>
          ) : (
            <span className="self-center text-[12px] text-[var(--text-muted)]">
              {task.auto_key ? 'Tâche automatique : on la termine, on ne la supprime pas.' : 'Créée par un automatisme ou par quelqu’un d’autre : on peut la terminer.'}
            </span>
          ))}
        </div>
      </form>
    </div>
  )
}
