import { useState } from 'react'
import { cn } from '@/lib/utils'
import StripePage from '@/modules/stripe/StripePage'
import QontoPage from '@/modules/qonto/QontoPage'

/**
 * Argent — vue provisoire de la refonte v2 (Phase 0).
 * Bascule Stripe / Qonto sur les pages existantes ; la Phase 4 (REFONT_PLAN.md)
 * les fusionne en un seul écran : solde, runway, MRR, mouvements avec deltas.
 */
export default function ArgentPage() {
  const [tab, setTab] = useState<'stripe' | 'qonto'>('stripe')

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-0.5" role="tablist">
        {(['stripe', 'qonto'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-md px-4 py-1.5 text-[13px] font-medium capitalize transition-colors',
              tab === t
                ? 'bg-[var(--memovia-violet-light)] text-[var(--memovia-violet)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'stripe' ? <StripePage /> : <QontoPage />}
    </div>
  )
}
