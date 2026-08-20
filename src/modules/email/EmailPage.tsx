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

/**
 * Mail (refonte design du 20/08/2026, modèle Dribbble Holesinsky) :
 * rail d'icônes · recherche + Compose sombre · liste pleine largeur une ligne
 * par mail · lecture en panneau latéral. Toute la mécanique (IMAP, templates,
 * Détecter leads, compose) est inchangée.
 */
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

  const handleCloseDetail = () => {
    setSelectedUid(null)
    setEmailDetail(null)
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

  const railButtonBase =
    'flex h-10 w-10 items-center justify-center rounded-xl transition-colors'

  return (
    <div className="flex gap-3 md:gap-4" style={{ height: 'calc(100vh - 64px - 40px)' }}>
      {/* ── Rail d'icônes (dossiers + actions) ─────────────────────────────── */}
      <div
        className="flex w-14 shrink-0 flex-col items-center justify-between rounded-2xl border py-3"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)', boxShadow: 'var(--shadow-xs)' }}
      >
        <nav className="flex flex-col items-center gap-1" aria-label="Dossiers mail">
          {FOLDERS.map((f) => {
            const Icon = f.icon
            const isActive = folder === f.id
            const count = f.id === 'INBOX' ? unseenCount : 0
            return (
              <button
                key={f.id}
                onClick={() => setFolder(f.id)}
                title={f.label}
                aria-label={f.label}
                aria-current={isActive ? 'true' : undefined}
                className={railButtonBase}
                style={{
                  backgroundColor: isActive ? 'var(--memovia-violet-light)' : 'transparent',
                  color: isActive ? 'var(--memovia-violet)' : 'var(--text-muted)',
                  position: 'relative',
                }}
              >
                <Icon size={17} />
                {count > 0 && (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                    style={{ backgroundColor: 'var(--memovia-violet)' }}
                  >
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setShowTemplates(true)}
            title="Templates"
            aria-label="Templates"
            className={railButtonBase}
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <FileText size={17} />
          </button>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            title="Actualiser"
            aria-label="Actualiser"
            className={`${railButtonBase} disabled:opacity-40`}
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <RefreshCw size={17} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Panneau principal ──────────────────────────────────────────────── */}
      <div
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)', boxShadow: 'var(--shadow-xs)' }}
      >
        {/* Barre du haut : recherche + actions */}
        <div className="flex shrink-0 items-center gap-2 border-b p-3 md:gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2"
            style={{ backgroundColor: 'var(--bg-primary)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher un email, un expéditeur…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="rounded-full p-0.5 transition-colors hover:bg-[var(--bg-hover)]">
                <X size={12} style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>

          <button
            onClick={handleDetectLeads}
            disabled={isDetecting || isLoading}
            className="hidden shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 sm:flex"
            style={{ backgroundColor: 'var(--memovia-violet-light)', color: 'var(--memovia-violet)' }}
          >
            {isDetecting ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
            {isDetecting ? 'Analyse…' : 'Détecter leads'}
          </button>

          <button
            onClick={handleCompose}
            className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-transform active:scale-[0.97]"
            style={{ backgroundColor: 'var(--text-primary)' }}
          >
            <Pencil size={14} />
            <span className="hidden sm:inline">Nouveau message</span>
            <span className="sm:hidden">Écrire</span>
          </button>
        </div>

        {/* Bandeau résultat détection */}
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
                className="flex items-center justify-between px-5 py-2.5 text-[13px]"
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
                      <a href="/leads" className="font-medium underline">Voir dans Leads</a>
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

        {/* Bandeau erreur */}
        {error && !isLoading && (
          <div
            className="shrink-0 px-5 py-2.5 text-[13px]"
            style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}
          >
            {error} — Vérifiez les secrets Supabase (HOSTINGER_EMAIL, HOSTINGER_IMAP_PASSWORD)
          </div>
        )}

        {/* En-tête de section */}
        <div className="flex shrink-0 items-center gap-2 px-5 pb-1 pt-4">
          <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {FOLDERS.find((f) => f.id === folder)?.label}
          </span>
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {isLoading ? '…' : total}
          </span>
        </div>

        {/* Liste pleine largeur */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmailList
            messages={enrichedMessages}
            isLoading={isLoading}
            selectedUid={selectedUid}
            onSelect={handleSelectEmail}
          />
        </div>

        {/* Panneau de lecture — glisse par-dessus la liste */}
        <AnimatePresence>
          {selectedUid !== null && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0, transition: { type: 'spring', damping: 30, stiffness: 320 } }}
              exit={{ x: '100%', transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] } }}
              className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l md:w-[min(640px,80%)]"
              style={{
                borderColor: 'var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                boxShadow: '-16px 0 48px rgba(0,0,0,0.08)',
              }}
            >
              <button
                onClick={handleCloseDetail}
                aria-label="Fermer la lecture"
                className="absolute right-3 top-3 z-30 flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
              <div className="min-h-0 flex-1 overflow-hidden">
                <EmailDetail
                  email={emailDetail}
                  isLoading={isDetailLoading}
                  onReply={handleReply}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
              width: 'min(540px, calc(100vw - 24px))',
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
