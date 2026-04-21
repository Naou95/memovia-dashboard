import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'
import { ImapFlow } from 'npm:imapflow'
import { simpleParser } from 'npm:mailparser'
import { Buffer } from 'node:buffer'

type EmailItem = {
  uid: number
  messageId: string
  subject: string
  from: { name: string; address: string }
  to: { name: string; address: string }[]
  cc: { name: string; address: string }[]
  date: string
  seen: boolean
  flagged: boolean
  hasAttachments: boolean
  folder: string
  html?: string
  text?: string
}

async function fetchEmail(
  client: ImapFlow,
  uid: number,
  folderName: string
): Promise<{ email: EmailItem; refs: string[]; inReplyTo: string } | null> {
  try {
    const download = await client.download(String(uid), undefined, { uid: true })
    if (!download) return null

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

    return {
      email: {
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
        folder: folderName,
        html: parsed.html || undefined,
        text: parsed.text || undefined,
      },
      refs: Array.isArray(parsed.references) ? parsed.references : [],
      inReplyTo: parsed.inReplyTo || '',
    }
  } catch {
    return null
  }
}

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

    // Step 1: Get the main email
    let mainResult: { email: EmailItem; refs: string[]; inReplyTo: string } | null = null

    const lock = await client.getMailboxLock(folder)
    try {
      await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
      mainResult = await fetchEmail(client, uid, folder)
    } finally {
      lock.release()
    }

    if (!mainResult) {
      await client.logout()
      return errorResponse('message_not_found', 404)
    }

    const { email: mainEmail, refs: parsedRefs, inReplyTo: parsedInReplyTo } = mainResult
    const rootId = parsedRefs[0] || parsedInReplyTo || mainEmail.messageId
    let threadEmails: EmailItem[] = [mainEmail]

    // Step 2: Thread search across INBOX and Sent
    if (rootId) {
      for (const searchFolder of ['INBOX', 'Sent']) {
        try {
          const searchLock = await client.getMailboxLock(searchFolder)
          const foundUids: number[] = []

          try {
            for (const criterion of [
              { key: 'references', value: rootId },
              { key: 'message-id', value: rootId },
              { key: 'in-reply-to', value: rootId },
            ]) {
              try {
                const uids = await client.search({ header: criterion }, { uid: true })
                if (Array.isArray(uids)) foundUids.push(...uids)
              } catch { /* HEADER search not supported on this server */ }
            }

            const uniqueUids = [...new Set(foundUids)]

            for (const threadUid of uniqueUids.slice(0, 10)) {
              if (searchFolder === folder && threadUid === uid) continue
              const result = await fetchEmail(client, threadUid, searchFolder)
              if (result) threadEmails.push(result.email)
            }
          } finally {
            searchLock.release()
          }
        } catch { /* folder doesn't exist or inaccessible */ }
      }

      // Deduplicate by messageId and sort by date ASC
      const seen = new Set<string>()
      threadEmails = threadEmails
        .filter((e) => {
          if (seen.has(e.messageId)) return false
          seen.add(e.messageId)
          return true
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }

    await client.logout()

    return Response.json(
      {
        ...mainEmail,
        thread: threadEmails.length > 1 ? threadEmails : undefined,
      },
      { headers: corsHeaders }
    )
  } catch (err) {
    try { await client.logout() } catch { /* ignore */ }
    console.error('IMAP get error:', err)
    return errorResponse('imap_connection_failed', 503)
  }
})
