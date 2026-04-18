import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'
import { ImapFlow } from 'npm:imapflow'
import { simpleParser } from 'npm:mailparser'
import { Buffer } from 'node:buffer'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const INTERNAL_EMAILS = ['bassou.naoufel@gmail.com', 'boutaleb.emir99@gmail.com']
const INTERNAL_DOMAIN = /@memovia\.io$/i

const FOLDERS = ['INBOX', 'Sent']
const DAYS_BACK = 30
const MAX_PER_FOLDER = 50
const CLAUDE_DELAY_MS = 200

const CLAUDE_SYSTEM_PROMPT =
  "Tu es un assistant CRM. Analyse cet email et détermine s'il provient d'un prospect potentiel pour MEMOVIA AI (plateforme EdTech pour CFAs et écoles). Réponds UNIQUEMENT en JSON valide avec ce format exact :\n" +
  '{"is_lead":true/false,"org_name":"nom de l\'organisation ou null","contact_name":"prénom nom ou null","contact_email":"email ou null","lead_type":"ecole|cfa|entreprise|autre ou null","notes":"résumé de l\'intérêt détecté en 1 phrase ou null"}\n' +
  "Ne réponds rien d'autre que ce JSON."

interface Address {
  name?: string
  address?: string
}

interface ClaudeLeadResult {
  is_lead: boolean
  org_name: string | null
  contact_name: string | null
  contact_email: string | null
  lead_type: 'ecole' | 'cfa' | 'entreprise' | 'autre' | null
  notes: string | null
}

function isInternalAddress(addr?: string): boolean {
  if (!addr) return false
  const lower = addr.toLowerCase().trim()
  if (INTERNAL_EMAILS.includes(lower)) return true
  if (INTERNAL_DOMAIN.test(lower)) return true
  return false
}

function extractJson(text: string): ClaudeLeadResult | null {
  if (!text) return null
  // Try direct parse
  try {
    return JSON.parse(text) as ClaudeLeadResult
  } catch { /* try to extract */ }
  // Try to extract first JSON object from text
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as ClaudeLeadResult
  } catch {
    return null
  }
}

