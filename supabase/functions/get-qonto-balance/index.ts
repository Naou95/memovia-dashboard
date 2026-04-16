import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  const apiKey = Deno.env.get('QONTO_API_KEY')
  const orgSlug = Deno.env.get('QONTO_ORGANIZATION_SLUG')
  if (!apiKey || !orgSlug) {
    return new Response(JSON.stringify({ error: 'qonto_not_configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
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
    return new Response(JSON.stringify({ error: message }), {
      status: isTimeout ? 504 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
