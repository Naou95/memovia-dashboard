import { useState, useEffect } from 'react'
import { RefreshCw, Zap, X, FileText, Pencil, Inbox, Send as SendIcon, Trash2, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEmail } from '@/hooks/useEmail'
import { EmailList } from './components/EmailList'
import { EmailDetail } from './components/EmailDetail'
import { EmailCompose } from './components/EmailCompose'
import { EmailTemplates, type EmailTemplate } from './components/EmailTemplates'
import type { EmailMessageDetail } from '@/types/email'
import { supabase } from '@/lib/supabase'

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
  const { messages, total, isLoading, isSending, error, loadEmails, getEmail, sendEmail, invalidateCache } =
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

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => {
        const q = searchQuery.toLowerCase()
        const sender = (m.from.name || m.from.address).toLowerCase()
        return sender.includes(q) || m.subject.toLowerCase().includes(q)
      })
    : messages

  const enrichedMessages = filteredMessages.map((m) => ({
    ...m,
    isUrgent: !m.seen && hasUrgentKeyword(m.subject),
  }))

  return (
    <div className="flex h-full flex-col" style={{ overflow: 'hidden' }}>
      {/* Detection result banner */}
      <AnimatePresence>
        {detectionResult !== null && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
            className="shrink-0 overflow-hidden"
          >
            <div
              className="flex items-center justify-between px-4 py-2.5 text-[13px]"
              style={
                detectionResult.inserted > 0
                  ? { backgroundColor: 'var(--success-bg)', color: 'var(--success)' }
                  : detectionResult.inserted === 0
                  ? { backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }
                  : { backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }
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
              <button onClick={() => setDetectionResult(null)} className="ml-4 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner */}
      {error && !isLoading && (
        <div
          className="shrink-0 px-4 py-2.5 text-[13px]"
          style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}
        >
          {error} — Vérifiez les secrets Supabase (HOSTINGER_EMAIL, HOSTINGER_IMAP_PASSWORD)
        </div>
      )}

      {/* 3-column layout */}
      <div
        className="flex min-h-0 flex-1 overflow-hidden rounded-[var(--radius-card)] border shadow-[var(--shadow-xs)]"
        style={{ borderColor: 'var(--border-color)' }}
      >
        {/* Column 1: Sidebar folders */}
        <div
          className="flex w-[240px] shrink-0 flex-col border-r"
          style={{
            borderColor: 'var(--border-color)',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          {/* Compose button */}
          <div className="p-3">
            <button
              onClick={handleCompose}
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] px-4 py-2 text-[13px] font-semibold text-white active:scale-[0.97]"
              style={{
                backgroundColor: 'var(--memovia-violet)',
                transition: 'transform 160ms var(--ease-out), background-color 120ms var(--ease-out)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--memovia-violet-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--memovia-violet)' }}
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
                  className="flex items-center gap-3 rounded-[var(--radius-card)] px-3 py-2 text-left text-[13px] transition-colors"
                  style={{
                    backgroundColor: isActive ? 'var(--memovia-violet)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text-primary)',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <Icon size={16} style={{ opacity: isActive ? 1 : 0.5 }} />
                  <span className="flex-1">{f.label}</span>
                  {count > 0 && (
                    <span
                      className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-white"
                      style={{
                        backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : 'var(--text-muted)',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="flex-1" />

          {/* Bottom actions */}
          <div className="flex flex-col gap-0.5 border-t p-2" style={{ borderColor: 'var(--border-color)' }}>
            <button
              onClick={() => setShowTemplates(true)}
              className="flex items-center gap-2.5 rounded-[var(--radius-card)] px-3 py-2 text-[13px] transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <FileText size={15} style={{ opacity: 0.5 }} />
              Templates
            </button>
            <button
              onClick={handleDetectLeads}
              disabled={isDetecting || isLoading}
              className="flex items-center gap-2.5 rounded-[var(--radius-card)] px-3 py-2 text-[13px] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:pointer-events-none"
              style={{ color: 'var(--text-secondary)' }}
            >
              {isDetecting ? (
                <RefreshCw size={15} className="animate-spin" style={{ opacity: 0.5 }} />
              ) : (
                <Zap size={15} style={{ opacity: 0.5 }} />
              )}
              {isDetecting ? 'Analyse…' : 'Détecter leads'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2.5 rounded-[var(--radius-card)] px-3 py-2 text-[13px] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:pointer-events-none"
              style={{ color: 'var(--text-secondary)' }}
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} style={{ opacity: 0.5 }} />
              Actualiser
            </button>
          </div>
        </div>

        {/* Column 2: Email list */}
        <div
          className="flex w-[340px] shrink-0 flex-col border-r"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
        >
          {/* Search bar */}
          <div className="shrink-0 p-3">
            <div
              className="flex items-center gap-2 rounded-[var(--radius-card)] px-3 py-[7px]"
              style={{ backgroundColor: 'var(--bg-primary)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-[13px] outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="rounded-full p-0.5 transition-colors hover:bg-[var(--bg-hover)]">
                  <X size={12} style={{ color: 'var(--text-muted)' }} />
                </button>
              )}
            </div>
          </div>

          {/* Folder header */}
          <div className="flex shrink-0 items-center justify-between px-4 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {FOLDERS.find((f) => f.id === folder)?.label}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
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
        <div className="flex-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
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
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { type: 'spring', damping: 28, stiffness: 300 } }}
            exit={{ y: '100%', opacity: 0, transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] } }}
            className="fixed z-50 overflow-hidden"
            style={{
              bottom: '12px',
              right: '80px',
              width: '540px',
              height: '420px',
              borderRadius: 'var(--radius-card)',
              backgroundColor: 'var(--bg-secondary)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.06)',
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
            style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
            onClick={() => setShowTemplates(false)}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              className="max-h-[80vh] w-[520px] overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-sm)]"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
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
