import { createClient, type User } from 'jsr:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Valide le JWT Supabase depuis le header Authorization.
 * Tout user authentifié valide est accepté (outil interne).
 * Retourne { user } si valide, ou une Response 401 sinon.
 */
export async function validateAuth(req: Request): Promise<{ user: User } | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    console.error('[auth] missing Authorization header')
    return errorResponse('unauthorized', 401)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', '')
  )

  if (error || !user) {
    console.error('[auth] getUser failed:', error?.message)
    return errorResponse('unauthorized', 401)
  }

  return { user }
}

export function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
