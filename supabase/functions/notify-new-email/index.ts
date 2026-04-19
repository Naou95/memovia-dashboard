import { createClient } from 'jsr:@supabase/supabase-js@2'
import { ImapFlow } from 'npm:imapflow'
import { sendTelegramMessage } from '../_shared/telegram.ts'

const FILTER_KEYWORDS = [
  'unsubscribe', 'noreply', 'no-reply', 'newsletter',
  'notification', 'donotreply', 'automated',
]

function isAutoEmail(subject: string, fromEmail: string): boolean {
  const combined = (subject + ' ' + fromEmail).toLowerCase()
  return FILTER_KEYWORDS.some((kw) => combined.includes(kw))
}

function formatDateFR(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}

Deno.serve(async (_req) => {
  try {
    const imapUser = Deno.env.get('HOSTINGER_EMAIL')
    const imapPass = Deno.env.get('HOSTINGER_IMAP_PASSWORD')
    if (!imapUser || !imapPass) {
      return new Response(JSON.stringify({ error: 'email_not_configured' }), { status: 500 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const cutoff = new Date(Date.now() - 35 * 60 * 1000)
    // IMAP SINCE is date-only — search last 2 days and filter by time in JS
    const sinceDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

    const client = new ImapFlow({
      host: 'imap.hostinger.com',
      port: 993,
      secure: true,
      auth: { user: imapUser, pass: imapPass },
      logger: false,
    })

    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    const candidates: Array<{
      messageId: string
      from: { name: string; email: string }
      subject: string
      date: Date
    }> = []

    try {
      const uids = await client.search({ seen: false, since: sinceDate }, { uid: true })

      if (uids.length > 0) {
        for await (const msg of client.fetch(
          uids,
          { envelope: true, uid: true, internalDate: true, headers: ['list-unsubscribe'] },
          { uid: true },
        )) {
          const msgDate = msg.internalDate ?? new Date(0)
          if (msgDate < cutoff) continue

          const subject = msg.envelope.subject || ''
          const fromAddr = msg.envelope.from?.[0]
          const fromEmail = fromAddr?.address || ''
          const fromName = fromAddr?.name || ''

          if (isAutoEmail(subject, fromEmail)) continue

          // Skip emails with List-Unsubscribe header
          if (msg.headers) {
            const raw = new TextDecoder().decode(msg.headers as Uint8Array).toLowerCase()
            if (raw.includes('list-unsubscribe')) continue
          }

          const messageId = msg.envelope.messageId || `uid-${msg.uid}`
          candidates.push({ messageId, from: { name: fromName, email: fromEmail }, subject, date: msgDate })
        }
      }
    } finally {
      lock.release()
    }

    await client.logout()

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data: alreadySent } = await supabase
      .from('email_notifications_sent')
      .select('message_id')
      .in('message_id', candidates.map((e) => e.messageId))

    const alreadySentIds = new Set((alreadySent ?? []).map((r: { message_id: string }) => r.message_id))
    const newEmails = candidates.filter((e) => !alreadySentIds.has(e.messageId))

    if (newEmails.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'already_notified' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const chatIds = [
      Deno.env.get('TELEGRAM_CHAT_ID_NAOUFEL'),
      Deno.env.get('TELEGRAM_CHAT_ID_EMIR'),
    ].filter(Boolean) as string[]

    let sentCount = 0
    for (const email of newEmails) {
      const fromLabel = email.from.name
        ? `${email.from.name} <${email.from.email}>`
        : email.from.email

      const message = [
        '📧 Nouvel email reçu',
        '',
        `De : ${fromLabel}`,
        `Sujet : ${email.subject || '(Sans objet)'}`,
        `Reçu : ${formatDateFR(email.date)}`,
      ].join('\n')

      await Promise.all(chatIds.map((chatId) => sendTelegramMessage(chatId, message)))
      await supabase.from('email_notifications_sent').insert({ message_id: email.messageId })
      sentCount++
    }

    return new Response(JSON.stringify({ ok: true, sent: sentCount }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error'
    console.error('notify-new-email error:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})
