import { useState, useCallback, useMemo, useEffect } from 'react'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Video, RefreshCw, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import 'react-big-calendar/lib/css/react-big-calendar.css'

import { useCalendar } from '@/hooks/useCalendar'
import { CalendarEmptyState } from './components/CalendarEmptyState'
import { MicrosoftBanner } from './components/MicrosoftBanner'
import { CreateMeetModal } from './components/CreateMeetModal'
import type { RBCEvent, CalendarEvent } from '@/types/calendar'

// ── date-fns localizer (français) ──────────────────────────────────────────────

const locales = { fr }

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { locale: fr }),
  getDay,
  locales,
})

// Messages français pour react-big-calendar
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

// ── Couleurs par provider ──────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  google: {
    bg: 'rgba(124, 58, 237, 0.12)',
    border: '#7C3AED',
    text: '#5B21B6',
  },
  microsoft: {
    bg: 'rgba(234, 88, 12, 0.12)',
    border: '#EA580C',
    text: '#9A3412',
  },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toRBCEvents(events: CalendarEvent[]): RBCEvent[] {
  return events.map((ev) => ({
    id: ev.id,
    title: ev.title,
    start: new Date(ev.start),
    end: new Date(ev.end),
    allDay: ev.allDay,
    resource: ev,
  }))
}

function eventStyleGetter(event: RBCEvent) {
  const provider = event.resource.provider
  const colors = PROVIDER_COLORS[provider] ?? PROVIDER_COLORS.google
  return {
    style: {
      backgroundColor: colors.bg,
      borderLeft: `3px solid ${colors.border}`,
      color: colors.text,
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: 500,
      padding: '2px 6px',
      cursor: 'pointer',
    },
  }
}

// ── CalendarPage ───────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<View>('month')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const { data, isLoading, error, refetch, createMeet, startOAuth } = useCalendar(currentDate)

  // Gérer les retours OAuth (?connected=google|microsoft ou ?error=...)
  useEffect(() => {
    const connected = searchParams.get('connected')
    const oauthError = searchParams.get('error')

    if (connected) {
      toast.success(
        connected === 'google'
          ? 'Google Calendar connecté !'
          : 'Outlook connecté !',
      )
      refetch()
      setSearchParams({})
    }
    if (oauthError) {
      const desc = searchParams.get('error_description') ?? oauthError
      if (oauthError === 'access_denied') {
        toast.error("Connexion annulée ou refusée par l'administrateur IT.")
      } else {
        toast.error(`Erreur de connexion : ${desc}`)
      }
      setSearchParams({})
    }
  }, [searchParams, setSearchParams, refetch])

  const rbcEvents = useMemo(
    () => toRBCEvents(data?.events ?? []),
    [data?.events],
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
    const ev = event.resource
    if (ev.meetLink) {
      window.open(ev.meetLink, '_blank', 'noopener,noreferrer')
    } else if (ev.htmlLink) {
      window.open(ev.htmlLink, '_blank', 'noopener,noreferrer')
    }
  }, [])

  const googleNotConfigured = data ? !data.google_configured : false
  const microsoftNotConfigured = data ? !data.microsoft_configured : false
  const nothingConfigured = googleNotConfigured && data !== null

  // Titre de la vue courante
  const viewTitle = useMemo(() => {
    if (view === 'month') {
      return format(currentDate, 'MMMM yyyy', { locale: fr })
    }
    return format(currentDate, "d MMMM yyyy", { locale: fr })
  }, [currentDate, view])

  return (
    <motion.div className="flex flex-col gap-5" variants={staggerContainer} initial="hidden" animate="show">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[var(--text-primary)]">Calendrier</h1>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Agenda de Naoufel (Google) et Emir (Outlook)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex h-9 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-white px-3 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] disabled:opacity-60 transition-colors"
            title="Actualiser"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Nouvelle réunion Meet */}
          {data?.google_configured && (
            <button
              onClick={() => { setSelectedSlot(null); setModalOpen(true) }}
              className="flex h-9 items-center gap-2 rounded-lg bg-[var(--memovia-violet)] px-4 text-[13px] font-medium text-white hover:bg-[var(--memovia-violet-hover)] transition-colors"
            >
              <Video className="h-4 w-4" />
              Nouvelle réunion
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Microsoft not connected banner ───────────────────────────────────── */}
      {data && data.google_configured && microsoftNotConfigured && (
        <motion.div variants={staggerItem}>
          <MicrosoftBanner
            onConnect={() => startOAuth('microsoft', 'emir')}
          />
        </motion.div>
      )}

      {/* ── Google/Microsoft API errors ──────────────────────────────────────── */}
      {data?.google_error && (
        <motion.div variants={staggerItem} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          <span className="font-semibold">Erreur Google Calendar :</span> {data.google_error}
        </motion.div>
      )}
      {data?.microsoft_error && (
        <motion.div variants={staggerItem} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
          <span className="font-semibold">Erreur Outlook :</span> {data.microsoft_error}
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

      {/* ── Empty state : aucun provider configuré ───────────────────────────── */}
      {nothingConfigured && !isLoading && (
        <motion.div variants={staggerItem}>
          <CalendarEmptyState
            googleConfigured={data?.google_configured ?? false}
            microsoftConfigured={data?.microsoft_configured ?? false}
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
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleNavigate(new Date())}
                className="h-8 rounded-lg px-3 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] transition-colors"
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
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Current period title */}
            <span className="text-[15px] font-semibold text-[var(--text-primary)] capitalize">
              {viewTitle}
            </span>

            {/* View switcher + Legend */}
            <div className="flex items-center gap-3">
              {/* Legend */}
              <div className="hidden items-center gap-3 sm:flex">
                <LegendDot color="#7C3AED" label="Naoufel" />
                {data.microsoft_configured && <LegendDot color="#EA580C" label="Emir" />}
              </div>

              {/* View toggle */}
              <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-0.5">
                {(['month', 'week'] as View[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => handleViewChange(v)}
                    className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
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
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              selectable
              popup
              toolbar={false}   // On utilise notre toolbar custom
            />
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
      />
    </motion.div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>
    </div>
  )
}
