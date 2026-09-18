import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAgenda, type UseAgendaResult } from '@/hooks/useAgenda'
import { addDays, daySummary, isoWeekday, parisDay } from '@/lib/agenda'
import type { SessionRow } from '@/types/agenda'
import { CalendarGrid } from './components/CalendarGrid'
import { DayList } from './components/DayList'
import { CallSheet } from './components/CallSheet'
import { AgendaSummary } from './components/AgendaSummary'
import { dayLong, dayMonth, isoWeek } from './display'

type View = 'jour' | 'semaine'

const isDay = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

/** Un jour de semaine : samedi et dimanche ramènent au lundi suivant (l'agenda va du lundi au vendredi). */
function toWeekday(day: string): string {
  const wd = isoWeekday(day)
  return wd === 6 ? addDays(day, 2) : wd === 7 ? addDays(day, 1) : day
}

/**
 * Agenda de prospection (spec 2026-09-15-agenda-prospection-design.md) : qui appeler chaque jour et
 * pourquoi. Grille façon Outlook, en vue jour ou semaine. LECTURE SEULE dans cette PR : aucune
 * écriture ne part de cet écran. L'URL porte l'état (`?date=2026-09-17&vue=semaine`) pour que les
 * liens de l'Accueil et du briefing atterrissent au bon endroit.
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

/** La vue, sans accès à la base : elle reçoit ses données, ce qui la rend testable avec des données fictives. */
export function AgendaView({ agenda, date, view, onGo }: AgendaViewProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [, setTick] = useState(0)

  // « à jour il y a X min » avance sans recharger les données.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const go = (next: { date?: string; vue?: View }) => {
    onGo(next)
    setSelectedKey(null)
  }

  const shift = (dir: 1 | -1) => {
    if (view === 'semaine') return go({ date: addDays(date, 7 * dir) })
    let d = addDays(date, dir)
    while (isoWeekday(d) > 5) d = addDays(d, dir)
    go({ date: d })
  }

  const day = agenda.week.find((d) => d.day === date) ?? null
  const rowsByKey = useMemo(() => {
    const m = new Map<string, SessionRow>()
    for (const d of agenda.week) {
      for (const r of d.rows) m.set(r.call.key, r)
      for (const c of d.overflow) m.set(c.key, { kind: 'pending', startMin: -1, call: c })
    }
    return m
  }, [agenda.week])
  const selected = selectedKey ? rowsByKey.get(selectedKey) ?? null : null

  const noCr = agenda.week.reduce((n, d) => n + daySummary(d).noCr, 0)

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await agenda.refresh()
    } finally {
      setRefreshing(false)
    }
  }

  // Échap referme la fiche (sur téléphone elle couvre tout l'écran).
  useEffect(() => {
    if (!selectedKey) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedKey(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedKey])

  const openCall = (row: SessionRow) => setSelectedKey(row.call.key)

  const sheet = selected && (
    <CallSheet
      row={selected}
      thread={selected.kind === 'pending' && selected.call.campaign ? agenda.threadFor(selected.call.campaign.enrollmentId) : []}
      calls={agenda.callsFor(selected.kind === 'pending' ? selected.call.lead.id : selected.call.leadId)}
      openTasks={agenda.openTasksFor(selected.kind === 'pending' ? selected.call.lead.id : selected.call.leadId)}
      script={agenda.script}
      onClose={() => setSelectedKey(null)}
    />
  )

  return (
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
                  <CalendarGrid days={[day]} hourPx={156} nowMin={agenda.nowMin} detailed selectedKey={selectedKey} onOpenCall={openCall} />
                  {day.overflow.length > 0 && (
                    <div className="mt-3 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3">
                      <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">À reporter · {day.overflow.length}</h2>
                      <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">Ces appels ne tiennent plus dans la séance du jour.</p>
                      <ul className="mt-2 flex flex-col gap-1">
                        {day.overflow.map((c) => (
                          <li key={c.key}>
                            <button type="button" onClick={() => setSelectedKey(c.key)} className="w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-[var(--bg-hover)]">
                              <b className="font-semibold text-[var(--text-primary)]">{c.lead.name}</b>
                              <span className="text-[var(--text-secondary)]"> · {c.lead.contact_name || 'contact à identifier'}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="md:hidden"><DayList day={day} onOpenCall={openCall} /></div>
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
              />
            )}
            <p className="mt-2 text-[12px] text-[var(--text-muted)]">
              Séances d’appels : {agenda.window.days.map((d) => ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'][d - 1]).join(', ')}, de {agenda.window.start} à {agenda.window.end}, {agenda.window.slot_minutes} min par appel.
              Un appel dû un jour sans séance s’affiche à la séance suivante.{view === 'jour' && day && !day.session ? ' Aucune séance ce jour-là.' : ''}
            </p>
          </div>

          {/* Panneau : résumé au repos, fiche d'appel quand un appel est ouvert. Plein écran sur téléphone. */}
          <aside
            className={cn(
              'overflow-hidden border-[var(--border-color)] bg-[var(--bg-secondary)]',
              selected ? 'fixed inset-0 z-50 flex h-[100dvh] flex-col' : 'hidden',
              'lg:sticky lg:inset-auto lg:top-2 lg:z-auto lg:flex lg:h-[calc(100vh-150px)] lg:flex-col lg:rounded-[var(--radius-card)] lg:border lg:shadow-[var(--shadow-xs)]',
            )}
          >
            {sheet || (
              <AgendaSummary
                day={day ?? agenda.week.find((d) => d.isToday) ?? agenda.week[0] ?? null}
                mailsToReview={agenda.mailsToReview}
                undatedTasks={agenda.undatedTasks}
                mineOnly={agenda.mineOnly}
                onMineOnly={agenda.setMineOnly}
                onOpenCall={openCall}
              />
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
