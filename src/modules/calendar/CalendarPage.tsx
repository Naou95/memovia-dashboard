import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import {
  format,
  parse,
  startOfWeek,
  getDay,
  addDays,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'
import 'react-big-calendar/lib/css/react-big-calendar.css'

import { useCalendar } from '@/hooks/useCalendar'
import { useAuth } from '@/contexts/AuthContext'
import { CalendarEmptyState } from './components/CalendarEmptyState'
import { CreateEventModal } from './components/CreateEventModal'
import { EventPopover } from './components/EventPopover'
import type { RBCEvent, CalendarEvent, AvailabilitySlot } from '@/types/calendar'

// ── Couleurs ───────────────────────────────────────────────────────────────────

const COLOR_NAOUFEL = '#7C3AED'
const COLOR_EMIR    = '#00E5CC'
const COLOR_AVAIL   = '#10B981'

// ── date-fns localizer (français) ──────────────────────────────────────────────

const locales = { fr }

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { locale: fr }),
  getDay,
  locales,
})

const messages = {
  allDay: 'Journée',
  previous: 'Précédent',
  next: 'Suivant',
  today: "Aujourd'hui",
  month: 'Mois',
  week: 'Semaine',
  day: 'Jour',
  agenda: 'Agenda',
  date: 'Date',
  time: 'Heure',
  event: 'Événement',
  noEventsInRange: 'Aucun événement sur cette période',
  showMore: (total: number) => `+${total} autre${total > 1 ? 's' : ''}`,
}

// ── Disponibilités communes ────────────────────────────────────────────────────

function computeAvailableSlots(
  allEvents: CalendarEvent[],
  referenceDate = new Date(),
  daysAhead = 7,
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = []
  let dayCount = 0
  let cursor = addDays(startOfWeek(referenceDate, { locale: fr }), -1)

  while (dayCount < daysAhead) {
    cursor = addDays(cursor, 1)
    const dow = cursor.getDay()
    if (dow === 0 || dow === 6) continue
    dayCount++

    for (let hour = 9; hour < 18; hour++) {
      for (const minute of [0, 30]) {
        const slotStart = new Date(cursor)
        slotStart.setHours(hour, minute, 0, 0)
        const slotEnd = new Date(slotStart)
        slotEnd.setMinutes(slotEnd.getMinutes() + 30)

        const isBusy = allEvents.some((ev) => {
          if (ev.allDay) return false
          const evStart = new Date(ev.start)
          const evEnd = new Date(ev.end)
          return evStart < slotEnd && evEnd > slotStart
        })

        if (!isBusy) {
          const last = slots[slots.length - 1]
          if (last && last.end.getTime() === slotStart.getTime()) {
            last.end = slotEnd
          } else {
            slots.push({ start: slotStart, end: slotEnd })
          }
        }
      }
    }
  }

  return slots
}

