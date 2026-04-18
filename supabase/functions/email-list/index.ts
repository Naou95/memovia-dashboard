import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'
import { ImapFlow } from 'npm:imapflow'

const CRITICAL_KEYWORDS = ['contrat', 'devis', 'résiliation', 'resiliation', 'facturation', 'urgent']
const ALERT_HOURS = 24

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  const imapUser = Deno.env.get('HOSTINGER_EMAIL')
  const imapPass = Deno.env.get('HOSTINGER_IMAP_PASSWORD')

  if (!imapUser || !imapPass) {
    return errorResponse('email_not_configured', 500)
  }

  let body: { folder?: string; page?: number } = {}
  try {
    if (req.method === 'POST') body = await req.json()
  } catch { /* ignore */ }

  const folder = body.folder || 'INBOX'
  const page = Math.max(1, body.page || 1)
  const limit = 30

  const client = new ImapFlow({
    host: 'imap.hostinger.com',
    port: 993,
    secure: true,
    auth: { user: imapUser, pass: imapPass },
    logger: false,
  })

  try {
    await client.connect()

    const lock = await client.getMailboxLock(folder)
    const messages: unknown[] = []
    const alerts: unknown[] = []
    let total = 0

    try {
      total = (client.mailbox as { exists?: number }).exists ?? 0

      if (total > 0) {
        const end = Math.max(1, total - ((page - 1) * limit))
        const start = Math.max(1, end - limit + 1)
        const range = `${start}:${end}`

        for await (const msg of client.fetch(range, {
          envelope: true,
          flags: true,
          uid: true,
          internalDate: true,
        })) {
          const from = msg.envelope.from?.[0]
          messages.push({
            uid: msg.uid,
            messageId: msg.envelope.messageId || String(msg.uid),
            subject: msg.envelope.subject || '(Sans objet)',
            from: { name: from?.name || '', address: from?.address || '' },
            to: (msg.envelope.to || []).map((a: { name?: string; address?: string }) => ({
              name: a.name || '',
              address: a.address || '',
            })),
            date: msg.internalDate?.toISOString() || new Date().toISOString(),
            seen: msg.flags.has('\\Seen'),
            flagged: msg.flags.has('\\Flagged'),
            hasAttachments: false,
            folder,
          })
        }

        messages.sort((a: unknown, b: unknown) => {
          const ma = a as { date: string }
          const mb = b as { date: string }
          return new Date(mb.date).getTime() - new Date(ma.date).getTime()
        })

        // Search unseen messages older than ALERT_HOURS for critical keyword detection
        const yesterday = new Date(Date.now() - ALERT_HOURS * 60 * 60 * 1000)
        const unseenOldUids = await client.search(
          { seen: false, before: yesterday },
          { uid: true }
        )

        if (unseenOldUids.length > 0) {
          for await (const msg of client.fetch(
            unseenOldUids,
            { envelope: true, uid: true, internalDate: true },
            { uid: true }
          )) {
            const subject = msg.envelope.subject || ''
            const subjectLower = subject.toLowerCase()
            const foundKeywords = CRITICAL_KEYWORDS.filter((kw) => subjectLower.includes(kw))
            if (foundKeywords.length > 0) {
              const from = msg.envelope.from?.[0]
              const hoursUnread = Math.floor(
                (Date.now() - (msg.internalDate?.getTime() ?? 0)) / (1000 * 60 * 60)
              )
              alerts.push({
                uid: msg.uid,
                subject,
                from: { name: from?.name || '', address: from?.address || '' },
                date: msg.internalDate?.toISOString() || '',
                keywords: foundKeywords,
                hoursUnread,
              })
            }
          }
        }
      }
    } finally {
      lock.release()
    }

    await client.logout()
    return Response.json({ messages, total, folder, alerts }, { headers: corsHeaders })
  } catch (err) {
    try { await client.logout() } catch { /* ignore */ }
    console.error('IMAP list error:', err)
    return errorResponse('imap_connection_failed', 503)
  }
})
