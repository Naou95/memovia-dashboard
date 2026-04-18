import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useQontoFinance, invalidateQontoFinanceCache } from '@/hooks/useQontoFinance'
import { BalanceCard } from './components/BalanceCard'
import { AlertThresholdConfig } from './components/AlertThresholdConfig'
import { CashFlowChart } from './components/CashFlowChart'
import { TransactionTable } from './components/TransactionTable'
import { supabase } from '@/lib/supabase'

const SETTINGS_KEY = 'qonto_alert_threshold'

export default function QontoPage() {
  const { data, isLoading, error } = useQontoFinance()
  const [threshold, setThreshold] = useState<number | null>(null)

  // Charger le seuil au montage
  useEffect(() => {
    // Cast requis : types mis à jour manuellement, pas via supabase gen types.
    const query = supabase
      .from('dashboard_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle() as unknown as Promise<{ data: { value: string } | null; error: unknown }>

    query.then(({ data: row }) => {
      if (row?.value) {
        const parsed = parseFloat(row.value)
        if (!isNaN(parsed)) setThreshold(parsed)
      }
    })
  }, [])

  function handleRefresh() {
    invalidateQontoFinanceCache()
    window.location.reload()
  }

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      {/* Header */}
      <motion.header variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tighter text-[var(--text-primary)]">
            Qonto Trésorerie
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Solde, flux et transactions bancaires.
            {data?.fetchedAt && (
              <span className="ml-2 text-[var(--text-muted)]">
                Mis à jour{' '}
                {new Date(data.fetchedAt).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent-purple-bg)] hover:text-[var(--memovia-violet)]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Rafraîchir
        </button>
      </motion.header>

      {/* Erreur globale */}
      {error && !isLoading && (
        <motion.div variants={staggerItem} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </motion.div>
      )}

      {/* Top row : Solde + Alerte */}
      <motion.div variants={staggerItem} className="grid gap-5 sm:grid-cols-2">
        <BalanceCard
          balance={data?.balance ?? 0}
          fetchedAt={data?.fetchedAt ?? new Date().toISOString()}
          threshold={threshold}
          isLoading={isLoading}
          error={error}
        />
        <AlertThresholdConfig
          onSaved={(val) => setThreshold(val)}
        />
      </motion.div>

      {/* Graphique trésorerie */}
      <motion.section variants={staggerItem} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Trésorerie mensuelle
          </h3>
          <span className="text-[13px] text-[var(--text-muted)]">6 derniers mois</span>
        </div>

        {isLoading ? (
          <div className="h-[260px] skeleton rounded-xl" />
        ) : (
          <CashFlowChart data={data?.monthlyCashFlow ?? []} />
        )}
      </motion.section>

      {/* Transactions */}
      <motion.section variants={staggerItem} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
        <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">
          Transactions
        </h3>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 flex-1 skeleton rounded" />
                <div className="h-4 w-1/4 skeleton rounded" />
                <div className="h-4 w-1/6 skeleton rounded" />
              </div>
            ))}
          </div>
        ) : (
          <TransactionTable transactions={data?.transactions ?? []} />
        )}
      </motion.section>
    </motion.div>
  )
}
