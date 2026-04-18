/**
 * Edge Function : calendar-oauth-start
 *
 * Démarre le flow OAuth2 pour Google Calendar ou Microsoft Outlook.
 * Génère l'URL de consentement et stocke un état CSRF temporaire (TTL 15 min).
 *
 * Query params :
 *   provider : 'google' | 'microsoft' (requis)
 *   owner    : 'naoufel' | 'emir'     (requis)
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

const MICROSOFT_SCOPES = 'Calendars.Read offline_access'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  const url = new URL(req.url)
  const provider = url.searchParams.get('provider') as 'google' | 'microsoft' | null
  const owner = url.searchParams.get('owner') as 'naoufel' | 'emir' | null
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
  const redirectAfter = url.searchParams.get('redirect') ?? `${appUrl}/calendrier`

  if (!provider || !['google', 'microsoft'].includes(provider)) {
    return errorResponse('invalid_provider', 400)
  }
  if (!owner || !['naoufel', 'emir'].includes(owner)) {
    return errorResponse('invalid_owner', 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Générer et stocker un état CSRF aléatoire
  const state = crypto.randomUUID()
  await supabase
    .from('calendar_oauth_states')
    .upsert({ state, provider, owner })

  // Nettoyer les anciens états
  await supabase.rpc('cleanup_oauth_states')

  const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendar-oauth-callback`

  let authUrl: string

  if (provider === 'google') {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    if (!clientId) return errorResponse('google_not_configured', 503)

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: GOOGLE_SCOPES,
      access_type: 'offline',
      prompt: 'consent',   // force refresh_token même si déjà autorisé
      state: `${state}::${redirectAfter}`,
    })
    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  } else {
    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')
    if (!clientId) return errorResponse('microsoft_not_configured', 503)

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: MICROSOFT_SCOPES,
      state: `${state}::${redirectAfter}`,
    })
    authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
  }

  return Response.json(
    { authUrl },
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
