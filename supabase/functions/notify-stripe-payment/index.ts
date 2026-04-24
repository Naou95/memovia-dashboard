import { sendTelegramMessage } from '../_shared/telegram.ts'
import { timingSafeEqual } from '../_shared/timingSafeEqual.ts'

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

async function verifyStripeSignature(body: string, header: string | null): Promise<boolean> {
  if (!header || !STRIPE_WEBHOOK_SECRET) return false

  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const [k, v] = p.split('=')
      return [k.trim(), v?.trim()]
    }),
  )

  const timestamp = parts['t']
  const v1 = parts['v1']
  if (!timestamp || !v1) return false

  const tolerance = 300 // 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > tolerance) return false

  const payload = `${timestamp}.${body}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(STRIPE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return timingSafeEqual(computed, v1)
}

function formatParisDT(ts: number): string {
  return new Date(ts * 1000).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  const valid = await verifyStripeSignature(body, signature)
  if (!valid) {
    console.error('Invalid Stripe signature')
    return new Response(JSON.stringify({ error: 'invalid_signature' }), { status: 401 })
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(body)
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 })
  }

  const eventType = event.type as string
  if (eventType !== 'payment_intent.succeeded' && eventType !== 'invoice.payment_succeeded') {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const obj = event.data as { object: Record<string, unknown> }
  const data = obj.object

  let amount = 0
  let currency = 'eur'
  let email = 'inconnu'
  let plan = ''
  let createdTs = Math.floor(Date.now() / 1000)

  if (eventType === 'payment_intent.succeeded') {
    amount = (data.amount as number) ?? 0
    currency = (data.currency as string) ?? 'eur'
    email = ((data.receipt_email as string) ?? (data.customer_email as string)) || 'inconnu'
    createdTs = (data.created as number) ?? createdTs
    const meta = data.metadata as Record<string, string> | undefined
    plan = meta?.plan ?? meta?.product_name ?? ''
  } else {
    // invoice.payment_succeeded
    amount = (data.amount_paid as number) ?? 0
    currency = (data.currency as string) ?? 'eur'
    email = (data.customer_email as string) ?? 'inconnu'
    createdTs = (data.created as number) ?? createdTs

    const lines = data.lines as { data: Array<{ description?: string }> } | undefined
    plan = lines?.data?.[0]?.description ?? ''
  }

  const message = [
    '💳 Nouveau paiement MEMOVIA',
    '',
    `💰 Montant : ${formatAmount(amount, currency)}`,
    `📧 Client : ${email}`,
    plan ? `📦 Plan : ${plan}` : null,
    `📅 Date : ${formatParisDT(createdTs)}`,
  ]
    .filter((l) => l !== null)
    .join('\n')

  const chatIds = [
    Deno.env.get('TELEGRAM_CHAT_ID_NAOUFEL'),
    Deno.env.get('TELEGRAM_CHAT_ID_EMIR'),
  ].filter(Boolean) as string[]

  if (chatIds.length === 0) {
    console.error('No TELEGRAM_CHAT_ID configured')
    return new Response(JSON.stringify({ error: 'no_chat_id' }), { status: 500 })
  }

  await Promise.all(chatIds.map((chatId) => sendTelegramMessage(chatId, message)))

  console.log(`notify-stripe-payment: sent for ${eventType}, ${formatAmount(amount, currency)}`)
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
