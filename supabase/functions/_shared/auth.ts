import { createClient, type User } from 'jsr:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Valide le JWT Supabase depuis le header Authorization ET vérifie que l'utilisateur est bien
 * membre du dashboard (`dashboard_profiles`).
 *
 * 🔴 POURQUOI LES DEUX ÉTAPES — corrigé le 14/08/2026 après revue adversariale.
 *
 * Cette fonction s'arrêtait à `getUser()` avec le commentaire « tout user authentifié valide est
 * accepté (outil interne) ». « Interne » était FAUX : le dashboard partage le projet Supabase
 * `mzjzwffpqubpruyaaxew` avec app.memovia.io. Le JWT d'un apprenti ou d'un formateur est signé
 * par le même projet, donc `getUser()` le validait — et `verify_jwt: true` sur la passerelle ne
 * changeait rien, elle vérifie exactement la même signature.
 *
 * Mesuré le 14/08 : `auth.users` = 359, `dashboard_profiles` = 2. **357 utilisateurs de l'app**
 * pouvaient appeler les 24 fonctions du dashboard, dont `email-send` (envoyer un mail depuis la
 * boîte Hostinger), `email-list` / `email-get` (la lire), `get-qonto-balance`,
 * `get-qonto-finance`, `get-stripe-finance` et `copilot-chat`.
 *
 * Le contrôle ci-dessous est celui que le reste du code applique déjà : la policy RLS de
 * `calendar_tokens` fait `EXISTS (SELECT 1 FROM dashboard_profiles WHERE id = auth.uid())`.
 * `validateAuth` ne l'appliquait simplement pas.
 *
 * ⚠️ Distinction volontaire des deux refus, parce qu'ils ne se diagnostiquent pas pareil :
 *   401 `unauthorized` = pas de token, ou token invalide/expiré → se reconnecter.
 *   403 `forbidden`    = token valide mais compte absent de `dashboard_profiles` → ce n'est pas
 *                        un problème de session, c'est un accès qu'on ne donne pas.
 *
 * Échoue FERMÉ : toute erreur de la requête refuse l'accès plutôt que de laisser passer.
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

  // Authentifié ≠ autorisé. Sans ce contrôle, tout compte de l'app ouvre le dashboard.
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('dashboard_profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[auth] dashboard_profiles lookup failed:', profileError.message)
    return errorResponse('forbidden', 403)
  }

  if (!profile) {
    console.warn(`[auth] refus : ${user.id} authentifie mais absent de dashboard_profiles`)
    return errorResponse('forbidden', 403)
  }

  return { user }
}

export function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
