import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'
import nodemailer from 'npm:nodemailer'

const ALLOWED_FROM = [
  'naoufel@memovia.io',
  'support@memovia.io',
  'contact@memovia.io',
  'emir@memovia.io',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  const smtpUser = Deno.env.get('HOSTINGER_EMAIL')
  const smtpPassword = Deno.env.get('HOSTINGER_SMTP_PASSWORD')

  if (!smtpUser || !smtpPassword) {
    return errorResponse('email_not_configured', 500)
  }

  let payload: {
    from?: string
    to?: string
    cc?: string
    subject?: string
    body?: string
    isHtml?: boolean
    inReplyTo?: string
  }

  try {
    payload = await req.json()
  } catch {
    return errorResponse('invalid_json', 400)
  }

  const { from, to, cc, subject, body, isHtml, inReplyTo } = payload

  if (!from || !to || !subject || !body) {
    return errorResponse('missing_fields', 400)
  }

  // Validate sender alias against allowlist
  if (!ALLOWED_FROM.includes(from)) {
    return errorResponse('invalid_from_address', 403)
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPassword },
  })

  try {
    const info = await transporter.sendMail({
      from,
      to,
      cc: cc || undefined,
      subject,
      ...(isHtml ? { html: body } : { text: body }),
      inReplyTo: inReplyTo || undefined,
      references: inReplyTo ? [inReplyTo] : undefined,
    })

    return Response.json(
      { messageId: info.messageId, accepted: info.accepted },
      { headers: corsHeaders }
    )
  } catch (err) {
    console.error('SMTP send error:', err)
    return errorResponse('smtp_send_failed', 503)
  }
})
