export interface EmailAddress {
  name?: string
  address: string
}

export interface EmailMessage {
  uid: number
  messageId: string
  subject: string
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  date: string
  seen: boolean
  flagged: boolean
  hasAttachments: boolean
  folder: string
}

export interface EmailMessageDetail extends EmailMessage {
  html?: string
  text?: string
  thread?: EmailMessageDetail[]
}

export interface EmailAlert {
  uid: number
  subject: string
  from: EmailAddress
  date: string
  keywords: string[]
  hoursUnread: number
}

export interface EmailListResponse {
  messages: EmailMessage[]
  total: number
  folder: string
  alerts: EmailAlert[]
}

export interface EmailSendPayload {
  from: string
  to: string
  cc?: string
  subject: string
  body: string
  isHtml?: boolean
  inReplyTo?: string
}
