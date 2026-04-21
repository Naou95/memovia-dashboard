import { useState, useCallback, useMemo, useEffect } from 'react'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addDays, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Video, RefreshCw, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import 'react-big-calendar/lib/css/react-big-calendar.css'

import { useCalendar } from '@/hooks/useCalendar'
import { useAuth } from '@/contexts/AuthContext'
import { CalendarEmptyState } from './components/CalendarEmptyState'
import { CreateMeetModal } from './components/CreateMeetModal'
import type { RBCEvent, CalendarEvent, AvailabilitySlot } from '@/types/calendar'

// ── Couleurs ───────────────────────────────────────────────────────────────────

const COLOR_NAOUFEL = '#7C3AED'
const COLOR_EMIR    = '#00E5CC'
const COLOR_AVAIL   = '#16A34A'

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
  showMore: (total: number) => `+${total} de plus`,
}

// ── Disponibilités communes ────────────────────────────────────────────────────

function computeAvailableSlots(
  allEvents: CalendarEvent[],
  daysAhead = 7,
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = []
  const today = startOfDay(new Date())
  let dayCount = 0
  let cursor = today

  while (dayCount < daysAhead) {
    cursor = addDays(cursor, 1)
    const dow = cursor.getDay()
    if (dow === 0 || dow === 6) continue // skip weekends
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
            last.end = slotEnd // fusionner créneaux consécutifs
          } else {
            slots.push({ start: slotStart, end: slotEnd })
          }
        }
      }
    }
  }

  return slots
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
      const fakeEvent: CalendarEvent = {
        id: `avail_${i}`,
        title: 'Disponible',
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        allDay: false,
        provider: 'google',
        owner: { name: 'availability', color: COLOR_AVAIL },
      }
      result.push({
        id: fakeEvent.id,
        title: fakeEvent.title,
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
  const owner = event.resource.owner
  const isAvailability = event.resource.id.startsWith('avail_')

  if (isAvailability) {
    return {
      style: {
        backgroundColor: 'rgba(22, 163, 74, 0.10)',
        borderLeft: `3px solid ${COLOR_AVAIL}`,
        color: COLOR_AVAIL,
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 500,
        padding: '2px 6px',
        cursor: 'default',
        opacity: 0.85,
      },
    }
  }

  const color = owner?.color ?? COLOR_NAOUFEL
  const isEmir = color === COLOR_EMIR

  return {
    style: {
      backgroundColor: isEmir ? 'rgba(0, 229, 204, 0.10)' : 'rgba(124, 58, 237, 0.12)',
      borderLeft: `3px solid ${color}`,
      color: isEmir ? '#0891B2' : '#5B21B6',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: 500,
      padding: '2px 6px',
      cursor: 'pointer',
    },
  }
}

// ── ToggleChip ─────────────────────────────────────────────────────────────────

function ToggleChip({
  label,
  color,
  active,
  disabled,
  loading,
  onClick,
}: {
  label: string
  color: string
  active: boolean
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
        disabled
          ? 'cursor-default border-transparent'
          : 'cursor-pointer hover:opacity-80'
      } ${active ? 'border-transparent' : 'border-[var(--border-color)] bg-white text-[var(--text-secondary)]'}`}
      style={
        active
          ? { backgroundColor: `${color}18`, borderColor: `${color}40`, color }
          : {}
      }
    >
      <span
        className="h-2 w-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: active ? color : 'var(--border-color)' }}
      />
      {label}
      {loading && (
        <RefreshCw className="h-3 w-3 animate-spin ml-0.5" style={{ color }} />
      )}
    </button>
  )
}

// ── CalendarPage ───────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<View>('month')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [showEmir, setShowEmir] = useState(false)
  const [showAvailability, setShowAvailability] = useState(false)

  const { data, allUsersData, isLoading, isLoadingAll, error, refetch, refetchAll, createMeet, startOAuth } = useCalendar(currentDate)
  const { user } = useAuth()
  const isEmir = user?.role === 'admin_bizdev'
  const myName = user?.profile?.full_name ?? ''

  // Charger les données multi-utilisateur à la demande
  const needsAllUsers = showEmir || showAvailability
  useEffect(() => {
    if (needsAllUsers && !allUsersData && !isLoadingAll) {
      refetchAll()
    }
  }, [needsAllUsers, allUsersData, isLoadingAll, refetchAll])

  // Actualiser les données multi-utilisateur quand on change de mois avec les toggles actifs
  useEffect(() => {
    if (needsAllUsers) {
      refetchAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate])

  // Gérer les retours OAuth (?connected=google ou ?error=...)
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

  // Séparer les événements : les miens vs Emir
  const ownEvents = useMemo(
    () => data?.events ?? [],
    [data?.events],
  )

  const emirEvents = useMemo(() => {
    if (!allUsersData?.events) return []
    return allUsersData.events.filter(
      (ev) => ev.owner && ev.owner.name !== myName,
    )
  }, [allUsersData?.events, myName])

  // Disponibilités communes
  const availableSlots = useMemo(() => {
    if (!showAvailability || !allUsersData?.events) return []
    return computeAvailableSlots(allUsersData.events)
  }, [showAvailability, allUsersData?.events])

  const rbcEvents = useMemo(
    () => toRBCEvents(ownEvents, emirEvents, availableSlots, showEmir, showAvailability),
    [ownEvents, emirEvents, availableSlots, showEmir, showAvailability],
  )

  const handleNavigate = useCallback(
    (date: Date) => {
      setCurrentDate(date)
      refetch()
    },
    [refetch],
  )

  const handleViewChange = useCallback((newView: View) => {
    setView(newView)
  }, [])

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    setSelectedSlot({ start, end })
    setModalOpen(true)
  }, [])

  const handleSelectEvent = useCallback((event: RBCEvent) => {
    if (event.resource.id.startsWith('avail_')) return
    const ev = event.resource
    if (ev.meetLink) {
      window.open(ev.meetLink, '_blank', 'noopener,noreferrer')
    } else if (ev.htmlLink) {
      window.open(ev.htmlLink, '_blank', 'noopener,noreferrer')
    }
  }, [])

  const googleNotConfigured = data ? !data.google_configured : false
  const nothingConfigured = googleNotConfigured && data !== null

  const viewTitle = useMemo(() => {
    if (view === 'month') {
      return format(currentDate, 'MMMM yyyy', { locale: fr })
    }
    return format(currentDate, 'd MMMM yyyy', { locale: fr })
  }, [currentDate, view])

  return (
    <motion.div className="flex flex-col gap-5" variants={staggerContainer} initial="hidden" animate="show">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Calendrier</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Google Calendar de {myName || 'votre compte'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh */}
          <button
            onClick={() => { refetch(); if (needsAllUsers) refetchAll() }}
            disabled={isLoading}
            className="flex h-9 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-white px-3 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            aria-label="Actualiser le calendrier"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Bouton Meet */}
          {data?.google_configured && (
            <button
              onClick={() => { setSelectedSlot(null); setModalOpen(true) }}
              className="flex h-9 items-center gap-2 rounded-lg bg-[var(--memovia-violet)] px-4 text-[13px] font-medium text-white hover:bg-[var(--memovia-violet-hover)] transition-colors"
            >
              <Video className="h-4 w-4" />
              {isEmir ? 'Générer un Meet' : 'Nouvelle réunion'}
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Sélecteur d'agendas + légende ────────────────────────────────────── */}
      {data?.google_configured && (
        <motion.div variants={staggerItem} className="flex flex-col gap-2.5">
          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <ToggleChip
              label="Mon agenda"
              color={COLOR_NAOUFEL}
              active={true}
              disabled={true}
            />
            <ToggleChip
              label="Agenda Emir"
              color={COLOR_EMIR}
              active={showEmir}
              loading={showEmir && isLoadingAll && !allUsersData}
              onClick={() => setShowEmir((v) => !v)}
            />
            <ToggleChip
              label="Disponibilités communes"
              color={COLOR_AVAIL}
              active={showAvailability}
              loading={showAvailability && isLoadingAll && !allUsersData}
              onClick={() => setShowAvailability((v) => !v)}
            />
          </div>

          {/* Légende */}
          <div className="flex flex-wrap items-center gap-4">
            <LegendDot color={COLOR_NAOUFEL} label={myName || 'Naoufel'} />
            {showEmir && <LegendDot color={COLOR_EMIR} label="Emir" />}
            {showAvailability && <LegendDot color={COLOR_AVAIL} label="Disponible ensemble" />}
          </div>
        </motion.div>
      )}

      {/* ── Google error ─────────────────────────────────────────────────────── */}
      {data?.google_error && (
        <motion.div variants={staggerItem} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          <span className="font-semibold">Erreur Google Calendar :</span> {data.google_error}
        </motion.div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────────── */}
      {isLoading && !data && (
        <motion.div variants={staggerItem} className="flex flex-col gap-3 rounded-2xl border border-[var(--border-color)] bg-white p-6">
          <div className="h-5 w-40 skeleton rounded-md" />
          <div className="h-[520px] skeleton rounded-xl" />
        </motion.div>
      )}

      {/* ── Error state ──────────────────────────────────────────────────────── */}
      {error && !isLoading && (
        <motion.div variants={staggerItem} className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--border-color)] bg-white py-16 text-center">
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
        </motion.div>
      )}

      {/* ── Empty state : Google non configuré ──────────────────────────────── */}
      {nothingConfigured && !isLoading && (
        <motion.div variants={staggerItem}>
          <CalendarEmptyState
            googleConfigured={false}
            canConnect={true}
            onConnect={startOAuth}
          />
        </motion.div>
      )}

      {/* ── Calendar ─────────────────────────────────────────────────────────── */}
      {data && data.google_configured && !isLoading && (
        <motion.div variants={staggerItem} className="flex flex-col gap-0 rounded-2xl border border-[var(--border-color)] bg-white overflow-hidden">
          {/* Custom toolbar */}
          <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-3">
            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const d = new Date(currentDate)
                  if (view === 'month') d.setMonth(d.getMonth() - 1)
                  else d.setDate(d.getDate() - 7)
                  handleNavigate(d)
                }}
                aria-label={view === 'month' ? 'Mois précédent' : 'Semaine précédente'}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-1 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleNavigate(new Date())}
                className="h-8 rounded-lg px-3 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-1 transition-colors"
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => {
                  const d = new Date(currentDate)
                  if (view === 'month') d.setMonth(d.getMonth() + 1)
                  else d.setDate(d.getDate() + 7)
                  handleNavigate(d)
                }}
                aria-label={view === 'month' ? 'Mois suivant' : 'Semaine suivante'}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-1 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Current period title */}
            <span className="text-[15px] font-semibold text-[var(--text-primary)] capitalize">
              {viewTitle}
            </span>

            {/* View switcher */}
            <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-0.5">
              {(['month', 'week'] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => handleViewChange(v)}
                  aria-pressed={view === v}
                  aria-label={`Vue ${v === 'month' ? 'mensuelle' : 'hebdomadaire'}`}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-1 ${
                    view === v
                      ? 'bg-white text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {v === 'month' ? 'Mois' : 'Semaine'}
                </button>
              ))}
            </div>
          </div>

          {/* react-big-calendar */}
          <div className="calendar-wrapper px-2 pb-2">
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
              style={{ height: 580 }}
              eventPropGetter={eventStyleGetter}
              onSelectSlot={isEmir ? undefined : handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              selectable={!isEmir}
              popup
              toolbar={false}
            />
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border-color)] px-5 py-2.5">
            {isEmir ? (
              <p className="text-[12px] text-[var(--text-muted)]">
                Vue en lecture seule — utilisez "Générer un Meet" pour créer une réunion.
              </p>
            ) : showAvailability && availableSlots.length > 0 ? (
              <p className="text-[12px] text-[var(--text-muted)]">
                {availableSlots.length} créneaux disponibles en commun sur les 7 prochains jours ouvrés (9h–18h).
              </p>
            ) : null}
          </div>
        </motion.div>
      )}

      {/* ── Create Meet Modal ─────────────────────────────────────────────────── */}
      <CreateMeetModal
        isOpen={modalOpen}
        defaultStart={selectedSlot?.start}
        defaultEnd={selectedSlot?.end}
        onClose={() => { setModalOpen(false); setSelectedSlot(null) }}
        onCreateMeet={createMeet}
        inviteNaoufel={isEmir}
      />
    </motion.div>
  )
}

// ── LegendDot ──────────────────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>
    </div>
  )
}
