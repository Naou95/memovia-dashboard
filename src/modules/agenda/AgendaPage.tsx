import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from '@dnd-kit/core'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAgenda, type UseAgendaResult } from '@/hooks/useAgenda'
import { addDays, daySummary, fmtMinutes, hasSessionOn, isoWeekday, parisDay, sessionMoveRefusal } from '@/lib/agenda'
import { CallPartiallySavedError } from '@/lib/callActions'
import type { ClassifiedCall, SessionRow } from '@/types/agenda'
import { CALL_RESULT_LABELS, type CallResult } from '@/types/leads'
import { CalendarGrid, type DropHint, type GridHandlers } from './components/CalendarGrid'
import { DayList } from './components/DayList'
import { CallSheet } from './components/CallSheet'
import { AgendaSummary } from './components/AgendaSummary'
import { BlockForm, type Editor } from './components/BlockForm'
import { dayLong, dayMonth, isoWeek } from './display'
import { dropTarget, pointerOf, zoneAt, type DragData, type DropResult } from './dnd'

type View = 'jour' | 'semaine'

const isDay = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

/** Un jour de semaine : samedi et dimanche ramènent au lundi suivant (l'agenda va du lundi au vendredi). */
function toWeekday(day: string): string {
  const wd = isoWeekday(day)
  return wd === 6 ? addDays(day, 2) : wd === 7 ? addDays(day, 1) : day
}

/**
 * Agenda de prospection (spec 2026-09-15-agenda-prospection-design.md) : qui appeler chaque jour et
 * pourquoi, et les tâches autour. Grille façon Outlook, en vue jour ou semaine. L'URL porte l'état
 * (`?date=2026-09-17&vue=semaine`) pour que les liens de l'Accueil et du briefing atterrissent au bon endroit.
 */
export default function AgendaPage() {
  const [params, setParams] = useSearchParams()
  const todayAtLoad = useMemo(() => parisDay(new Date()), [])
  const date = toWeekday(isDay(params.get('date')) ? params.get('date')! : todayAtLoad)
  const view: View = params.get('vue') === 'semaine' ? 'semaine' : 'jour'
  const agenda = useAgenda(date)

  const go = (next: { date?: string; vue?: View }) => {
    const p = new URLSearchParams(params)
    if (next.date) p.set('date', next.date)
    if (next.vue) p.set('vue', next.vue)
    setParams(p, { replace: true })
  }

  return <AgendaView agenda={agenda} date={date} view={view} onGo={go} />
}

interface AgendaViewProps {
  agenda: UseAgendaResult
  date: string
  view: View
  onGo: (next: { date?: string; vue?: View }) => void
}

const OUTCOME_EFFECT: Record<CallResult, string> = {
  joint: 'La séquence passe à l’étape suivante.',
  pas_repondu: 'La séquence passe à l’étape suivante.',
  rappel: 'Rappel dans 2 jours.',
  refus: 'Séquence arrêtée, lead perdu.',
  interesse: 'Séquence arrêtée, lead en discussion.',
}

