/**
 * Edge Function : calendar-disconnect
 *
 * Supprime le token Google Calendar de l'utilisateur authentifié.
 * DELETE uniquement pour le user_id courant (jamais un autre user).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult
  const { user } = authResult

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { error } = await supabase
    .from('calendar_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'google')

  if (error) {
    console.error('[calendar-disconnect] delete error:', error.message)
    return errorResponse('Impossible de déconnecter le calendrier', 500)
  }

  console.log(`[calendar-disconnect] user ${user.id} disconnected Google Calendar`)

  return Response.json(
    { success: true },
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
