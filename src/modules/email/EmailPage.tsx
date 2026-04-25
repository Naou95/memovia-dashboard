import { useState, useEffect } from 'react'
import { RefreshCw, Zap, X, FileText, Pencil, Inbox, Send as SendIcon, Archive, Trash2, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEmail } from '@/hooks/useEmail'
import { EmailList } from './components/EmailList'
import { EmailDetail } from './components/EmailDetail'
import { EmailCompose } from './components/EmailCompose'
import { EmailTemplates, type EmailTemplate } from './components/EmailTemplates'
import type { EmailMessageDetail } from '@/types/email'
import { supabase } from '@/lib/supabase'

const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

const FOLDERS = [
  { id: 'INBOX', label: 'Boîte de réception', icon: Inbox },
  { id: 'Sent', label: 'Envoyés', icon: SendIcon },
  { id: 'Drafts', label: 'Brouillons', icon: FileText },
  { id: 'Spam', label: 'Spam', icon: AlertTriangle },
  { id: 'Trash', label: 'Corbeille', icon: Trash2 },
]

const CRITICAL_KEYWORDS = ['contrat', 'devis', 'résiliation', 'resiliation', 'facturation', 'urgent']

function hasUrgentKeyword(subject: string): boolean {
  const lower = subject.toLowerCase()
  return CRITICAL_KEYWORDS.some((kw) => lower.includes(kw))
}

