import { useState, useEffect } from 'react'
import { RefreshCw, Pencil, Inbox, Zap, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { useEmail } from '@/hooks/useEmail'
import { EmailAlerts } from './components/EmailAlerts'
import { EmailList } from './components/EmailList'
import { EmailDetail } from './components/EmailDetail'
import { EmailCompose } from './components/EmailCompose'
import type { EmailMessageDetail } from '@/types/email'
import { supabase } from '@/lib/supabase'

type RightPanelMode = 'detail' | 'compose'

const FOLDERS = [
  { id: 'INBOX', label: 'Boîte de réception' },
  { id: 'Sent', label: 'Envoyés' },
  { id: 'Spam', label: 'Spam' },
  { id: 'Trash', label: 'Corbeille' },
]

export default function EmailPage() {
  const { messages, alerts, total, isLoading, isSending, error, loadEmails, getEmail, sendEmail, invalidateCache } =
    useEmail()

  const [folder, setFolder] = useState('INBOX')
  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const [emailDetail, setEmailDetail] = useState<EmailMessageDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [mode, setMode] = useState<RightPanelMode>('detail')
  const [replyTarget, setReplyTarget] = useState<EmailMessageDetail | null>(null)
  const [dismissedAlerts, setDismissedAlerts] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectionResult, setDetectionResult] = useState<{ inserted: number } | null>(null)

  useEffect(() => {
    loadEmails(folder, 1)
    setSelectedUid(null)
    setEmailDetail(null)
    setMode('detail')
  }, [folder, loadEmails])

  const handleSelectEmail = async (uid: number) => {
    setSelectedUid(uid)
    setMode('detail')
    setIsDetailLoading(true)
    const detail = await getEmail(uid, folder)
    setEmailDetail(detail)
    setIsDetailLoading(false)
  }

  const handleAlertSelect = (uid: number) => {
    setDismissedAlerts(false)
    handleSelectEmail(uid)
  }

  const handleCompose = () => {
    setReplyTarget(null)
    setMode('compose')
  }

  const handleReply = (email: EmailMessageDetail) => {
    setReplyTarget(email)
    setMode('compose')
  }

  const handleCancelCompose = () => {
    setMode('detail')
    setReplyTarget(null)
  }

  const handleDetectLeads = async () => {
    setIsDetecting(true)
    setDetectionResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('email-lead-detector', { body: {} })
      if (error) throw error
      setDetectionResult({ inserted: data?.inserted ?? 0 })
    } catch (err) {
      console.error('Lead detection failed:', err)
      setDetectionResult({ inserted: -1 })
    } finally {
      setIsDetecting(false)
    }
  }

  const handleRefresh = () => {
    invalidateCache()
    loadEmails(folder, 1)
    setDismissedAlerts(false)
  }

  const unseenCount = messages.filter((m) => !m.seen).length

  return (
    <motion.div className="flex h-full flex-col gap-4" style={{ overflow: 'hidden' }} variants={staggerContainer} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={staggerItem} className="flex shrink-0 items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Email Hostinger
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {isLoading ? 'Chargement…' : `${total} message${total !== 1 ? 's' : ''}${unseenCount > 0 ? ` · ${unseenCount} non lu${unseenCount !== 1 ? 's' : ''}` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Rafraîchir les emails"
          >
            <RefreshCw
              size={16}
              style={{ color: 'var(--text-muted)' }}
              className={isLoading ? 'animate-spin' : ''}
            />
          </button>
          <Button variant="outline" size="sm" onClick={handleDetectLeads} disabled={isDetecting || isLoading}>
            {isDetecting ? (
              <RefreshCw size={14} className="mr-1.5 animate-spin" />
            ) : (
              <Zap size={14} className="mr-1.5" />
            )}
            {isDetecting ? 'Analyse en cours…' : 'Détecter les leads'}
          </Button>
          <Button variant="brand" size="sm" onClick={handleCompose}>
            <Pencil size={14} className="mr-1.5" />
            Nouveau
          </Button>
        </div>
      </motion.div>

      {/* Alerts */}
      {!dismissedAlerts && alerts.length > 0 && (
        <motion.div variants={staggerItem} className="shrink-0">
          <EmailAlerts
            alerts={alerts}
            onSelectEmail={handleAlertSelect}
            onDismiss={() => setDismissedAlerts(true)}
          />
        </motion.div>
      )}

      {/* Detection result */}
      {detectionResult !== null && (
        <motion.div
          variants={staggerItem}
          className="shrink-0 flex items-center justify-between rounded-[8px] border px-4 py-3 text-sm shadow-[var(--shadow-xs)]"
          style={
            detectionResult.inserted > 0
              ? { backgroundColor: 'var(--success-bg)', borderColor: 'color-mix(in oklab, var(--success) 25%, transparent)', color: 'var(--success)' }
              : detectionResult.inserted === 0
              ? { backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }
              : { backgroundColor: 'var(--danger-bg)', borderColor: 'color-mix(in oklab, var(--danger) 25%, transparent)', color: 'var(--danger)' }
          }
        >
          <span>
            {detectionResult.inserted > 0 ? (
              <>
                {detectionResult.inserted} nouveau{detectionResult.inserted !== 1 ? 'x' : ''} lead{detectionResult.inserted !== 1 ? 's' : ''} détecté{detectionResult.inserted !== 1 ? 's' : ''}{' '}
                <a href="/prospection" className="underline font-medium">Voir dans Prospection →</a>
              </>
            ) : detectionResult.inserted === 0 ? (
              'Aucun nouveau lead détecté'
            ) : (
              'Erreur lors de la détection'
            )}
          </span>
          <button
            onClick={() => setDetectionResult(null)}
            className="ml-4 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none"
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <motion.div
          variants={staggerItem}
          role="alert"
          className="shrink-0 rounded-[8px] border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          {error} — Vérifiez les secrets Supabase (HOSTINGER_EMAIL, HOSTINGER_IMAP_PASSWORD)
        </motion.div>
      )}

      {/* Main panel */}
      <motion.div
        variants={staggerItem}
        className="flex min-h-0 flex-1 overflow-hidden rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[var(--shadow-xs)]"
      >
        {/* Left: folder + list */}
        <div
          className="flex w-80 shrink-0 flex-col border-r"
          style={{ borderColor: 'var(--border-color)' }}
        >
          {/* Folder tabs */}
          <div
            className="flex shrink-0 gap-1 border-b px-3 py-2"
            style={{ borderColor: 'var(--border-color)' }}
          >
            {FOLDERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFolder(f.id)}
                aria-pressed={folder === f.id}
                aria-label={`Dossier ${f.label}`}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-1"
                style={
                  folder === f.id
                    ? {
                        backgroundColor: 'var(--memovia-violet-light)',
                        color: 'var(--memovia-violet)',
                      }
                    : {
                        color: 'var(--text-muted)',
                      }
                }
              >
                {f.id === 'INBOX' && <Inbox size={12} />}
                {f.label === 'Boîte de réception' ? 'Inbox' : f.label}
              </button>
            ))}
          </div>

          {/* Email list */}
          <div className="flex-1 overflow-y-auto">
            <EmailList
              messages={messages}
              isLoading={isLoading}
              selectedUid={selectedUid}
              onSelect={handleSelectEmail}
            />
          </div>
        </div>

        {/* Right: detail or compose */}
        <div className="flex-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
          {mode === 'compose' ? (
            <EmailCompose
              replyTo={replyTarget}
              isSending={isSending}
              onSend={sendEmail}
              onCancel={handleCancelCompose}
            />
          ) : (
            <EmailDetail
              email={emailDetail}
              isLoading={isDetailLoading}
              onReply={handleReply}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
