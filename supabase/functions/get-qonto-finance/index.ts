import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

// ── Types Qonto API v2 ──────────────────────────────────────────────────────

interface QontoBankAccount {
  id: string
  balance_cents: number
  currency: string
  slug: string
  iban: string
  name: string
}

interface QontoApiTransaction {
  transaction_id: string
  label: string
  amount: number
  amount_cents: number
  side: 'credit' | 'debit'
  operation_type: string
  currency: string
  status: 'completed' | 'declined' | 'pending'
  settled_at: string | null
  emitted_at: string
  category: string | null
}

interface QontoTransactionsResponse {
  transactions: QontoApiTransaction[]
  meta: {
    current_page: number
    next_page: number | null
    total_pages: number
    total_count: number
    per_page: number
  }
}

// ── Types de sortie ────────────────────────────────────────────────────────

interface QontoTransaction {
  id: string
  label: string
  amount: number
  side: 'credit' | 'debit'
  category: string | null
  settledAt: string
  status: 'completed' | 'declined' | 'pending'
}

interface MonthlyCashFlow {
  month: string
  income: number
  expenses: number
  net: number
}

interface QontoFinanceData {
  balance: number
  currency: string
  transactions: QontoTransaction[]
  monthlyCashFlow: MonthlyCashFlow[]
  fetchedAt: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Formate une date ISO en label de mois français.
 * Ex : '2026-04-15T...' → 'Avr 2026'
 */
function formatMonthLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    month: 'short',
    year: 'numeric',
  }).replace('.', '')  // certains locales ajoutent un point après l'abréviation
}

/**
 * Agrège les transactions par mois sur les 6 derniers mois calendaires.
 * Retourne un tableau de 6 entrées, du plus ancien au plus récent.
 */
function buildMonthlyCashFlow(transactions: QontoApiTransaction[]): MonthlyCashFlow[] {
  const now = new Date()
  const months: MonthlyCashFlow[] = []

  // Construire les 6 derniers mois (index 5 = mois courant, 0 = il y a 5 mois)
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      month: d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }).replace('.', ''),
      income: 0,
      expenses: 0,
      net: 0,
    })
  }

  for (const tx of transactions) {
    if (tx.status !== 'completed') continue
    const dateStr = tx.settled_at ?? tx.emitted_at
    if (!dateStr) continue

    const txDate = new Date(dateStr)
    // Trouver le bucket correspondant
    for (const bucket of months) {
      // Re-parse le label pour comparer
      const [monthPart] = bucket.month.split(' ')
      const txLabel = txDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
        .replace('.', '')
      if (txLabel === bucket.month) {
        const amountEur = tx.amount_cents / 100
        if (tx.side === 'credit') {
          bucket.income += amountEur
        } else {
          bucket.expenses += amountEur
        }
        break
      }
    }
  }

  // Calculer le net
  for (const bucket of months) {
    bucket.net = Math.round((bucket.income - bucket.expenses) * 100) / 100
    bucket.income = Math.round(bucket.income * 100) / 100
    bucket.expenses = Math.round(bucket.expenses * 100) / 100
  }

  return months
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  const apiKey = Deno.env.get('QONTO_API_KEY')
  const orgSlug = Deno.env.get('QONTO_ORGANIZATION_SLUG')
  if (!apiKey || !orgSlug) {
    return errorResponse('qonto_not_configured', 500)
  }

  const qontoHeaders = {
    'Authorization': `${orgSlug}:${apiKey}`,
    'Content-Type': 'application/json',
  }

  try {
    // 1. Récupérer les comptes bancaires pour obtenir le vrai bank_account_slug
    const accountsRes = await fetch('https://thirdparty.qonto.com/v2/bank_accounts', {
      signal: AbortSignal.timeout(8000),
      headers: qontoHeaders,
    })

    if (!accountsRes.ok) {
      const body = await accountsRes.text()
      return new Response(
        JSON.stringify({ error: `qonto_accounts_${accountsRes.status}`, detail: body }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { bank_accounts } = await accountsRes.json() as { bank_accounts: QontoBankAccount[] }

    // 2. Récupérer l'ID du premier compte (Qonto v2 exige bank_account_id ou iban)
    const bankAccountId = bank_accounts?.[0]?.id
    if (!bankAccountId) {
      return errorResponse('no_bank_account', 502)
    }

    // 3. Récupérer les transactions avec le bon bank_account_id
    const txRes = await fetch(
      'https://thirdparty.qonto.com/v2/transactions?' +
      new URLSearchParams({
        'bank_account_id': bankAccountId,
        'status[]': 'completed',
        'per_page': '100',
        'sort_by': 'settled_at:desc',
      }).toString(),
      {
        signal: AbortSignal.timeout(8000),
        headers: qontoHeaders,
      }
    )

    if (!txRes.ok) {
      const body = await txRes.text()
      return new Response(
        JSON.stringify({ error: `qonto_transactions_${txRes.status}`, detail: body }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { transactions: rawTx } = await txRes.json() as QontoTransactionsResponse

    // Solde total (somme multi-comptes)
    const totalCents = (bank_accounts ?? []).reduce(
      (sum, acc) => sum + (acc.balance_cents ?? 0),
      0
    )
    const balance = Math.round(totalCents) / 100
    const currency = bank_accounts?.[0]?.currency ?? 'EUR'

    // Mapper les transactions
    const transactions: QontoTransaction[] = (rawTx ?? []).map((tx) => ({
      id: tx.transaction_id,
      label: tx.label,
      amount: Math.round(tx.amount_cents) / 100,
      side: tx.side,
      category: tx.category ?? null,
      settledAt: tx.settled_at ?? tx.emitted_at,
      status: tx.status,
    }))

    // Agrégats mensuels
    const monthlyCashFlow = buildMonthlyCashFlow(rawTx ?? [])

    const payload: QontoFinanceData = {
      balance,
      currency,
      transactions,
      monthlyCashFlow,
      fetchedAt: new Date().toISOString(),
    }

    return Response.json(payload, { headers: corsHeaders })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'qonto_error'
    const isTimeout = message.includes('abort') || message.includes('timeout')
    return errorResponse(message, isTimeout ? 504 : 502)
  }
})
