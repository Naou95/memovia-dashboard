/**
 * Edge Function : create-google-meet
 *
 * Crée un événement Google Calendar, avec ou sans lien Google Meet.
 *
 * Body JSON :
 *   title            : string (requis)
 *   start            : string ISO 8601 (requis)
 *   end              : string ISO 8601 (requis)
 *   description      : string (optionnel)
 *   timezone         : string (défaut : Europe/Paris)
 *   inviteAdminFull  : boolean (optionnel) — ajoute l'utilisateur admin_full comme participant
 *   withMeet         : boolean (optionnel, défaut: true) — ajoute un lien Google Meet
 *   attendees        : string[] (optionnel) — emails supplémentaires à inviter
 *
 * Retourne :
 *   { eventId, htmlLink, meetLink, title, start, end }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

// ── Token refresh ──────────────────────────────────────────────────────────────

async function getValidGoogleToken(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: row } = await supabase
    .from('calendar_tokens')
    .select('*')
    .eq('owner', 'naoufel')
    .eq('provider', 'google')
    .maybeSingle()

  if (!row) return null

  const expiresAt = new Date(row.expires_at).getTime()
  const bufferMs = 5 * 60 * 1000

  if (expiresAt - Date.now() > bufferMs) {
    return row.access_token
  }

  if (!row.refresh_token) return null

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
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

// ── Idempotency key ────────────────────────────────────────────────────────────

async function makeRequestId(title: string, start: string): Promise<string> {
  const input = `${title}::${start}`
  const encoded = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('method_not_allowed', 405)
  }

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  let body: {
    title?: string
    start?: string
    end?: string
    description?: string
    timezone?: string
    inviteAdminFull?: boolean
    withMeet?: boolean
    attendees?: string[]
  }
  try {
    body = await req.json()
  } catch {
    return errorResponse('invalid_json', 400)
  }

  const {
    title, start, end, description,
    timezone = 'Europe/Paris',
    inviteAdminFull = false,
    withMeet = true,
    attendees: extraAttendees = [],
  } = body

  if (!title || !start || !end) {
    return errorResponse('missing_required_fields', 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const token = await getValidGoogleToken(supabase)
  if (!token) {
    return errorResponse('google_not_configured', 503)
  }

  // Construire la liste des participants
  const attendees: Array<{ email: string }> = (extraAttendees as string[]).map((email) => ({ email }))

  if (inviteAdminFull) {
    const { data: adminProfile } = await supabase
      .from('dashboard_profiles')
      .select('email')
      .eq('role', 'admin_full')
      .maybeSingle()

    if (adminProfile?.email) {
      const alreadyAdded = attendees.some((a) => a.email === adminProfile.email)
      if (!alreadyAdded) attendees.push({ email: adminProfile.email })
    }
  }

  const eventBody: Record<string, unknown> = {
    summary: title,
    description: description ?? '',
    start: { dateTime: start, timeZone: timezone },
    end: { dateTime: end, timeZone: timezone },
  }

  if (withMeet) {
    const requestId = await makeRequestId(title, start)
    eventBody.conferenceData = {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  if (attendees.length > 0) {
    eventBody.attendees = attendees
  }

  const apiUrl = withMeet
    ? 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1'
    : 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
    signal: AbortSignal.timeout(12000),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('Google Calendar create event error:', err)
    return errorResponse(`google_api_error_${res.status}`, res.status >= 500 ? 502 : 400)
  }

  const event = await res.json()

  const entryPoints = event.conferenceData?.entryPoints ?? []
  const videoEntry = entryPoints.find(
    (ep: Record<string, string>) => ep.entryPointType === 'video',
  )
  const meetLink = videoEntry?.uri ?? event.hangoutLink ?? null

  return Response.json(
    {
      eventId: event.id,
      htmlLink: event.htmlLink,
      meetLink,
      title: event.summary,
      start: event.start?.dateTime,
      end: event.end?.dateTime,
    },
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
