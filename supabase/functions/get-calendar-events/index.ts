/**
 * Edge Function : get-calendar-events
 *
 * Récupère les événements Google Calendar.
 * Mode par défaut : uniquement l'utilisateur authentifié.
 * Mode include_all_users=true : tous les utilisateurs ayant connecté Google
 *   Calendar — chaque événement porte un champ owner { name, color }.
 *
 * Query params :
 *   start              (ISO 8601, défaut : début du mois courant)
 *   end                (ISO 8601, défaut : fin du mois courant)
 *   include_all_users  (boolean string, défaut : false)
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TokenRow {
  id: string
  owner: string
  user_id: string
  provider: string
  access_token: string
  refresh_token: string | null
  expires_at: string
}

interface ProfileRow {
  id: string
  full_name: string
  role: string
}

interface EventOwner {
  name: string
  color: string
}

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  provider: 'google'
  htmlLink?: string
  meetLink?: string
  description?: string
  location?: string
  owner?: EventOwner
}

// ── Role → couleur ─────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  admin_full: '#7C3AED',    // Naoufel — violet
  admin_bizdev: '#00E5CC',  // Emir — cyan
}

const DEFAULT_COLOR = '#7C3AED'

// ── Token helpers ──────────────────────────────────────────────────────────────

async function getValidToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: row, error } = await supabase
    .from('calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle()

  if (error || !row) return null
  return getValidTokenFromRow(supabase, row as TokenRow)
}

async function getValidTokenFromRow(
  supabase: SupabaseClient,
  tokenRow: TokenRow,
): Promise<string | null> {
  const expiresAt = new Date(tokenRow.expires_at).getTime()
  const bufferMs = 5 * 60 * 1000

  if (expiresAt - Date.now() > bufferMs) {
    return tokenRow.access_token
  }

  if (!tokenRow.refresh_token) return null
  return await refreshGoogleToken(supabase, tokenRow)
}

async function refreshGoogleToken(
  supabase: SupabaseClient,
  row: TokenRow,
): Promise<string | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token!,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) return null

  const data = await res.json()
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  await supabase
    .from('calendar_tokens')
    .update({ access_token: data.access_token, expires_at: newExpiresAt })
    .eq('id', row.id)

  return data.access_token
}

// ── Google Calendar ────────────────────────────────────────────────────────────

async function fetchGoogleEvents(
  token: string,
  startStr: string,
  endStr: string,
  owner?: EventOwner,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: startStr,
    timeMax: endStr,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    },
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Google Calendar API ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return (data.items ?? []).map((item: Record<string, unknown>) => {
    const start = item.start as Record<string, string>
    const end = item.end as Record<string, string>
    const isAllDay = !!start?.date && !start?.dateTime
    const meetLink = extractGoogleMeetLink(item)

    const event: CalendarEvent = {
      id: `google_${item.id}`,
      title: (item.summary as string) || '(sans titre)',
      start: start?.dateTime ?? `${start?.date}T00:00:00`,
      end: end?.dateTime ?? `${end?.date}T23:59:59`,
      allDay: isAllDay,
      provider: 'google' as const,
      htmlLink: item.htmlLink as string | undefined,
      meetLink,
      description: item.description as string | undefined,
      location: item.location as string | undefined,
    }

    if (owner) event.owner = owner
    return event
  })
}

function extractGoogleMeetLink(item: Record<string, unknown>): string | undefined {
  const conf = item.conferenceData as Record<string, unknown> | undefined
  if (conf) {
    const eps = conf.entryPoints as Array<Record<string, string>> | undefined
    const videoEp = eps?.find((ep) => ep.entryPointType === 'video')
    if (videoEp?.uri) return videoEp.uri
  }
  return item.hangoutLink as string | undefined
}

// ── All-users fetch ────────────────────────────────────────────────────────────

async function fetchAllUsersEvents(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string,
): Promise<CalendarEvent[]> {
  const { data: tokens, error } = await supabase
    .from('calendar_tokens')
    .select('*')
    .eq('provider', 'google')

  if (error || !tokens?.length) return []

  const userIds = (tokens as TokenRow[]).map((t) => t.user_id)
  const { data: profiles } = await supabase
    .from('dashboard_profiles')
    .select('id, full_name, role')
    .in('id', userIds)

  const profileMap = new Map<string, ProfileRow>(
    (profiles as ProfileRow[] ?? []).map((p) => [p.id, p]),
  )

  const allEvents: CalendarEvent[] = []

  await Promise.allSettled(
    (tokens as TokenRow[]).map(async (tokenRow) => {
      const token = await getValidTokenFromRow(supabase, tokenRow)
      if (!token) return

      const profile = profileMap.get(tokenRow.user_id)
      const owner: EventOwner = {
        name: profile?.full_name ?? tokenRow.owner,
        color: ROLE_COLORS[profile?.role ?? ''] ?? DEFAULT_COLOR,
      }

      try {
        const events = await fetchGoogleEvents(token, startStr, endStr, owner)
        allEvents.push(...events)
      } catch (err) {
        console.error(`[get-calendar-events] user ${tokenRow.user_id}:`, err)
      }
    }),
  )

  return allEvents
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult
  const { user } = authResult

  const url = new URL(req.url)
  const now = new Date()
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const startStr = url.searchParams.get('start') ?? defaultStart
  const endStr = url.searchParams.get('end') ?? defaultEnd
  const includeAllUsers = url.searchParams.get('include_all_users') === 'true'

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  if (includeAllUsers) {
    const events = await fetchAllUsersEvents(supabase, startStr, endStr)

    return Response.json(
      {
        events,
        google_configured: events.length > 0,
        google_error: null,
        fetched_at: new Date().toISOString(),
      },
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Mode standard : uniquement l'utilisateur courant
  const googleToken = await getValidToken(supabase, user.id)

  let googleEvents: CalendarEvent[] = []
  let googleError: string | null = null

  if (googleToken) {
    try {
      googleEvents = await fetchGoogleEvents(googleToken, startStr, endStr)
    } catch (err) {
      googleError = String(err)
    }
  }

  return Response.json(
    {
      events: googleEvents,
      google_configured: !!googleToken,
      google_error: googleError,
      fetched_at: new Date().toISOString(),
    },
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
