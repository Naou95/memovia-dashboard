import { AlertTriangle, X } from 'lucide-react'
import type { EmailAlert } from '@/types/email'

interface EmailAlertsProps {
  alerts: EmailAlert[]
  onSelectEmail: (uid: number) => void
  onDismiss: () => void
}

const KEYWORD_LABELS: Record<string, string> = {
  contrat: 'Contrat',
  devis: 'Devis',
  résiliation: 'Résiliation',
  resiliation: 'Résiliation',
  facturation: 'Facturation',
  urgent: 'Urgent',
}

export function EmailAlerts({ alerts, onSelectEmail, onDismiss }: EmailAlertsProps) {
  if (alerts.length === 0) return null

  return (
    <div
      className="rounded-[8px] border border-[var(--danger)]/20 bg-[var(--danger-bg)] p-4 shadow-[var(--shadow-xs)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}
          >
            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>
              {alerts.length} email{alerts.length > 1 ? 's' : ''} critique
              {alerts.length > 1 ? 's' : ''} non lu{alerts.length > 1 ? 's' : ''} depuis +24h
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {alerts.map((alert) => (
                <button
                  key={alert.uid}
                  onClick={() => onSelectEmail(alert.uid)}
                  className="flex items-center gap-2 text-left hover:underline"
                >
                  <span
                    className="truncate text-xs font-medium"
                    style={{ color: 'var(--text-primary)', maxWidth: '400px' }}
                  >
                    {alert.subject}
                  </span>
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                    — {alert.hoursUnread}h
                  </span>
                  <span className="flex gap-1">
                    {alert.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                        }}
                      >
                        {KEYWORD_LABELS[kw] || kw}
                      </span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5"
          title="Ignorer"
        >
          <X size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
    </div>
  )
}
