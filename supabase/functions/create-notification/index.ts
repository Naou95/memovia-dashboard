import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
