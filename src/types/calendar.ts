export type CalendarProvider = 'google'

export interface EventOwner {
  name: string
  color: string
}

export interface CalendarEvent {
  id: string
  title: string
  start: string        // ISO 8601
  end: string          // ISO 8601
  allDay: boolean
  provider: CalendarProvider
  htmlLink?: string
  meetLink?: string
  description?: string
  location?: string
  owner?: EventOwner   // présent uniquement quand include_all_users=true
}

export interface AvailabilitySlot {
  start: Date
  end: Date
}

/** Événement au format attendu par react-big-calendar */
export interface RBCEvent {
  id: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  resource: CalendarEvent
}

export interface CalendarEventsResponse {
  events: CalendarEvent[]
  google_configured: boolean
  google_error: string | null
  fetched_at: string
}

export interface CreateMeetPayload {
  title: string
  start: string    // ISO 8601
  end: string      // ISO 8601
  description?: string
  timezone?: string
  inviteAdminFull?: boolean
  withMeet?: boolean      // si false, crée l'événement sans lien Meet (défaut: true)
  attendees?: string[]    // emails supplémentaires à inviter
}

export interface CreateMeetResponse {
  eventId: string
  htmlLink: string
  meetLink: string | null
  title: string
  start: string
  end: string
}