/** La vue, sans accès à la base : elle reçoit ses données et ses actions, ce qui la rend testable avec des données fictives. */
export function AgendaView({ agenda, date, view, onGo }: AgendaViewProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [dragging, setDragging] = useState<DragData | null>(null)
  const [hint, setHint] = useState<DropHint | null>(null)
  const [dragLabel, setDragLabel] = useState('')
  const [, setTick] = useState(0)
  // Position du pointeur pendant un glisser, suivie par nous-mêmes : le déplacement que donne dnd-kit
  // inclut le défilement de la grille, qui fausserait le calcul (voir targetOf).
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const stopTracking = useRef<(() => void) | null>(null)
  useEffect(() => () => stopTracking.current?.(), [])

  // Le glisser ne démarre qu'après 5 px : un clic reste un clic (ouvrir, cocher).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // « à jour il y a X min » avance sans recharger les données.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const closePanel = () => { setSelectedKey(null); setEditor(null) }

  const go = (next: { date?: string; vue?: View }) => {
    onGo(next)
    closePanel()
  }

  const shift = (dir: 1 | -1) => {
    if (view === 'semaine') return go({ date: addDays(date, 7 * dir) })
    let d = addDays(date, dir)
    while (isoWeekday(d) > 5) d = addDays(d, dir)
    go({ date: d })
  }

  const day = agenda.week.find((d) => d.day === date) ?? null
  // Chaque ligne d'appel, avec le jour où elle s'affiche (« Reporter » part de ce jour-là).
  const rowsByKey = useMemo(() => {
    const m = new Map<string, { row: SessionRow; day: string }>()
    for (const d of agenda.week) {
      for (const r of d.rows) m.set(r.call.key, { row: r, day: d.day })
      for (const c of d.overflow) m.set(c.key, { row: { kind: 'pending', startMin: -1, call: c }, day: d.day })
    }
    return m
  }, [agenda.week])
  const selectedEntry = selectedKey ? rowsByKey.get(selectedKey) ?? null : null
  const selected = selectedEntry?.row ?? null
  const panelOpen = !!editor || !!selected

  const noCr = agenda.week.reduce((n, d) => n + daySummary(d).noCr, 0)

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await agenda.refresh()
    } finally {
      setRefreshing(false)
    }
  }

  // Échap referme la fiche ou le formulaire (sur téléphone ils couvrent tout l'écran).
  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelectedKey(null); setEditor(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen])

  /**
   * Une écriture : elle réussit avec un mot, ou échoue en le disant. Jamais en silence. Rend true si
   * elle a réussi. Le message d'échec reste vrai même pour une écriture en deux temps : celles-là
   * rechargent l'écran quoi qu'il arrive, donc ce qu'on voit est ce qui est en base.
   */
  async function act(work: () => Promise<unknown>, success: string): Promise<boolean> {
    try {
      await work()
      toast.success(success)
      return true
    } catch (err) {
      console.error('[agenda] écriture en échec :', err)
      toast.error('Enregistrement impossible. L’agenda montre ce qui est enregistré.')
      return false
    }
  }

  const sessionOn = (d: string) => hasSessionOn(d, agenda.week, agenda.window)

  const openCall = (row: SessionRow) => { setEditor(null); setSelectedKey(row.call.key) }
  const edit = (next: Editor) => { setSelectedKey(null); setEditor(next) }
  const toggleTask = (id: string, done: boolean) => act(() => agenda.actions.updateTask(id, { done }), done ? 'Tâche terminée.' : 'Tâche rouverte.')

  const handlers: GridHandlers = {
    onCreateAt: (d, startMin) => edit({ mode: 'create', day: d, startMin }),
    onEditTask: (id) => edit({ mode: 'task', id }),
    onEditRdv: (id) => edit({ mode: 'rdv', id }),
    onEditSession: (d) => edit({ mode: 'session', day: d }),
    onToggleTask: toggleTask,
  }

  async function recordOutcome(call: ClassifiedCall, outcome: CallResult, note: string, followUp?: string | null) {
    try {
      await agenda.actions.recordOutcome(call, outcome, note, followUp)
      const effect = call.campaign
        ? OUTCOME_EFFECT[outcome]
        : followUp === undefined ? '' : followUp ? `Prochaine relance : ${dayLong(followUp).toLowerCase()}.` : 'Plus de relance prévue.'
      toast.success(`Appel enregistré : ${CALL_RESULT_LABELS[outcome]}.${effect ? ` ${effect}` : ''}`)
      setSelectedKey(null)
    } catch (err) {
      if (err instanceof CallPartiallySavedError) {
        // L'appel EST écrit : on ferme la fiche, pour qu'il ne soit pas ressaisi (et compté deux fois).
        toast.warning('Appel enregistré, mais la fiche du lead ou la séquence n’a pas suivi. Vérifiez-les avant de ressaisir quoi que ce soit.')
        setSelectedKey(null)
        return
      }
      const already = err instanceof Error && err.message === 'message_not_sendable'
      toast.error(already ? 'Déjà traité ailleurs : l’agenda est rechargé.' : 'Impossible d’enregistrer l’appel.')
      if (already) setSelectedKey(null)
    }
  }

  async function postponeCall(call: ClassifiedCall) {
    const shownDay = rowsByKey.get(call.key)?.day ?? call.dueDay
    try {
      const to = await agenda.actions.postponeCall(call, shownDay)
      toast.success(`Reporté à ${dayLong(to).toLowerCase()}.`)
      setSelectedKey(null)
    } catch (err) {
      const reason = err instanceof Error ? err.message : ''
      if (reason === 'message_not_sendable' || reason === 'enrollment_not_active') {
        toast.error(reason === 'message_not_sendable' ? 'Déjà traité ailleurs : l’agenda est rechargé.' : 'Séquence arrêtée entre-temps : l’agenda est rechargé.')
        setSelectedKey(null)
        return
      }
      toast.error('Report impossible. L’agenda montre ce qui est enregistré.')
    }
  }

  // ── Glisser-déposer ──────────────────────────────────────────────────────────
  /**
   * Où le bloc atterrirait. Tout se mesure à l'instant, en coordonnées écran : la colonne est celle
   * sous le pointeur, et le haut du bloc est le pointeur moins l'endroit où on l'a attrapé. Constaté
   * au vrai navigateur avant ce calcul : lâché sur mer. 10:00, un bloc partait sur jeu. 10:30 (la
   * surface du fantôme débordait sur jeudi, et le défilement automatique était compté deux fois).
   */
  function targetOf(e: DragMoveEvent | DragEndEvent): DropResult | null {
    const drag = e.active.data.current as DragData | undefined
    const initial = e.active.rect.current.initial
    const start = pointerOf(e.activatorEvent)
    const now = pointer.current ?? start
    if (!drag || !initial || !start || !now) return null
    const zone = zoneAt(now.x, now.y)
    if (!zone) return null
    const t = dropTarget(drag, zone.data, now.y - (start.y - initial.top), zone.top)
    if (t.ok && drag.kind === 'session') {
      const refusal = sessionMoveRefusal(drag.id, t.day, sessionOn)
      if (refusal) return { ok: false, reason: refusal }
    }
    return t
  }

  function onDragStart(e: DragStartEvent) {
    setDragging((e.active.data.current as DragData | undefined) ?? null)
    setDragLabel('Relâchez sur le calendrier')
    pointer.current = pointerOf(e.activatorEvent)
    // En capture sur window : servi avant dnd-kit, donc à jour quand onDragMove le lit.
    const track = (ev: PointerEvent) => { pointer.current = { x: ev.clientX, y: ev.clientY } }
    window.addEventListener('pointermove', track, { capture: true })
    stopTracking.current = () => window.removeEventListener('pointermove', track, { capture: true })
  }

  function onDragMove(e: DragMoveEvent) {
    const drag = e.active.data.current as DragData | undefined
    const t = targetOf(e)
    if (!drag || !t || !t.ok) {
      setHint((h) => (h ? null : h))
      setDragLabel(t && !t.ok ? t.reason : 'Relâchez sur le calendrier')
      return
    }
    setHint((h) => (h && h.day === t.day && h.startMin === t.startMin ? h : { day: t.day, startMin: t.startMin, durMin: drag.durMin }))
    setDragLabel(`${dayLong(t.day).toLowerCase()} · ${t.startMin == null ? 'sans heure' : `${fmtMinutes(t.startMin)} – ${fmtMinutes(t.startMin + drag.durMin)}`}`)
  }

  function endDrag() {
    setDragging(null)
    setHint(null)
    stopTracking.current?.()
    stopTracking.current = null
    pointer.current = null
  }

  function onDragEnd(e: DragEndEvent) {
    const drag = e.active.data.current as DragData | undefined
    const t = targetOf(e)
    endDrag()
    if (!drag || !t) return
    if (!t.ok) { toast.error(t.reason); return }
    const { day: to, startMin } = t
    if (drag.kind !== 'task' && startMin == null) return
    const where = `${dayLong(to).toLowerCase()}${startMin == null ? ', sans heure' : ` à ${fmtMinutes(startMin)}`}`
    const write =
      drag.kind === 'task' ? act(() => agenda.actions.updateTask(drag.id, { day: to, startMin }), `Tâche déplacée : ${where}.`)
      : drag.kind === 'rdv' ? act(() => agenda.actions.updateRdv(drag.id, { day: to, startMin }), `RDV déplacé : ${where}.`)
      : act(
          () => agenda.actions.saveSession(to, startMin!, drag.durMin, drag.id),
          to === drag.id
            ? `Séance d’appels : ${where}.`
            : `Séance d’appels déplacée : ${where}. Les appels dus ${dayLong(drag.id).toLowerCase()} passent à la séance suivante.`,
        )
    // Le bloc ne bouge qu'une fois la base relue : d'ici là, le cadre pointillé reste sur l'arrivée,
    // pour qu'il n'ait pas l'air d'être revenu. En cas d'échec, le toast le dit et le bloc reste où il était.
    const pending: DropHint = { day: to, startMin, durMin: drag.durMin }
    setHint(pending)
    void write.finally(() => setHint((h) => (h === pending ? null : h)))
  }

  const summaryDay = day ?? agenda.week.find((d) => d.isToday) ?? agenda.week[0] ?? null

  const panel = editor ? (
    <BlockForm key={JSON.stringify(editor)} editor={editor} agenda={agenda} onClose={() => setEditor(null)} />
  ) : selected ? (
    <CallSheet
      key={selected.call.key}
      row={selected}
      thread={selected.kind === 'pending' && selected.call.campaign ? agenda.threadFor(selected.call.campaign.enrollmentId) : []}
      calls={agenda.callsFor(selected.kind === 'pending' ? selected.call.lead.id : selected.call.leadId)}
      openTasks={agenda.openTasksFor(selected.kind === 'pending' ? selected.call.lead.id : selected.call.leadId)}
      script={agenda.script}
      onClose={() => setSelectedKey(null)}
      onRecord={recordOutcome}
      onPostpone={postponeCall}
      suggestFollowUp={agenda.actions.suggestFollowUp}
    />
  ) : (
    <AgendaSummary
      day={summaryDay}
      week={agenda.week}
      mailsToReview={agenda.mailsToReview}
      undatedTasks={agenda.undatedTasks}
      mineOnly={agenda.mineOnly}
      onMineOnly={agenda.setMineOnly}
      onOpenCall={openCall}
      onEditTask={(id) => edit({ mode: 'task', id })}
      onToggleTask={toggleTask}
      onAddTask={(title, d) => act(() => agenda.actions.createTask({ title, day: d, startMin: null, durMin: 30, leadId: null }), 'Tâche ajoutée, sans heure. Glissez-la sur le calendrier pour la planifier.')}
    />
  )

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={endDrag}>
      <div className="space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)} aria-label={view === 'jour' ? 'Jour précédent' : 'Semaine précédente'}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
              {view === 'jour' ? dayLong(date) : `Semaine ${isoWeek(date)}`}
              <span className="ml-2 hidden text-[13px] font-medium text-[var(--text-secondary)] sm:inline">
                {view === 'jour' ? `semaine ${isoWeek(date)}` : `${dayMonth(agenda.weekDays[0])} – ${dayMonth(agenda.weekDays[4])}`}
              </span>
            </h1>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)} aria-label={view === 'jour' ? 'Jour suivant' : 'Semaine suivante'}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => go({ date: toWeekday(agenda.today) })}>Aujourd’hui</Button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-0.5" role="group" aria-label="Vue">
              {(['jour', 'semaine'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => go({ vue: v })}
                  aria-pressed={view === v}
                  className={cn('rounded-md px-3 py-1 text-[13px] font-medium capitalize', view === v ? 'bg-[var(--bg-active)] text-[var(--memovia-violet)]' : 'text-[var(--text-secondary)]')}
                >
                  {v}
                </button>
              ))}
            </div>
            <span className="text-[12px] text-[var(--text-muted)]">
              {agenda.loadedAt ? `à jour ${formatDistanceToNow(agenda.loadedAt, { locale: fr, addSuffix: true })}` : 'chargement…'}
            </span>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} /> Actualiser
            </Button>
          </div>
        </header>

        {agenda.error && !agenda.isLoading && (
          <div className="rounded-md border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
            <b>{agenda.error}</b>
            {agenda.schemaMissing && <span> L’agenda lit des colonnes ajoutées par <code>supabase/migrations/00056_agenda.sql</code> : à appliquer avant d’ouvrir cet écran.</span>}
          </div>
        )}

        {noCr > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border px-3.5 py-2.5 text-[13.5px]" style={{ backgroundColor: 'var(--danger-bg)', borderColor: '#FECACA', color: 'var(--danger)' }}>
            <b>{noCr} appel{noCr > 1 ? 's' : ''} sans compte rendu</b>
            <span>cette semaine. En attendant le débrief, notez l’essentiel au moment d’enregistrer l’appel.</span>
          </div>
        )}

        {agenda.isLoading ? (
          <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-[var(--border-color)]" />)}
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className="min-w-0">
              {view === 'jour' && day ? (
                <>
                  <div className="hidden md:block" data-testid="agenda-grille-jour">
                    <CalendarGrid days={[day]} hourPx={156} nowMin={agenda.nowMin} detailed selectedKey={selectedKey} onOpenCall={openCall} handlers={handlers} hint={hint} />
                    {day.overflow.length > 0 && (
                      <div className="mt-3 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3">
                        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">À reporter · {day.overflow.length}</h2>
                        <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">Ces appels ne tiennent plus dans la séance du jour.</p>
                        <ul className="mt-2 flex flex-col gap-1">
                          {day.overflow.map((c) => (
                            <li key={c.key}>
                              <button type="button" onClick={() => openCall({ kind: 'pending', startMin: -1, call: c })} className="w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-[var(--bg-hover)]">
                                <b className="font-semibold text-[var(--text-primary)]">{c.lead.name}</b>
                                <span className="text-[var(--text-secondary)]"> · {c.lead.contact_name || 'contact à identifier'}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="md:hidden">
                    <DayList day={day} onOpenCall={openCall} onEditTask={(id) => edit({ mode: 'task', id })} onToggleTask={toggleTask} onNewTask={() => edit({ mode: 'create', day: day.day, startMin: null })} />
                  </div>
                </>
              ) : (
                <CalendarGrid
                  days={agenda.week}
                  hourPx={64}
                  nowMin={agenda.nowMin}
                  detailed={false}
                  selectedKey={selectedKey}
                  onOpenCall={openCall}
                  onOpenDay={(d) => go({ date: d, vue: 'jour' })}
                  handlers={handlers}
                  hint={hint}
                />
              )}
              <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                Séances d’appels : {agenda.window.days.map((d) => ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'][d - 1]).join(', ')}, de {agenda.window.start} à {agenda.window.end}, {agenda.window.slot_minutes} min par appel.
                Un appel dû un jour sans séance s’affiche à la séance suivante.{view === 'jour' && day && !day.session ? ' Aucune séance ce jour-là.' : ''}
              </p>
            </div>

            {/* Panneau : résumé et tâches au repos ; fiche d'appel ou formulaire quand on ouvre quelque chose. Plein écran sur téléphone. */}
            <aside
              className={cn(
                'overflow-hidden border-[var(--border-color)] bg-[var(--bg-secondary)]',
                panelOpen ? 'fixed inset-0 z-50 flex h-[100dvh] flex-col' : 'hidden',
                'lg:sticky lg:inset-auto lg:top-2 lg:z-auto lg:flex lg:h-[calc(100vh-150px)] lg:flex-col lg:rounded-[var(--radius-card)] lg:border lg:shadow-[var(--shadow-xs)]',
              )}
            >
              {panel}
            </aside>
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="pointer-events-none w-56 rounded-lg border border-[var(--memovia-violet)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[12px] shadow-xl">
            <div className="truncate font-semibold text-[var(--text-primary)]">{dragging.title}</div>
            <div className="font-mono text-[11px] text-[var(--memovia-violet)]">{dragLabel}</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
