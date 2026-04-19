/**
 * Edge Function : get-calendar-events
 *
 * Récupère les événements Google Calendar de l'utilisateur authentifié.
 * Chaque utilisateur ne voit que son propre calendrier (lookup par user_id).
 * Auto-refresh du token expiré. Retourne une erreur douce si le token
 * n'est pas configuré.
 *
 * Query params :
 *   start  (ISO 8601, défaut : début du mois courant)
 *   end    (ISO 8601, défaut : fin du mois courant)
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
}

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

  const tokenRow = row as TokenRow
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

    return {
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

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
