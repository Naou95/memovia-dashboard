import { Landmark, AlertTriangle } from 'lucide-react'
import { usePrivacy } from '@/contexts/PrivacyContext'

interface BalanceCardProps {
  balance: number
  fetchedAt: string
  threshold: number | null
  isLoading: boolean
  error: string | null
}

const formatEur = (val: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(val)

export function BalanceCard({
  balance,
  fetchedAt,
  threshold,
  isLoading,
  error,
}: BalanceCardProps) {
  const { isPrivate } = usePrivacy()
  const isAlert = threshold !== null && threshold > 0 && balance < threshold

  return (
    <article className="rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{
              backgroundColor: isAlert
                ? 'var(--trend-down-bg)'
                : 'var(--accent-purple-bg)',
            }}
          >
            <Landmark
              className="h-4 w-4"
              style={{
                color: isAlert
                  ? 'var(--trend-down-text)'
                  : 'var(--accent-purple)',
              }}
              strokeWidth={2.25}
            />
          </div>
          <span className="text-[13px] font-medium text-[var(--text-secondary)]">
            Solde Qonto
          </span>
        </div>

        {isAlert && (
          <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: 'var(--trend-down-bg)',
              color: 'var(--trend-down-text)',
            }}
          >
            <AlertTriangle className="h-3 w-3" />
            Solde bas
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="h-8 w-36 animate-pulse rounded-md bg-[var(--border-color)]" />
      ) : error ? (
        <p className="text-sm text-[var(--text-muted)]">Indisponible</p>
      ) : (
        <>
          <p
            className="text-[26px] font-semibold leading-none tracking-tight tabular-nums"
            style={{ color: isAlert ? 'var(--trend-down-text)' : 'var(--text-primary)' }}
          >
            {isPrivate ? (
              <span className="tracking-widest text-[var(--text-muted)]">••••</span>
            ) : (
              formatEur(balance)
            )}
          </p>
          <p className="mt-3 text-[12px] text-[var(--text-muted)]">
            Mis à jour {new Date(fetchedAt).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {threshold !== null && threshold > 0 && (
              <span className="ml-2">
                · Seuil : {formatEur(threshold)}
              </span>
            )}
          </p>
        </>
      )}
    </article>
  )
}
