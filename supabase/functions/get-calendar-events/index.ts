/**
 * Edge Function : get-calendar-events
 *
 * Récupère les événements des deux calendriers en parallèle :
 * - Google Calendar (Naoufel) via Google Calendar API v3
 * - Microsoft Outlook (Emir) via Microsoft Graph API
 *
 * Auto-refresh des tokens expirés. Dégrade gracieusement si un provider
 * n'est pas configuré (retourne les événements de l'autre quand même).
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
  provider: string
  access_token: string
  refresh_token: string | null
  expires_at: string
}

interface CalendarEvent {
  id: string
  title: string
  start: string       // ISO 8601
  end: string         // ISO 8601
  allDay: boolean
  provider: 'google' | 'microsoft'
  htmlLink?: string
  meetLink?: string
  description?: string
  location?: string
}

// ── Token helpers ──────────────────────────────────────────────────────────────

/**
 * Renvoie un access_token valide pour (owner, provider).
 * Rafraîchit automatiquement si expiré dans moins de 5 min.
 * Retourne null si aucun token n'est stocké.
 */
async function getValidToken(
  supabase: SupabaseClient,
  owner: string,
  provider: 'google' | 'microsoft',
): Promise<string | null> {
  const { data: row, error } = await supabase
    .from('calendar_tokens')
    .select('*')
    .eq('owner', owner)
    .eq('provider', provider)
    .maybeSingle()

  if (error || !row) return null

  const tokenRow = row as TokenRow
  const expiresAt = new Date(tokenRow.expires_at).getTime()
  const now = Date.now()
  const bufferMs = 5 * 60 * 1000 // 5 min buffer avant expiration

  if (expiresAt - now > bufferMs) {
    return tokenRow.access_token
  }

  // Token expiré — tenter le refresh
  if (!tokenRow.refresh_token) return null

  if (provider === 'google') {
    return await refreshGoogleToken(supabase, tokenRow)
  } else {
    return await refreshMicrosoftToken(supabase, tokenRow)
  }
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

async function refreshMicrosoftToken(
  supabase: SupabaseClient,
  row: TokenRow,
): Promise<string | null> {
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')
  if (!clientId || !clientSecret) return null

  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token!,
      grant_type: 'refresh_token',
      scope: 'Calendars.Read offline_access',
    }),
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) return null

  const data = await res.json()
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  await supabase
    .from('calendar_tokens')
    .update({
      access_token: data.access_token,
      // Microsoft peut retourner un nouveau refresh_token
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
      expires_at: newExpiresAt,
    })
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
  // Cherche d'abord dans conferenceData.entryPoints
  const conf = item.conferenceData as Record<string, unknown> | undefined
  if (conf) {
    const eps = conf.entryPoints as Array<Record<string, string>> | undefined
    const videoEp = eps?.find((ep) => ep.entryPointType === 'video')
    if (videoEp?.uri) return videoEp.uri
  }
  // Fallback : hangoutLink (ancien format)
  return item.hangoutLink as string | undefined
}

// ── Microsoft Graph ────────────────────────────────────────────────────────────

async function fetchMicrosoftEvents(
  token: string,
  startStr: string,
  endStr: string,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    startDateTime: startStr,
    endDateTime: endStr,
    $orderby: 'start/dateTime',
    $top: '250',
    $select: 'id,subject,start,end,isAllDay,webLink,bodyPreview,location,onlineMeeting',
  })

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    },
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Microsoft Graph API ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return (data.value ?? []).map((item: Record<string, unknown>) => {
    const start = item.start as Record<string, string>
    const end = item.end as Record<string, string>
    const onlineMeeting = item.onlineMeeting as Record<string, string> | null
    const location = item.location as Record<string, string> | null

    return {
      id: `microsoft_${item.id}`,
      title: (item.subject as string) || '(sans titre)',
      start: start?.dateTime ?? '',
      end: end?.dateTime ?? '',
      allDay: item.isAllDay as boolean,
      provider: 'microsoft' as const,
      htmlLink: item.webLink as string | undefined,
      meetLink: onlineMeeting?.joinUrl,
      description: item.bodyPreview as string | undefined,
      location: location?.displayName,
    }
  })
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  // Paramètres de date (plage de la vue courante)
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

  // Récupérer les tokens en parallèle
  const [googleToken, microsoftToken] = await Promise.all([
    getValidToken(supabase, 'naoufel', 'google'),
    getValidToken(supabase, 'emir', 'microsoft'),
  ])

  // Fetch events en parallèle — Promise.allSettled pour dégrader gracieusement
  const [googleResult, microsoftResult] = await Promise.allSettled([
    googleToken
      ? fetchGoogleEvents(googleToken, startStr, endStr)
      : Promise.resolve<CalendarEvent[]>([]),
    microsoftToken
      ? fetchMicrosoftEvents(microsoftToken, startStr, endStr)
      : Promise.resolve<CalendarEvent[]>([]),
  ])

  const googleEvents = googleResult.status === 'fulfilled' ? googleResult.value : []
  const microsoftEvents = microsoftResult.status === 'fulfilled' ? microsoftResult.value : []

  return Response.json(
    {
      events: [...googleEvents, ...microsoftEvents],
      google_configured: !!googleToken,
      microsoft_configured: !!microsoftToken,
      google_error:
        googleResult.status === 'rejected'
          ? String((googleResult as PromiseRejectedResult).reason)
          : null,
      microsoft_error:
        microsoftResult.status === 'rejected'
          ? String((microsoftResult as PromiseRejectedResult).reason)
          : null,
      fetched_at: new Date().toISOString(),
    },
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