function fmtHour(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}h${m}`
}

// ── Helpers RBC ────────────────────────────────────────────────────────────────

function toRBCEvents(
  ownEvents: CalendarEvent[],
  emirEvents: CalendarEvent[],
  availSlots: AvailabilitySlot[],
  showEmir: boolean,
  showAvailability: boolean,
): RBCEvent[] {
  const result: RBCEvent[] = ownEvents.map((ev) => ({
    id: ev.id,
    title: ev.title,
    start: new Date(ev.start),
    end: new Date(ev.end),
    allDay: ev.allDay,
    resource: ev,
  }))

  if (showEmir) {
    emirEvents.forEach((ev) => {
      result.push({
        id: ev.id,
        title: ev.title,
        start: new Date(ev.start),
        end: new Date(ev.end),
        allDay: ev.allDay,
        resource: ev,
      })
    })
  }

  if (showAvailability) {
    availSlots.forEach((slot, i) => {
      const title = `Libre · ${fmtHour(slot.start)} – ${fmtHour(slot.end)}`
      const fakeEvent: CalendarEvent = {
        id: `avail_${i}`,
        title,
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        allDay: false,
        provider: 'google',
        owner: { name: 'availability', color: COLOR_AVAIL },
      }
      result.push({
        id: fakeEvent.id,
        title,
        start: slot.start,
        end: slot.end,
        allDay: false,
        resource: fakeEvent,
      })
    })
  }

  return result
}

function eventStyleGetter(event: RBCEvent) {
  const isAvailability = event.resource.id.startsWith('avail_')

  if (isAvailability) {
    return {
      style: {
        backgroundColor: 'rgba(16, 185, 129, 0.10)',
        borderLeft: `3px solid ${COLOR_AVAIL}`,
        borderTop: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        color: '#059669',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 500 as const,
        padding: '2px 8px',
        cursor: 'default',
        opacity: 0.85,
      },
    }
  }

  const color = event.resource.owner?.color ?? COLOR_NAOUFEL
  const isEmir = color === COLOR_EMIR

  return {
    style: {
      backgroundColor: isEmir ? 'rgba(0, 229, 204, 0.12)' : 'rgba(124, 58, 237, 0.12)',
      borderLeft: `3px solid ${color}`,
      borderTop: 'none',
      borderRight: 'none',
      borderBottom: 'none',
      color: isEmir ? '#0891B2' : '#5B21B6',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: 500 as const,
      padding: '2px 8px',
      cursor: 'pointer',
    },
  }
}

// ── AgendaToggle ──────────────────────────────────────────────────────────────

function AgendaToggle({
  color,
  label,
  checked,
  loading = false,
  onToggle,
}: {
  color: string
  label: string
  checked: boolean
  loading?: boolean
  onToggle?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-black/[0.03]"
    >
      <div
        className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border-[1.5px] transition-colors"
        style={{
          borderColor: color,
          backgroundColor: checked ? color : 'transparent',
        }}
      >
        {checked && (
          <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 10 10">
            <path
              d="M1.5 5l3 3 4-4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span className="text-[12px] font-medium text-[var(--text-primary)]">{label}</span>
      {loading && (
        <RefreshCw className="h-3 w-3 flex-shrink-0 animate-spin text-[var(--text-muted)]" />
      )}
    </button>
  )
}

// ── View Toggle ───────────────────────────────────────────────────────────────

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: 'month', label: 'Mois' },
  { value: 'week', label: 'Semaine' },
  { value: 'day', label: 'Jour' },
]

function ViewToggle({ current, onChange }: { current: View; onChange: (v: View) => void }) {
  return (
    <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-0.5">
      {VIEW_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          aria-pressed={current === value}
          className={`rounded-md px-3 py-1 text-[12px] font-medium transition-all ${
            current === value
              ? 'bg-white text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── CalendarPage ───────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<View>('month')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [showEmir, setShowEmir] = useState(true)
  const [showAvailability, setShowAvailability] = useState(false)
  const [popoverEvent, setPopoverEvent] = useState<CalendarEvent | null>(null)
  const [popoverRect, setPopoverRect] = useState<DOMRect | null>(null)
  const calendarRef = useRef<HTMLDivElement>(null)

  const { data, allUsersData, isLoading, isLoadingAll, error, refetch, refetchAll, createMeet, startOAuth } = useCalendar(currentDate)
  const { user } = useAuth()
  const isEmir = user?.role === 'admin_bizdev'
  const myName = user?.profile?.full_name ?? ''

  const needsAllUsers = showEmir || showAvailability

  useEffect(() => {
    if (needsAllUsers && !allUsersData && !isLoadingAll) {
      refetchAll()
    }
  }, [needsAllUsers, allUsersData, isLoadingAll, refetchAll])

  // Gérer les retours OAuth
  useEffect(() => {
    const connected = searchParams.get('connected')
    const oauthError = searchParams.get('error')

    if (connected === 'google') {
      toast.success('Google Calendar connecté !')
      refetch()
      setSearchParams({})
    }
    if (oauthError) {
      const desc = searchParams.get('error_description') ?? oauthError
      if (oauthError === 'access_denied') {
        toast.error('Connexion annulée.')
      } else {
        toast.error(`Erreur de connexion : ${desc}`)
      }
      setSearchParams({})
    }
  }, [searchParams, setSearchParams, refetch])

  const ownEvents = useMemo(() => {
    if (allUsersData?.events) {
      return allUsersData.events.filter(
        (ev) => ev.owner?.color !== COLOR_EMIR,
      )
    }
    return data?.events ?? []
  }, [data?.events, allUsersData?.events])

  const emirEvents = useMemo(() => {
    if (!allUsersData?.events) return []
    return allUsersData.events.filter(
      (ev) => ev.owner?.color === COLOR_EMIR,
    )
  }, [allUsersData?.events])

  const availableSlots = useMemo(() => {
    if (!showAvailability || !allUsersData?.events) return []
    return computeAvailableSlots(allUsersData.events, currentDate)
  }, [showAvailability, allUsersData?.events, currentDate])

  const rbcEvents = useMemo(
    () => toRBCEvents(ownEvents, emirEvents, availableSlots, showEmir, showAvailability),
    [ownEvents, emirEvents, availableSlots, showEmir, showAvailability],
  )

  const handleNavigate = useCallback((date: Date) => {
    setCurrentDate(date)
    setPopoverEvent(null)
  }, [])

  const handleViewChange = useCallback((newView: View) => {
    setView(newView)
    setPopoverEvent(null)
  }, [])

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    setSelectedSlot({ start, end })
    setModalOpen(true)
  }, [])

  const handleSelectEvent = useCallback((event: RBCEvent, e: React.SyntheticEvent) => {
    if (event.resource.id.startsWith('avail_')) return
    const target = e.target as HTMLElement
    const rect = target.getBoundingClientRect()
    setPopoverEvent(event.resource)
    setPopoverRect(rect)
  }, [])

  const googleNotConfigured = data ? !data.google_configured : false
  const nothingConfigured = googleNotConfigured && data !== null

  // Titre de la période affichée
  const viewTitle = useMemo(() => {
    if (view === 'day') {
      return format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })
    }
    if (view === 'month') {
      return format(currentDate, 'MMMM yyyy', { locale: fr })
    }
    const wStart = startOfWeek(currentDate, { locale: fr })
    const wEnd = addDays(wStart, 6)
    if (wStart.getMonth() === wEnd.getMonth()) {
      return `${format(wStart, 'd', { locale: fr })} – ${format(wEnd, 'd MMMM yyyy', { locale: fr })}`
    }
    return `${format(wStart, 'd MMM', { locale: fr })} – ${format(wEnd, 'd MMM yyyy', { locale: fr })}`
  }, [currentDate, view])

  // Navigation prev/next
  function navigatePrev() {
    const d = new Date(currentDate)
    if (view === 'month') d.setMonth(d.getMonth() - 1)
    else if (view === 'week') d.setDate(d.getDate() - 7)
    else d.setDate(d.getDate() - 1)
    handleNavigate(d)
  }

  function navigateNext() {
    const d = new Date(currentDate)
    if (view === 'month') d.setMonth(d.getMonth() + 1)
    else if (view === 'week') d.setDate(d.getDate() + 7)
    else d.setDate(d.getDate() + 1)
    handleNavigate(d)
  }

  const isToday = useMemo(() => {
    const now = new Date()
    return currentDate.getDate() === now.getDate()
      && currentDate.getMonth() === now.getMonth()
      && currentDate.getFullYear() === now.getFullYear()
  }, [currentDate])

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* ── Header Apple-style ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-color)] bg-white">
        {/* Left: Navigation + Today */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={navigatePrev}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={navigateNext}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isToday && (
            <button
              onClick={() => handleNavigate(new Date())}
              className="ml-1 h-7 rounded-md border border-[var(--border-color)] px-2.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition-colors"
            >
              Aujourd'hui
            </button>
          )}
        </div>

        {/* Center: Period title */}
        <h2 className="text-[17px] font-semibold text-[var(--text-primary)] capitalize select-none">
          {viewTitle}
        </h2>

        {/* Right: View toggle + actions */}
        <div className="flex items-center gap-2">
          <ViewToggle current={view} onChange={handleViewChange} />

          {data?.google_configured && (
            <button
              onClick={() => { setSelectedSlot(null); setModalOpen(true) }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--memovia-violet)] text-white hover:bg-[var(--memovia-violet-hover)] transition-colors"
              title="Nouvel événement"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => { refetch(); if (needsAllUsers) refetchAll() }}
            disabled={isLoading}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-50"
            title="Actualiser"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Google error ─────────────────────────────────────────────────────── */}
      {data?.google_error && (
        <div className="mx-5 mt-3 rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-2.5 text-[12px] text-[var(--danger)]">
          <span className="font-semibold">Erreur Google Calendar :</span> {data.google_error}
        </div>
      )}

      {/* ── Content : sidebar + calendar ─────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
        {data?.google_configured && (
          <aside className="w-[200px] flex-shrink-0 border-r border-[var(--border-color)] bg-white px-3 py-4">
            <div className="flex flex-col gap-4">
              {/* Agendas */}
              <div className="flex flex-col gap-0.5">
                <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Agendas
                </p>
                <AgendaToggle
                  color={COLOR_NAOUFEL}
                  label={myName || 'Naoufel'}
                  checked={true}
                  onToggle={() => {}}
                />
                <AgendaToggle
                  color={COLOR_EMIR}
                  label="Emir"
                  checked={showEmir}
                  loading={showEmir && isLoadingAll && !allUsersData}
                  onToggle={() => setShowEmir((v) => !v)}
                />
              </div>

              {/* Planification */}
              <div className="flex flex-col gap-0.5">
                <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Planification
                </p>
                <AgendaToggle
                  color={COLOR_AVAIL}
                  label="Dispos communes"
                  checked={showAvailability}
                  loading={showAvailability && isLoadingAll && !allUsersData}
                  onToggle={() => setShowAvailability((v) => !v)}
                />
              </div>

              {/* Availability count */}
              {showAvailability && availableSlots.length > 0 && (
                <p className="px-2.5 text-[10px] text-[var(--text-muted)] leading-relaxed">
                  {availableSlots.length} créneaux libres sur 7 jours ouvrés
                </p>
              )}
            </div>
          </aside>
        )}

        {/* ── Main calendar area ────────────────────────────────────────────── */}
        <div ref={calendarRef} className="flex-1 min-w-0 bg-white overflow-auto">
          {/* Loading skeleton */}
          {isLoading && !data && (
            <div className="flex flex-col gap-3 p-6">
              <div className="h-5 w-40 skeleton rounded-md" />
              <div className="h-[600px] skeleton rounded-lg" />
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <CalendarDays className="h-10 w-10 text-[var(--text-muted)]" />
              <div>
                <p className="text-[15px] font-medium text-[var(--text-primary)]">
                  Impossible de charger le calendrier
                </p>
                <p className="text-[13px] text-[var(--text-secondary)]">{error}</p>
              </div>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 rounded-lg bg-[var(--memovia-violet)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--memovia-violet-hover)] transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </button>
            </div>
          )}

          {/* Empty state : Google non configuré */}
          {nothingConfigured && !isLoading && (
            <div className="p-6">
              <CalendarEmptyState
                googleConfigured={false}
                canConnect={true}
                onConnect={startOAuth}
              />
            </div>
          )}

          {/* Calendar */}
          {data && data.google_configured && !isLoading && (
            <div className="calendar-apple h-full">
              <Calendar
                localizer={localizer}
                events={rbcEvents}
                startAccessor="start"
                endAccessor="end"
                view={view}
                onView={handleViewChange}
                date={currentDate}
                onNavigate={handleNavigate}
                messages={messages}
                culture="fr"
                style={{ height: 'calc(100vh - 140px)' }}
                eventPropGetter={eventStyleGetter}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                selectable
                popup
                toolbar={false}
                step={30}
                timeslots={2}
                min={new Date(2024, 0, 1, 7, 0, 0)}
                max={new Date(2024, 0, 1, 21, 0, 0)}
                dayLayoutAlgorithm="overlap"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Event Popover ───────────────────────────────────────────────────── */}
      {popoverEvent && (
        <EventPopover
          event={popoverEvent}
          anchorRect={popoverRect}
          onClose={() => { setPopoverEvent(null); setPopoverRect(null) }}
        />
      )}

      {/* ── Modal création événement ─────────────────────────────────────────── */}
      <CreateEventModal
        isOpen={modalOpen}
        defaultStart={selectedSlot?.start}
        defaultEnd={selectedSlot?.end}
        onClose={() => { setModalOpen(false); setSelectedSlot(null) }}
        onCreateEvent={createMeet}
        inviteNaoufel={isEmir}
      />
    </div>
  )
}
