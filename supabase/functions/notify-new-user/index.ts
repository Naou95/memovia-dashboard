import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendTelegramMessage } from '../_shared/telegram.ts'

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: {
    first_name?: string
    plan?: string
    created_at?: string
    user_id?: string
  }
  schema: string
  old_record: null | Record<string, unknown>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  try {
    const payload: WebhookPayload = await req.json()

    if (payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { first_name, plan, created_at, user_id } = payload.record

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'missing user_id in payload' }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user_id)
    if (authError || !authUser?.user) {
      console.error('Failed to fetch auth user:', authError?.message)
      return new Response(JSON.stringify({ error: 'failed to fetch user email' }), { status: 502 })
    }

    const email = authUser.user.email ?? 'email inconnu'

    const dateLabel = created_at
      ? new Date(created_at).toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date().toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })

    const message = [
      '🎉 Nouvel inscrit sur MEMOVIA !',
      '',
      `👤 ${first_name || 'Utilisateur'}`,
      `📧 ${email}`,
      `📅 ${dateLabel}`,
      `🎯 Plan : ${plan || 'Free'}`,
    ].join('\n')

    const chatIds = [
      Deno.env.get('TELEGRAM_CHAT_ID_NAOUFEL'),
      Deno.env.get('TELEGRAM_CHAT_ID_EMIR'),
    ].filter(Boolean) as string[]

    if (chatIds.length === 0) {
      return new Response(JSON.stringify({ error: 'no TELEGRAM_CHAT_ID configured' }), { status: 500 })
    }

    await Promise.all(chatIds.map((chatId) => sendTelegramMessage(chatId, message)))

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error'
    console.error('notify-new-user error:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})
