import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type {
  EmailMessage,
  EmailMessageDetail,
  EmailAlert,
  EmailListResponse,
  EmailSendPayload,
} from '@/types/email'

const CACHE_TTL = 2 * 60 * 1000
const listCache = new Map<string, { data: EmailListResponse; ts: number }>()

export interface UseEmailResult {
  messages: EmailMessage[]
  alerts: EmailAlert[]
  total: number
  isLoading: boolean
  isSending: boolean
  error: string | null
  loadEmails: (folder?: string, page?: number) => Promise<void>
  getEmail: (uid: number, folder?: string) => Promise<EmailMessageDetail | null>
  sendEmail: (payload: EmailSendPayload) => Promise<boolean>
  invalidateCache: () => void
}

export function useEmail(): UseEmailResult {
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [alerts, setAlerts] = useState<EmailAlert[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadEmails = useCallback(async (folder = 'INBOX', page = 1) => {
    const cacheKey = `${folder}:${page}`
    const cached = listCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setMessages(cached.data.messages)
      setAlerts(cached.data.alerts)
      setTotal(cached.data.total)
      return
    }

    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase.functions.invoke<EmailListResponse>('email-list', {
      body: { folder, page },
    })

    if (err || !data) {
      setError('Impossible de charger les emails')
      toast.error('Erreur IMAP', { description: 'Vérifiez les credentials Hostinger' })
    } else {
      listCache.set(cacheKey, { data, ts: Date.now() })
      setMessages(data.messages)
      setAlerts(data.alerts)
      setTotal(data.total)
    }

    setIsLoading(false)
  }, [])

  const getEmail = useCallback(
    async (uid: number, folder = 'INBOX'): Promise<EmailMessageDetail | null> => {
      const { data, error: err } = await supabase.functions.invoke<EmailMessageDetail>(
        'email-get',
        { body: { uid, folder } }
      )

      if (err || !data) {
        toast.error('Email introuvable')
        return null
      }

      // Mark message as seen in local cache
      listCache.forEach((entry) => {
        entry.data.messages = entry.data.messages.map((m) =>
          m.uid === uid ? { ...m, seen: true } : m
        )
      })
      setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m)))

      return data
    },
    []
  )

  const sendEmail = useCallback(async (payload: EmailSendPayload): Promise<boolean> => {
    setIsSending(true)

    const { error: err } = await supabase.functions.invoke('email-send', { body: payload })

    setIsSending(false)

    if (err) {
      toast.error("Échec de l'envoi", { description: 'Vérifiez les credentials SMTP' })
      return false
    }

    toast.success('Email envoyé')
    return true
  }, [])

  const invalidateCache = useCallback(() => {
    listCache.clear()
  }, [])

  return {
    messages,
    alerts,
    total,
    isLoading,
    isSending,
    error,
    loadEmails,
    getEmail,
    sendEmail,
    invalidateCache,
  }
}
