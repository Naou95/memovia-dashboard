import { Reply, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EmailMessageDetail } from '@/types/email'

interface EmailDetailProps {
  email: EmailMessageDetail | null
  isLoading: boolean
  onReply: (email: EmailMessageDetail) => void
}

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

export function EmailDetail({ email, isLoading, onReply }: EmailDetailProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--memovia-violet)' }} />
      </div>
    )
  }

  if (!email) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <ExternalLink size={24} style={{ color: 'var(--text-muted)' }} />
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Sélectionnez un email pour le lire
        </p>
      </div>
    )
  }

  const fromLabel = email.from.name
    ? `${email.from.name} <${email.from.address}>`
    : email.from.address

  const toLabel = email.to
    .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
    .join(', ')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 border-b px-6 py-4"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2
              className="text-base font-semibold leading-snug"
              style={{ color: 'var(--text-primary)' }}
            >
              {email.subject}
            </h2>
            <div className="mt-2 space-y-0.5">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="font-medium" style={{ color: 'var(--text-muted)' }}>
                  De :{' '}
                </span>
                {fromLabel}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="font-medium" style={{ color: 'var(--text-muted)' }}>
                  À :{' '}
                </span>
                {toLabel}
              </p>
              {email.cc && email.cc.length > 0 && (
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>
                    Cc :{' '}
                  </span>
                  {email.cc.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(', ')}
                </p>
              )}
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {formatFullDate(email.date)}
              </p>
            </div>
          </div>
          <Button variant="brand" size="sm" onClick={() => onReply(email)}>
            <Reply size={14} className="mr-1.5" />
            Répondre
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {email.html ? (
          <iframe
            srcDoc={email.html}
            className="h-full w-full rounded-lg border-0"
            style={{ minHeight: '400px' }}
            sandbox="allow-same-origin"
            title="Email content"
          />
        ) : (
          <pre
            className="whitespace-pre-wrap text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}
          >
            {email.text || '(Contenu vide)'}
          </pre>
        )}
      </div>
    </div>
  )
}
