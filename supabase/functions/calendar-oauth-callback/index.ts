/**
 * Edge Function : calendar-oauth-callback
 *
 * Reçoit le code OAuth après consentement (Google ou Microsoft).
 * Valide l'état CSRF, échange le code contre access_token + refresh_token,
 * stocke dans calendar_tokens, redirige vers le dashboard.
 *
 * URL de callback enregistrée dans Google Cloud Console et Azure AD :
 *   https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/calendar-oauth-callback
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { errorResponse } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state') ?? ''
  const oauthError = url.searchParams.get('error')

  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
  const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendar-oauth-callback`

  // Erreur retournée par le provider OAuth (ex: accès refusé par admin IT)
  if (oauthError) {
    const errorDesc = url.searchParams.get('error_description') ?? oauthError
    console.error('OAuth error from provider:', oauthError, errorDesc)
    return Response.redirect(
      `${appUrl}/calendrier?error=${encodeURIComponent(oauthError)}&error_description=${encodeURIComponent(errorDesc)}`,
      302,
    )
  }

  if (!code) {
    return Response.redirect(`${appUrl}/calendrier?error=missing_code`, 302)
  }

  // Décoder l'état : "uuid::redirectAfterUrl"
  const [state, ...redirectParts] = stateParam.split('::')
  const redirectAfter = redirectParts.join('::') || `${appUrl}/calendrier`

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Valider l'état CSRF
  const { data: stateRow, error: stateError } = await supabase
    .from('calendar_oauth_states')
    .select('*')
    .eq('state', state)
    .maybeSingle()

  if (stateError || !stateRow) {
    return Response.redirect(`${appUrl}/calendrier?error=invalid_state`, 302)
  }

  const { provider, owner } = stateRow as { provider: 'google' | 'microsoft'; owner: string }

  // Supprimer l'état CSRF utilisé (one-time use)
  await supabase.from('calendar_oauth_states').delete().eq('state', state)

  // Échanger le code contre des tokens
  let tokenData: {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope?: string
  } | null = null

  if (provider === 'google') {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    if (!clientId || !clientSecret) {
      return Response.redirect(`${appUrl}/calendrier?error=google_not_configured`, 302)
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Google token exchange error:', err)
      return Response.redirect(`${appUrl}/calendrier?error=token_exchange_failed`, 302)
    }
    tokenData = await res.json()

  } else if (provider === 'microsoft') {
    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')
    const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')
    if (!clientId || !clientSecret) {
      return Response.redirect(`${appUrl}/calendrier?error=microsoft_not_configured`, 302)
    }

    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
        scope: 'Calendars.Read offline_access',
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Microsoft token exchange error:', err)
      return Response.redirect(`${appUrl}/calendrier?error=token_exchange_failed`, 302)
    }
    tokenData = await res.json()
  }

  if (!tokenData) {
    return Response.redirect(`${appUrl}/calendrier?error=unknown_provider`, 302)
  }

  // Stocker les tokens dans Supabase
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

  const { error: upsertError } = await supabase
    .from('calendar_tokens')
    .upsert(
      {
        owner,
        provider,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        expires_at: expiresAt,
        scope: tokenData.scope ?? null,
      },
      { onConflict: 'owner,provider' },
    )

  if (upsertError) {
    console.error('Failed to store tokens:', upsertError)
    return Response.redirect(`${appUrl}/calendrier?error=storage_failed`, 302)
  }

  // Succès — rediriger vers le dashboard avec indicateur de connexion
  return Response.redirect(
    `${redirectAfter}?connected=${provider}`,
    302,
  )
})
