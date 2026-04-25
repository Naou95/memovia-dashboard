import Stripe from 'npm:stripe@17'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // 1. Valider l'auth
  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  // 2. Valider env vars
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!secretKey) {
    return errorResponse('stripe_not_configured', 500)
  }

  try {
    const stripe = new Stripe(secretKey)

    // 3. Abonnements status='active' uniquement.
    // past_due, canceled, trialing, etc. sont exclus par ce filtre.
    const activeSubs = await stripe.subscriptions.list(
      { status: 'active', limit: 100 },
      { timeout: 8000 }
    )

    // MRR : plans payants uniquement, normalisés en mensuel (tous intervalles)
    const mrr = activeSubs.data.reduce((sum, sub) => {
      const plan = sub.items.data[0]?.plan
      if (!plan?.amount) return sum
      const count = plan.interval_count ?? 1
      let monthlyAmount: number
      switch (plan.interval) {
        case 'week':
          monthlyAmount = plan.amount * 4.33 / count
          break
        case 'year':
          monthlyAmount = plan.amount / (12 * count)
          break
        case 'month':
        default:
          monthlyAmount = plan.amount / count
          break
      }
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

    // MRR contrats B2B actifs
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: contractRows } = await supabase
      .from('contracts')
      .select('mrr_eur')
      .eq('status', 'actif')

    const mrrContracts = (contractRows ?? []).reduce(
      (sum: number, row: { mrr_eur: number | null }) => sum + (row.mrr_eur ?? 0),
      0,
    )
    const mrrStripe = Math.round(mrr * 100) / 100
    const mrrContractsRounded = Math.round(mrrContracts * 100) / 100
    const mrrTotal = Math.round((mrrStripe + mrrContractsRounded) * 100) / 100

    return Response.json({
      mrr: mrrTotal,
      mrr_stripe: mrrStripe,
      mrr_contracts: mrrContractsRounded,
      mrr_total: mrrTotal,
      activeSubscribers,
      cancelingAtPeriodEnd,
      fetchedAt: new Date().toISOString(),
    }, { headers: corsHeaders })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'stripe_error'
    const isTimeout = message.includes('timeout') ||
      message.includes('abort') ||
      (err as { type?: string }).type === 'StripeConnectionError'
    return errorResponse(message, isTimeout ? 504 : 502)
  }
})
