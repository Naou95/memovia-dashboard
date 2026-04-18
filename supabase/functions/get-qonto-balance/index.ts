import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

interface QontoBankAccount {
  balance_cents: number
  currency: string
  slug: string
  name: string
}

interface QontoResponse {
  bank_accounts: QontoBankAccount[]
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // 1. Valider l'auth
  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  // 2. Valider env vars
  const apiKey = Deno.env.get('QONTO_API_KEY')
  const orgSlug = Deno.env.get('QONTO_ORGANIZATION_SLUG')
  if (!apiKey || !orgSlug) {
    return errorResponse('qonto_not_configured', 500)
  }

  try {
    // 3. Appel Qonto API v2
    const res = await fetch('https://thirdparty.qonto.com/v2/bank_accounts', {
      signal: AbortSignal.timeout(8000),
      headers: {
        'Authorization': `${orgSlug}:${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const body = await res.text()
      return new Response(
        JSON.stringify({ error: `qonto_${res.status}`, detail: body }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { bank_accounts } = await res.json() as QontoResponse

    if (!bank_accounts || bank_accounts.length === 0) {
      return Response.json(
        { balance: 0, currency: 'EUR', fetchedAt: new Date().toISOString() },
        { headers: corsHeaders }
      )
    }

    // Somme de tous les comptes (cas multi-comptes)
    const totalCents = bank_accounts.reduce(
      (sum, account) => sum + (account.balance_cents ?? 0),
      0
    )

    return Response.json({
      balance: Math.round(totalCents) / 100,
      currency: bank_accounts[0].currency ?? 'EUR',
      fetchedAt: new Date().toISOString(),
    }, { headers: corsHeaders })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'qonto_error'
    const isTimeout = message.includes('abort') || message.includes('timeout')
    return errorResponse(message, isTimeout ? 504 : 502)
  }
})
