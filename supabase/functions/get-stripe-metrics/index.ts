import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@17'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // 1. Valider l'auth
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 2. Valider env vars
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!secretKey) {
    return new Response(JSON.stringify({ error: 'stripe_not_configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const stripe = new Stripe(secretKey)

    // 3. Abonnements status='active' uniquement.
    // past_due, canceled, trialing, etc. sont exclus par ce filtre.
    const activeSubs = await stripe.subscriptions.list(
      { status: 'active', limit: 100 },
      { timeout: 8000 }
    )

    // MRR : plans payants uniquement, plans annuels normalisés en mensuel
    const mrr = activeSubs.data.reduce((sum, sub) => {
      const plan = sub.items.data[0]?.plan
      if (!plan?.amount) return sum
      const monthlyAmount = plan.interval === 'year'
        ? plan.amount / 12
        : plan.amount
      return sum + monthlyAmount / 100 // cents → euros
    }, 0)

    // Plans payants uniquement (exclure les plans à 0€)
    const paidSubs = activeSubs.data.filter(
      (sub) => (sub.items.data[0]?.plan?.amount ?? 0) > 0
    )

    // Abonnés actifs = payants ET ne se désabonnent PAS en fin de période
    const activeSubscribers = paidSubs.filter(
      (sub) => !sub.cancel_at_period_end
    ).length

    // Annulations en cours = payants ET cancel_at_period_end=true
    // (l'accès reste actif jusqu'à la fin de la période, mais ne se renouvellera pas)
    const cancelingAtPeriodEnd = paidSubs.filter(
      (sub) => sub.cancel_at_period_end
    ).length

    return Response.json({
      mrr: Math.round(mrr * 100) / 100,
      activeSubscribers,
      cancelingAtPeriodEnd,
      fetchedAt: new Date().toISOString(),
    }, { headers: corsHeaders })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'stripe_error'
    const isTimeout = message.includes('timeout') ||
      message.includes('abort') ||
      (err as { type?: string }).type === 'StripeConnectionError'
    return new Response(JSON.stringify({ error: message }), {
      status: isTimeout ? 504 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
