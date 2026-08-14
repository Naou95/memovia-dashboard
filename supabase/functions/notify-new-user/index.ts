import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendTelegramMessage } from '../_shared/telegram.ts'
import { isAuthenticatedCronCall } from '../_shared/cronAuth.ts'

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: {
    first_name?: string
    last_name?: string
    plan?: string
    account_type?: string
    created_at?: string
    user_id?: string
  }
  schema: string
  old_record: null | Record<string, unknown>
}

function formatParisDate(iso?: string): string {
  const date = iso ? new Date(iso) : new Date()
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`
}

function formatAccountType(accountType?: string): string {
  switch (accountType) {
    case 'student':
      return '🎓 Étudiant'
    case 'teacher':
    case 'teacher_b2c':
      return '👨‍🏫 Formateur'
    case 'school_admin':
      return '🏫 Admin B2B'
    default:
      return '❔ Inconnu'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  // Même trou que celui refermé sur `telegram-weekly-report` le 14/08 : aucun contrôle, et
  // `verify_jwt = false`. N'importe qui connaissant l'URL pouvait pousser du texte arbitraire
  // dans le Telegram de Naoufel — et pire, `record.user_id` part directement dans
  // `auth.admin.getUserById` plus bas : en comparant une réponse 200 à une 502, on obtenait un
  // oracle d'énumération des comptes. Refermé le 14/08/2026.
  //
  // 🔑 La cause racine était côté base, pas ici : le trigger `notify_new_user_telegram()`
  // envoyait `'Bearer ' || current_setting('app.service_role_key', true)`, or ce GUC n'a jamais
  // été posé. En SQL, `'Bearer ' || NULL` vaut NULL — le header partait vide. Ça ne se voyait pas
  // précisément parce que cette fonction ne lisait rien. La migration jumelle bascule le trigger
  // sur le secret de cron dédié (`x-cron-secret`), celui posé par 00034.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const parServiceRole = !!token && !!serviceRoleKey && token === serviceRoleKey

  if (!parServiceRole && !(await isAuthenticatedCronCall(req))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  try {
    const payload: WebhookPayload = await req.json()

    if (payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { first_name, last_name, plan, account_type, created_at, user_id } = payload.record

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
    const fullName = [first_name, last_name].filter(Boolean).join(' ') || 'Utilisateur'
    const dateLabel = formatParisDate(created_at)
    const typeLabel = formatAccountType(account_type)

    const message = [
      '🎉 Nouvel inscrit sur MEMOVIA !',
      '',
      `👤 Nom : ${fullName}`,
      `📧 Email : ${email}`,
      `📅 Inscrit le : ${dateLabel}`,
      `🎓 Type : ${typeLabel}`,
      `💳 Plan : ${plan || 'Free'}`,
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
