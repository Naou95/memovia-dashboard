/**
 * Edge Function : calendar-oauth-start
 *
 * Démarre le flow OAuth2 pour Google Calendar (Naoufel uniquement).
 * Génère l'URL de consentement et stocke un état CSRF temporaire (TTL 15 min).
 *
 * Query params :
 *   redirect : URL de retour après connexion (défaut : APP_URL/calendrier)
 *
 * Retourne :
 *   { authUrl }  — le frontend redirige vers cette URL
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  const url = new URL(req.url)
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
  const redirectAfter = url.searchParams.get('redirect') ?? `${appUrl}/calendrier`

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  if (!clientId) return errorResponse('google_not_configured', 503)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const state = crypto.randomUUID()
  await supabase
    .from('calendar_oauth_states')
    .upsert({ state, provider: 'google', owner: 'naoufel' })

  await supabase.rpc('cleanup_oauth_states')

  const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendar-oauth-callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: `${state}::${redirectAfter}`,
  })
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`

  return Response.json(
    { authUrl },
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
