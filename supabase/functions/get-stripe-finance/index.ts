import Stripe from 'npm:stripe@17'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

// ── Types (miroir de src/types/stripe.ts côté frontend) ───────────────────────

interface MonthlyRevenue { month: string; revenue: number }
interface SubscriptionRow {
  id: string; customerEmail: string; planName: string
  amount: number; interval: 'month' | 'year'; startDate: string; cancelAtPeriodEnd: boolean
  cancelAt: string | null
}
interface TransactionRow {
  id: string; date: string; description: string
  amount: number; currency: string; status: 'succeeded' | 'failed' | 'refunded'
  customerEmail: string
}

// ── Helpers (exportés pour tests Vitest) ────────────────────────────────────────

/**
 * Groupe les factures payées par mois civil.
 * Initialise les 12 derniers mois à 0 même si aucune facture n'existe.
 */
export function groupByMonth(
  invoices: Array<{ created: number; amount_paid: number }>,
  sinceTimestamp: number
): MonthlyRevenue[] {
  const map = new Map<string, number>()
  const now = new Date()

  // Initialiser les 12 mois (mois le plus ancien → mois courant)
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    map.set(monthKey(d), 0)
  }

  for (const inv of invoices) {
    if (!inv.created || inv.created < sinceTimestamp) continue
    const d = new Date(inv.created * 1000)
    const key = monthKey(d)
    if (map.has(key)) {
      map.set(key, (map.get(key)!) + inv.amount_paid / 100)
    }
  }

  return Array.from(map.entries()).map(([month, revenue]) => ({
    month,
    revenue: Math.round(revenue * 100) / 100,
  }))
}

function monthKey(d: Date): string {
  return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
}

/**
 * Normalise un plan Stripe en montant mensuel (euros).
 * Plans annuels divisés par 12.
 */
export function normalizePlanAmount(plan: { amount: number; interval: string }): number {
  const monthly = plan.interval === 'year' ? plan.amount / 12 : plan.amount
  return Math.round((monthly / 100) * 100) / 100
}

// ── Edge Function ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // 1. Auth
  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  // 2. Stripe key
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!secretKey) return errorResponse('stripe_not_configured', 500)

  try {
    const stripe = new Stripe(secretKey)

    const now = new Date()
    const startOfMonth = Math.floor(
      new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
    )
    const twelveMonthsAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 3600

    // 3. 4 appels Stripe en parallèle
    const [activeSubs, paidInvoices, recentCharges, churnEvents] = await Promise.all([
      stripe.subscriptions.list(
        { status: 'active', limit: 100, expand: ['data.customer'] },
        { timeout: 8000 }
      ),
      stripe.invoices.list(
        { status: 'paid', limit: 100, created: { gte: twelveMonthsAgo } },
        { timeout: 8000 }
      ),
      stripe.charges.list(
        { limit: 20, expand: ['data.customer'] },
        { timeout: 8000 }
      ),
      stripe.events.list(
        { type: 'customer.subscription.deleted', created: { gte: startOfMonth }, limit: 100 },
        { timeout: 8000 }
      ),
    ])

    // 4. Plans payants uniquement
    const paidSubs = activeSubs.data.filter(
      (sub) => (sub.items.data[0]?.plan?.amount ?? 0) > 0
    )

    // 5. MRR
    const mrr = paidSubs.reduce((sum, sub) => {
      const plan = sub.items.data[0]?.plan
      if (!plan?.amount) return sum
      return sum + normalizePlanAmount({ amount: plan.amount, interval: plan.interval })
    }, 0)

    // 6. Récupérer les noms de produits Stripe (prices.retrieve par ID unique)
    // Stripe ne supporte pas expand data.items.data.price.product sur une list
    const uniquePriceIds = [
      ...new Set(
        paidSubs
          .map((sub) => sub.items.data[0]?.price?.id)
          .filter((id): id is string => typeof id === 'string')
      ),
    ]
    const priceResults = await Promise.all(
      uniquePriceIds.map((id) =>
        stripe.prices.retrieve(id, { expand: ['product'] }, { timeout: 5000 }).catch(() => null)
      )
    )
    const priceToProductName = new Map<string, string>()
    for (const price of priceResults) {
      if (!price) continue
      if (
        typeof price.product === 'object' &&
        price.product !== null &&
        !('deleted' in price.product)
      ) {
        priceToProductName.set(price.id, (price.product as Stripe.Product).name)
      }
    }

    // 7. Abonnements actifs → SubscriptionRow[]
    const subscriptions: SubscriptionRow[] = paidSubs.map((sub) => {
      const customer = sub.customer
      // Guard critique : customer peut être une string (ID) si deleted ou non-expandé
      const email =
        typeof customer === 'object' &&
        customer !== null &&
        !('deleted' in customer)
          ? (customer as Stripe.Customer).email ?? ''
          : ''

      const plan = sub.items.data[0]?.plan
      const priceId = sub.items.data[0]?.price?.id
      const productName = priceId ? priceToProductName.get(priceId) : undefined

      const cancelAt = sub.cancel_at
        ? new Date(sub.cancel_at * 1000).toISOString()
        : sub.cancel_at_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null

      return {
        id: sub.id,
        customerEmail: email,
        planName: productName ?? plan?.nickname ?? 'Plan inconnu',
        amount: plan
          ? normalizePlanAmount({ amount: plan.amount ?? 0, interval: plan.interval })
          : 0,
        interval: (plan?.interval as 'month' | 'year') ?? 'month',
        startDate: new Date(sub.start_date * 1000).toISOString(),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        cancelAt,
      }
    })

    // 7. Revenus par mois (12 derniers mois)
    const revenueByMonth = groupByMonth(paidInvoices.data, twelveMonthsAgo)
    const totalRevenue12mo = Math.round(
      revenueByMonth.reduce((s, m) => s + m.revenue, 0) * 100
    ) / 100

    // 8. Nouveaux abonnés ce mois
    const newThisMonth = paidSubs.filter((s) => s.created >= startOfMonth).length

    // 9. Churns ce mois (plans payants qui ont terminé ce mois)
    const churnsThisMonth = churnEvents.data.filter((e) => {
      const sub = e.data.object as Stripe.Subscription
      return (sub.items?.data[0]?.plan?.amount ?? 0) > 0
    }).length

    // 10. Transactions récentes
    const recentTransactions: TransactionRow[] = recentCharges.data.map((c) => {
      const customerEmail: string =
        typeof c.customer === 'object' && c.customer !== null && !('deleted' in c.customer)
          ? (c.customer as Stripe.Customer).email ?? ''
          : (c.billing_details?.email ?? c.receipt_email ?? '')
      return {
        id: c.id,
        date: new Date(c.created * 1000).toISOString(),
        description: c.description ?? c.statement_descriptor ?? c.id,
        amount: Math.round((c.amount / 100) * 100) / 100,
        currency: c.currency.toUpperCase(),
        status: c.refunded ? 'refunded' : c.status === 'succeeded' ? 'succeeded' : 'failed',
        customerEmail,
      }
    })

    return Response.json(
      {
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(mrr * 12 * 100) / 100,
        newThisMonth,
        churnsThisMonth,
        totalRevenue12mo,
        subscriptions,
        revenueByMonth,
        recentTransactions,
        fetchedAt: new Date().toISOString(),
      },
      { headers: corsHeaders }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'stripe_error'
    const isTimeout =
      message.includes('timeout') ||
      message.includes('abort') ||
      (err as { type?: string }).type === 'StripeConnectionError'
    return errorResponse(message, isTimeout ? 504 : 502)
  }
})
