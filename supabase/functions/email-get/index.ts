import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'
import { ImapFlow } from 'npm:imapflow'
import { simpleParser } from 'npm:mailparser'
import { Buffer } from 'node:buffer'

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

  let body: { uid?: number; folder?: string } = {}
  try {
    body = await req.json()
  } catch {
    return errorResponse('invalid_json', 400)
  }

  const uid = Number(body.uid)
  const folder = body.folder || 'INBOX'

  if (!uid) return errorResponse('uid_required', 400)

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
    let result = null

    try {
      // Mark as read
      await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })

      // Download raw RFC822 source
      const download = await client.download(String(uid), undefined, { uid: true })
      if (!download) {
        return errorResponse('message_not_found', 404)
      }

      // Collect readable stream into Uint8Array buffer
      const chunks: Uint8Array[] = []
      for await (const chunk of download.content) {
        chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk)
      }
      const totalLen = chunks.reduce((n, c) => n + c.length, 0)
      const buffer = new Uint8Array(totalLen)
      let offset = 0
      for (const chunk of chunks) {
        buffer.set(chunk, offset)
        offset += chunk.length
      }

      const parsed = await simpleParser(Buffer.from(buffer))

      result = {
        uid,
        messageId: parsed.messageId || String(uid),
        subject: parsed.subject || '(Sans objet)',
        from: {
          name: parsed.from?.value?.[0]?.name || '',
          address: parsed.from?.value?.[0]?.address || '',
        },
        to: (parsed.to?.value || []).map((a: { name?: string; address?: string }) => ({
          name: a.name || '',
          address: a.address || '',
        })),
        cc: (parsed.cc?.value || []).map((a: { name?: string; address?: string }) => ({
          name: a.name || '',
          address: a.address || '',
        })),
        date: parsed.date?.toISOString() || new Date().toISOString(),
        seen: true,
        flagged: false,
        hasAttachments: (parsed.attachments || []).length > 0,
        folder,
        html: parsed.html || undefined,
        text: parsed.text || undefined,
      }
    } finally {
      lock.release()
    }

    await client.logout()
    return Response.json(result, { headers: corsHeaders })
  } catch (err) {
    try { await client.logout() } catch { /* ignore */ }
    console.error('IMAP get error:', err)
    return errorResponse('imap_connection_failed', 503)
  }
})