async function analyzeWithClaude(
  apiKey: string,
  emailData: {
    fromName: string
    fromAddress: string
    toAddresses: string[]
    subject: string
    date: string
    bodyText: string
  },
): Promise<ClaudeLeadResult | null> {
  const userMessage =
    `De: ${emailData.fromName} <${emailData.fromAddress}>\n` +
    `À: ${emailData.toAddresses.join(', ')}\n` +
    `Sujet: ${emailData.subject}\n` +
    `Date: ${emailData.date}\n\n` +
    `${(emailData.bodyText || '').slice(0, 1500)}`

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: CLAUDE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`claude_api_${resp.status}: ${errText.slice(0, 200)}`)
  }

  const data = await resp.json() as {
    content?: Array<{ type: string; text?: string }>
  }
  const text = data.content?.find((c) => c.type === 'text')?.text || ''
  return extractJson(text)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Allow cron invocations using the service role key as bearer token
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const isCronCall = serviceRoleKey.length > 0 && authHeader === `Bearer ${serviceRoleKey}`
  if (!isCronCall) {
    const authResult = await validateAuth(req)
    if (authResult instanceof Response) return authResult
  }

  const imapUser = Deno.env.get('HOSTINGER_EMAIL')
  const imapPass = Deno.env.get('HOSTINGER_IMAP_PASSWORD')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!imapUser || !imapPass) {
    return errorResponse('email_not_configured', 500)
  }
  if (!anthropicKey) {
    return errorResponse('anthropic_not_configured', 500)
  }

  // Accept empty body
  try { await req.json() } catch { /* ignore */ }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const client = new ImapFlow({
    host: 'imap.hostinger.com',
    port: 993,
    secure: true,
    auth: { user: imapUser, pass: imapPass },
    logger: false,
  })

  let detected = 0
  let inserted = 0
  let skipped = 0
  let errors = 0
  const leads: unknown[] = []

  try {
    await client.connect()

    const thirtyDaysAgo = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000)

    for (const folder of FOLDERS) {
      let lock
      try {
        lock = await client.getMailboxLock(folder)
      } catch (err) {
        console.error(`Failed to lock folder ${folder}:`, err)
        continue
      }

      try {
        const searchResult = await client.search(
          { since: thirtyDaysAgo },
          { uid: true },
        )
        const uids = (searchResult || []).slice(-MAX_PER_FOLDER)
        if (uids.length === 0) continue

        // Step 1: fetch envelopes in batch
        type EnvelopeRow = {
          uid: number
          messageId: string | null
          fromAddress: string
          fromName: string
          toAddresses: string[]
          subject: string
          date: string
        }
        const envelopes: EnvelopeRow[] = []

        for await (const msg of client.fetch(
          uids,
          { envelope: true, uid: true, internalDate: true },
          { uid: true },
        )) {
          const from = msg.envelope.from?.[0]
          const toList = (msg.envelope.to || []) as Address[]
          envelopes.push({
            uid: Number(msg.uid),
            messageId: msg.envelope.messageId || null,
            fromAddress: (from?.address || '').toLowerCase(),
            fromName: from?.name || '',
            toAddresses: toList.map((a) => (a.address || '').toLowerCase()).filter(Boolean),
            subject: msg.envelope.subject || '(Sans objet)',
            date: msg.internalDate?.toISOString() || new Date().toISOString(),
          })
        }

        // Step 2: batch-check existing messageIds in DB
        const messageIds = envelopes.map((e) => e.messageId).filter((m): m is string => !!m)
        const existingIds = new Set<string>()
        if (messageIds.length > 0) {
          const { data: existing, error: existingErr } = await supabaseAdmin
            .from('leads')
            .select('email_message_id')
            .in('email_message_id', messageIds)
          if (existingErr) {
            console.error('Error checking existing messageIds:', existingErr)
          } else if (existing) {
            for (const row of existing as Array<{ email_message_id: string | null }>) {
              if (row.email_message_id) existingIds.add(row.email_message_id)
            }
          }
        }

        // Step 3: process each envelope
        for (const env of envelopes) {
          if (!env.messageId) {
            skipped++
            continue
          }
          if (existingIds.has(env.messageId)) {
            skipped++
            continue
          }
          // Skip only if ALL participants are internal (purely internal email).
          // Sent emails have from=us (internal) but to=external → keep those.
          const allAddresses = [env.fromAddress, ...env.toAddresses].filter(Boolean)
          const allInternal =
            allAddresses.length > 0 && allAddresses.every((a) => isInternalAddress(a))
          if (allInternal) {
            skipped++
            continue
          }

          detected++

          // Download body
          let bodyText = ''
          try {
            const download = await client.download(
              String(env.uid),
              undefined,
              { uid: true },
            )
            if (!download) throw new Error('no_download')
            const chunks: Uint8Array[] = []
            for await (const chunk of download.content) {
              chunks.push(
                typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk,
              )
            }
            const totalLen = chunks.reduce((n, c) => n + c.length, 0)
            const buffer = new Uint8Array(totalLen)
            let off = 0
            for (const chunk of chunks) {
              buffer.set(chunk, off)
              off += chunk.length
            }
            const parsed = await simpleParser(Buffer.from(buffer))
            bodyText = parsed.text || ''
          } catch (err) {
            console.error(`Download/parse failed for uid=${env.uid} folder=${folder}:`, err)
            errors++
            continue
          }

          // Ask Claude
          let analysis: ClaudeLeadResult | null = null
          try {
            analysis = await analyzeWithClaude(anthropicKey, {
              fromName: env.fromName,
              fromAddress: env.fromAddress,
              toAddresses: env.toAddresses,
              subject: env.subject,
              date: env.date,
              bodyText,
            })
          } catch (err) {
            console.error(`Claude analysis failed for uid=${env.uid}:`, err)
            errors++
            await new Promise((r) => setTimeout(r, CLAUDE_DELAY_MS))
            continue
          }

          // Rate-limit delay between Claude calls
          await new Promise((r) => setTimeout(r, CLAUDE_DELAY_MS))

          if (!analysis) {
            console.error(`Claude returned invalid JSON for uid=${env.uid}`)
            errors++
            continue
          }

          if (!analysis.is_lead) {
            skipped++
            continue
          }

          // Dedup by contact_email if provided
          const contactEmail = (analysis.contact_email || '').trim().toLowerCase() || null
          if (contactEmail) {
            const { data: dup, error: dupErr } = await supabaseAdmin
              .from('leads')
              .select('id')
              .eq('contact_email', contactEmail)
              .limit(1)
            if (dupErr) {
              console.error('Error checking contact_email dup:', dupErr)
            } else if (dup && dup.length > 0) {
              skipped++
              continue
            }
          }

          const name =
            analysis.org_name?.trim() ||
            analysis.contact_name?.trim() ||
            contactEmail ||
            env.fromAddress ||
            '(Sans nom)'

          const leadType = analysis.lead_type &&
              ['ecole', 'cfa', 'entreprise', 'autre'].includes(analysis.lead_type)
            ? analysis.lead_type
            : 'autre'

          const insertRow = {
            name,
            type: leadType,
            canal: 'email',
            status: 'nouveau',
            assigned_to: 'naoufel',
            notes: analysis.notes || null,
            email_message_id: env.messageId,
            contact_email: contactEmail,
            contact_name: analysis.contact_name?.trim() || null,
            source: 'email_auto',
          }

          const { data: insData, error: insErr } = await supabaseAdmin
            .from('leads')
            .insert(insertRow)
            .select()
            .single()

          if (insErr) {
            console.error(`Insert failed for uid=${env.uid}:`, insErr)
            errors++
            continue
          }

          inserted++
          leads.push(insData)
        }
      } finally {
        try { lock.release() } catch { /* ignore */ }
      }
    }

    await client.logout()
    return Response.json(
      { detected, inserted, skipped, errors, leads },
      { headers: corsHeaders },
    )
  } catch (err) {
    try { await client.logout() } catch { /* ignore */ }
    console.error('email-lead-detector error:', err)
    return errorResponse('imap_connection_failed', 503)
  }
})