export default function EmailPage() {
  const { messages, alerts, total, isLoading, isSending, error, loadEmails, getEmail, sendEmail, invalidateCache } =
    useEmail()

  const [folder, setFolder] = useState('INBOX')
  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const [emailDetail, setEmailDetail] = useState<EmailMessageDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [replyTarget, setReplyTarget] = useState<EmailMessageDetail | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectionResult, setDetectionResult] = useState<{ inserted: number } | null>(null)

  useEffect(() => {
    loadEmails(folder, 1)
    setSelectedUid(null)
    setEmailDetail(null)
  }, [folder, loadEmails])

  const handleSelectEmail = async (uid: number) => {
    setSelectedUid(uid)
    setIsDetailLoading(true)
    const detail = await getEmail(uid, folder)
    setEmailDetail(detail)
    setIsDetailLoading(false)
  }

  const handleCompose = () => {
    setReplyTarget(null)
    setSelectedTemplate(null)
    setShowCompose(true)
  }

  const handleReply = (email: EmailMessageDetail) => {
    setReplyTarget(email)
    setSelectedTemplate(null)
    setShowCompose(true)
  }

  const handleCancelCompose = () => {
    setShowCompose(false)
    setReplyTarget(null)
    setSelectedTemplate(null)
  }

  const handleSelectTemplate = (template: EmailTemplate) => {
    setReplyTarget(null)
    setSelectedTemplate(template)
    setShowTemplates(false)
    setShowCompose(true)
  }

  const handleDetectLeads = async () => {
    setIsDetecting(true)
    setDetectionResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('email-lead-detector', { body: {} })
      if (error) throw error
      setDetectionResult({ inserted: data?.inserted ?? 0 })
    } catch {
      setDetectionResult({ inserted: -1 })
    } finally {
      setIsDetecting(false)
    }
  }

  const handleRefresh = () => {
    invalidateCache()
    loadEmails(folder, 1)
  }

  const unseenCount = messages.filter((m) => !m.seen).length

  // Filtered messages for search
  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => {
        const q = searchQuery.toLowerCase()
        const sender = (m.from.name || m.from.address).toLowerCase()
        return sender.includes(q) || m.subject.toLowerCase().includes(q)
      })
    : messages

  // Enrich messages with urgent flag
  const enrichedMessages = filteredMessages.map((m) => ({
    ...m,
    isUrgent: !m.seen && hasUrgentKeyword(m.subject),
  }))

  return (
    <div
      className="flex h-full flex-col"
      style={{ fontFamily: APPLE_FONT, overflow: 'hidden' }}
    >
      {/* Detection result banner */}
      <AnimatePresence>
        {detectionResult !== null && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 overflow-hidden"
          >
            <div
              className="flex items-center justify-between px-4 py-2.5 text-[13px]"
              style={
                detectionResult.inserted > 0
                  ? { backgroundColor: '#e8f5e9', color: '#2e7d32' }
                  : detectionResult.inserted === 0
                  ? { backgroundColor: '#f5f5f7', color: '#86868b' }
                  : { backgroundColor: '#fce4ec', color: '#c62828' }
              }
            >
              <span>
                {detectionResult.inserted > 0 ? (
                  <>
                    {detectionResult.inserted} nouveau{detectionResult.inserted !== 1 ? 'x' : ''} lead{detectionResult.inserted !== 1 ? 's' : ''} détecté{detectionResult.inserted !== 1 ? 's' : ''}{' '}
                    <a href="/prospection" className="underline font-medium">Voir dans Prospection</a>
                  </>
                ) : detectionResult.inserted === 0 ? (
                  'Aucun nouveau lead détecté'
                ) : (
                  'Erreur lors de la détection'
                )}
              </span>
              <button onClick={() => setDetectionResult(null)} className="ml-4 rounded p-0.5 opacity-60 hover:opacity-100">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner */}
      {error && !isLoading && (
        <div className="shrink-0 px-4 py-2.5 text-[13px]" style={{ backgroundColor: '#fce4ec', color: '#c62828' }}>
          {error} — Vérifiez les secrets Supabase (HOSTINGER_EMAIL, HOSTINGER_IMAP_PASSWORD)
        </div>
      )}

      {/* 3-column layout */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-[8px] border border-[var(--border-color)] shadow-[var(--shadow-xs)]">
        {/* Column 1: Sidebar folders */}
        <div
          className="flex w-[240px] shrink-0 flex-col border-r"
          style={{
            borderColor: 'var(--border-color)',
            backgroundColor: '#f5f5f7',
          }}
        >
          {/* Compose button */}
          <div className="p-3">
            <button
              onClick={handleCompose}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: 'var(--memovia-violet)' }}
            >
              <Pencil size={14} />
              Nouveau message
            </button>
          </div>

          {/* Folder list */}
          <nav className="flex flex-col gap-0.5 px-2">
            {FOLDERS.map((f) => {
              const Icon = f.icon
              const isActive = folder === f.id
              const count = f.id === 'INBOX' ? unseenCount : 0
              return (
                <button
                  key={f.id}
                  onClick={() => setFolder(f.id)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors"
                  style={{
                    backgroundColor: isActive ? 'var(--memovia-violet)' : 'transparent',
                    color: isActive ? '#fff' : '#1d1d1f',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <Icon size={16} style={{ opacity: isActive ? 1 : 0.6 }} />
                  <span className="flex-1">{f.label}</span>
                  {count > 0 && (
                    <span
                      className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
                      style={{
                        backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : '#86868b',
                        color: isActive ? '#fff' : '#fff',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom actions */}
          <div className="flex flex-col gap-1 border-t p-2" style={{ borderColor: 'var(--border-color)' }}>
            <button
              onClick={() => setShowTemplates(true)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-[#1d1d1f] transition-colors hover:bg-white/60"
            >
              <FileText size={15} style={{ opacity: 0.6 }} />
              Templates
            </button>
            <button
              onClick={handleDetectLeads}
              disabled={isDetecting || isLoading}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-[#1d1d1f] transition-colors hover:bg-white/60 disabled:opacity-50"
            >
              {isDetecting ? (
                <RefreshCw size={15} className="animate-spin" style={{ opacity: 0.6 }} />
              ) : (
                <Zap size={15} style={{ opacity: 0.6 }} />
              )}
              {isDetecting ? 'Analyse…' : 'Détecter leads'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-[#1d1d1f] transition-colors hover:bg-white/60 disabled:opacity-50"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} style={{ opacity: 0.6 }} />
              Actualiser
            </button>
          </div>
        </div>

        {/* Column 2: Email list */}
        <div
          className="flex w-[340px] shrink-0 flex-col border-r"
          style={{ borderColor: 'var(--border-color)', backgroundColor: '#fff' }}
        >
          {/* Search bar */}
          <div className="shrink-0 p-3">
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-[7px]"
              style={{ backgroundColor: '#f5f5f7' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-[13px] text-[#1d1d1f] outline-none placeholder:text-[#86868b]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="rounded-full p-0.5 hover:bg-black/5">
                  <X size={12} style={{ color: '#86868b' }} />
                </button>
              )}
            </div>
          </div>

          {/* Folder header */}
          <div className="flex shrink-0 items-center justify-between px-4 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#86868b' }}>
              {FOLDERS.find((f) => f.id === folder)?.label}
            </span>
            <span className="text-[11px]" style={{ color: '#86868b' }}>
              {isLoading ? '…' : `${total} message${total !== 1 ? 's' : ''}`}
            </span>
          </div>

          {/* Email list */}
          <div className="flex-1 overflow-y-auto">
            <EmailList
              messages={enrichedMessages}
              isLoading={isLoading}
              selectedUid={selectedUid}
              onSelect={handleSelectEmail}
            />
          </div>
        </div>

        {/* Column 3: Reading pane */}
        <div className="flex-1 overflow-hidden" style={{ backgroundColor: '#fff' }}>
          <EmailDetail
            email={emailDetail}
            isLoading={isDetailLoading}
            onReply={handleReply}
          />
        </div>
      </div>

      {/* Compose slide-in overlay */}
      <AnimatePresence>
        {showCompose && (
          <motion.div
            initial={{ y: 420, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 420, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-4 right-6 z-50"
            style={{
              width: '540px',
              height: '420px',
              borderRadius: '12px',
              backgroundColor: '#fff',
              boxShadow: '0 24px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)',
              fontFamily: APPLE_FONT,
              overflow: 'hidden',
            }}
          >
            <EmailCompose
              replyTo={replyTarget}
              initialTemplate={selectedTemplate ? { subject: selectedTemplate.subject, body: selectedTemplate.body } : null}
              isSending={isSending}
              onSend={sendEmail}
              onCancel={handleCancelCompose}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Templates overlay */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowTemplates(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="max-h-[80vh] w-[520px] overflow-hidden rounded-xl bg-white shadow-2xl"
              style={{ fontFamily: APPLE_FONT }}
              onClick={(e) => e.stopPropagation()}
            >
              <EmailTemplates onSelect={handleSelectTemplate} onClose={() => setShowTemplates(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
