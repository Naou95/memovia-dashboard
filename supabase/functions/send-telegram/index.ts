import { sendTelegramMessage } from '../_shared/telegram.ts'

// Internal Edge Function — protected by service role key
// Called by other Edge Functions or external services to send Telegram notifications

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!token || token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { chat_id, message } = await req.json() as { chat_id: string; message: string }

    if (!chat_id || !message) {
      return new Response(JSON.stringify({ error: 'chat_id and message are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    await sendTelegramMessage(chat_id, message)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
