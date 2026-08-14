import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { timingSafeEqual } from '../_shared/timingSafeEqual.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  user_id: string
  type: 'lead_stale' | 'email_critical' | 'new_lead' | 'stripe_cancel'
  title: string
  message: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Cette fonction n'avait AUCUN contrôle applicatif alors qu'elle écrit avec le client
  // service_role : n'importe lequel des 359 comptes du projet Supabase partagé pouvait insérer
  // une notification arbitraire dans `dashboard_notifications`, avec un `user_id` usurpé et un
  // `title` / `message` libres. `verify_jwt = true` ne protégeait pas : la passerelle valide la
  // signature du JWT, or celui d'un apprenti de l'app est signé par le même projet.
  //
  // Le seul appelant légitime est `get-sentry/index.ts:137`, une fonction edge qui envoie déjà
  // `Authorization: Bearer <service_role>`. Un contrôle service_role suffit donc, et il ne casse
  // rien : vérifié par balayage, aucun appelant dans `src/` ni ailleurs.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!token || !serviceRoleKey || !timingSafeEqual(token, serviceRoleKey)) {
    return new Response(
      JSON.stringify({ error: 'unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const payload: NotificationPayload = await req.json()

    if (!payload.user_id || !payload.type || !payload.title || !payload.message) {
      return new Response(
        JSON.stringify({ error: 'Champs manquants : user_id, type, title, message requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data, error } = await supabase
      .from('dashboard_notifications')
      .insert({
        user_id: payload.user_id,
        type: payload.type,
        title: payload.title,
        message: payload.message,
      })
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({ notification: data }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
