import { useState } from 'react'
import { Reply, MoreHorizontal, ChevronDown, Loader2, Mail } from 'lucide-react'
import { motion } from 'framer-motion'
import type { EmailMessageDetail } from '@/types/email'

function formatFullDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTextPreview(email: EmailMessageDetail): string {
  if (email.text) {
    return email.text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('>'))
      .slice(0, 2)
      .join(' ')
      .substring(0, 150)
  }
  return ''
}

function getAvatarColor(address: string): string {
  let hash = 0
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = [
    'var(--memovia-violet)',
    'var(--accent-blue)',
    'var(--success)',
    'var(--warning)',
    'var(--danger)',
    'var(--chart-purple-400)',
    'var(--memovia-violet-hover)',
    'var(--chart-purple-600)',
  ]
  return colors[Math.abs(hash) % colors.length]
}

function getInitial(email: EmailMessageDetail): string {
  const name = email.from.name || email.from.address || '?'
  return name.charAt(0).toUpperCase()
}

/* ---------- Thread card ---------- */

interface ThreadCardProps {
  email: EmailMessageDetail
  isExpanded: boolean
  isSent: boolean
  showDivider: boolean
}

function ThreadCard({ email, isExpanded: defaultExpanded, isSent, showDivider }: ThreadCardProps) {
  const [open, setOpen] = useState(defaultExpanded)
  const preview = getTextPreview(email)
  const fromLabel = email.from.name || email.from.address

  return (
    <div style={{ borderBottom: showDivider ? '1px solid var(--border-subtle)' : 'none' }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-3 px-6 py-3 text-left transition-colors"
        style={{
          transitionDuration: '120ms',
          transitionTimingFunction: 'var(--ease-out)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
            style={{ backgroundColor: getAvatarColor(email.from.address) }}
          >
            {(email.from.name || email.from.address || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                {fromLabel}
              </span>
              {isSent && (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: 'var(--memovia-violet-light)', color: 'var(--memovia-violet)' }}
                >
                  Envoyé
                </span>
              )}
            </div>
            {!open && preview && (
              <p className="mt-0.5 truncate text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {preview}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {formatShortDate(email.date)}
          </span>
          <ChevronDown
            size={13}
            style={{
              color: 'var(--text-muted)',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s var(--ease-out)',
            }}
          />
        </div>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          className="px-6 pb-5"
        >
          <div className="mb-4 space-y-0.5 text-[12px] pl-11" style={{ color: 'var(--text-muted)' }}>
            <p>
              <span className="font-medium">De : </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {email.from.name ? `${email.from.name} <${email.from.address}>` : email.from.address}
              </span>
            </p>
            <p>
              <span className="font-medium">À : </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {email.to.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(', ')}
              </span>
            </p>
            {email.cc && email.cc.length > 0 && (
              <p>
                <span className="font-medium">Cc : </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {email.cc.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(', ')}
                </span>
              </p>
            )}
            <p>{formatFullDate(email.date)}</p>
          </div>
          <div className="pl-11">
            {email.html ? (
              <iframe
                srcDoc={email.html}
                className="w-full rounded-[var(--radius-card)] border-0"
                style={{ minHeight: '220px' }}
                sandbox=""
                title="Email content"
              />
            ) : (
              <pre
                className="whitespace-pre-wrap text-[15px] leading-relaxed"
                style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}
              >
                {email.text || '(Contenu vide)'}
              </pre>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}

/* ---------- Main detail ---------- */

interface EmailDetailProps {
  email: EmailMessageDetail | null
  isLoading: boolean
  onReply: (email: EmailMessageDetail) => void
}

export function EmailDetail({ email, isLoading, onReply }: EmailDetailProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  if (!email) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <Mail size={28} style={{ color: 'var(--text-muted)' }} />
        </div>
        <p className="text-[15px] font-medium" style={{ color: 'var(--text-muted)' }}>
          Aucun email sélectionné
        </p>
        <p className="text-[13px]" style={{ color: 'var(--text-label)' }}>
          Choisissez un message pour le lire
        </p>
      </div>
    )
  }

  const thread = email.thread
  const hasThread = thread && thread.length > 1

  return (
    <motion.div
      key={email.uid}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
      className="flex h-full flex-col overflow-hidden"
    >
      {/* Header */}
      <div
        className="shrink-0 px-6 py-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
              style={{ backgroundColor: getAvatarColor(email.from.address) }}
            >
              {getInitial(email)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                {email.subject}
              </h2>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  {email.from.name || email.from.address}
                </span>
                <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  &lt;{email.from.address}&gt;
                </span>
              </div>
              {!hasThread && (
                <p className="mt-0.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  {formatFullDate(email.date)}
                </p>
              )}
              {hasThread && (
                <p className="mt-0.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  {thread.length} messages dans ce fil
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onReply(email)}
              className="flex items-center gap-1.5 rounded-[var(--radius-card)] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: 'var(--memovia-violet)' }}
            >
              <Reply size={14} />
              Répondre
            </button>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-card)] transition-colors hover:bg-[var(--bg-hover)]"
              aria-label="Plus d'options"
            >
              <MoreHorizontal size={16} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {hasThread ? (
          <div className="flex flex-col">
            {thread.map((item, index) => (
              <ThreadCard
                key={`${item.folder}-${item.uid}`}
                email={item}
                isExpanded={index === thread.length - 1}
                isSent={item.folder === 'Sent'}
                showDivider={index < thread.length - 1}
              />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05, ease: [0.25, 1, 0.5, 1] }}
            className="px-6 py-5"
          >
            {email.html ? (
              <iframe
                srcDoc={email.html}
                className="h-full w-full rounded-[var(--radius-card)] border-0"
                style={{ minHeight: '400px' }}
                sandbox=""
                title="Email content"
              />
            ) : (
              <pre
                className="whitespace-pre-wrap text-[15px] leading-relaxed"
                style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}
              >
                {email.text || '(Contenu vide)'}
              </pre>
            )}
          </motion.div>
        )}
      </div>

      {/* Quick reply footer */}
      <div
        className="shrink-0 px-6 py-3"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <button
          onClick={() => onReply(email)}
          className="w-full rounded-[var(--radius-card)] px-4 py-2.5 text-left text-[13px] transition-colors"
          style={{
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-muted)',
            transitionDuration: '120ms',
            transitionTimingFunction: 'var(--ease-out)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-primary)' }}
        >
          Répondre à {email.from.name || email.from.address}…
        </button>
      </div>
    </motion.div>
  )
}
