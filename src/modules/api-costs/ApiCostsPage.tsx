import { RefreshCw, DollarSign, Brain, Mic, AlertCircle, ExternalLink, TriangleAlert } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem, cardGridContainer, staggerCard } from '@/lib/motion'
import { useApiCosts, invalidateApiCostsCache } from '@/hooks/useApiCosts'
import { KpiCard } from '@/components/shared/KpiCard'
import { DailyCostChart } from './components/DailyCostChart'
import { PricingReference } from './components/PricingReference'
import type { ProviderSummary, CostSource } from '@/types/api-costs'

// ── Formatters ─────────────────────────────────────────────────────────────────

const formatUsd = (val: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(val)

// ── Source badge ───────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<CostSource, { label: string; color: string; bg: string } | null> = {
  db:          { label: 'Données partielles', color: '#b45309', bg: 'color-mix(in oklab, #f59e0b 15%, white)' },
  api:         { label: 'API directe',        color: 'var(--memovia-cyan)', bg: 'color-mix(in oklab, var(--memovia-cyan) 15%, white)' },
  unavailable: null,
}

function SourceBadge({ source }: { source: CostSource }) {
  const meta = SOURCE_LABELS[source]
  if (!meta) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
      style={{ color: meta.color, backgroundColor: meta.bg }}
    >
      {source === 'db' && <TriangleAlert className="h-2.5 w-2.5" />}
      {meta.label}
    </span>
  )
}

// ── Provider config ────────────────────────────────────────────────────────────

const PROVIDER_META = {
  openai: { icon: Brain, accent: 'violet', label: 'OpenAI ce mois' } as const,
  gemini: { icon: Brain, accent: 'blue',   label: 'Gemini ce mois' } as const,
  gladia: { icon: Mic,   accent: 'cyan',   label: 'Gladia ce mois' } as const,
}

// ── Partial data banner (OpenAI + Gemini from DB only) ────────────────────────

interface PartialDataBannerProps {
  openaiCount: number | undefined
  geminiCount: number | undefined
}

function PartialDataBanner({ openaiCount, geminiCount }: PartialDataBannerProps) {
  const parts: string[] = []
  if (openaiCount !== undefined) parts.push(`${openaiCount} appel${openaiCount > 1 ? 's' : ''} OpenAI`)
  if (geminiCount !== undefined) parts.push(`${geminiCount} appel${geminiCount > 1 ? 's' : ''} Gemini`)

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="flex-1 text-[12px] text-amber-800">
        <span className="font-semibold">Données partielles</span>
        {' — '}La table <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">api_costs</code> ne capture pas tous les appels API.
        {parts.length > 0 && (
          <span className="ml-1 text-amber-700">{parts.join(' · ')} loggés ce mois.</span>
        )}
        <span className="ml-1">Pour les chiffres exacts :</span>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <a
          href="https://platform.openai.com/usage"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:underline"
        >
          Dashboard OpenAI <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href="https://aistudio.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:underline"
        >
          Google AI Studio <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}

// ── Gladia unavailable banner ──────────────────────────────────────────────────

function GladiaUnavailableBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
      <div className="flex-1 text-[12px] text-[var(--text-secondary)]">
        <span className="font-medium text-[var(--text-primary)]">Gladia — données indisponibles. </span>
        Clé API manquante ou endpoint usage non accessible.
      </div>
      <a
        href="https://app.gladia.io/billing"
        target="_blank"
        rel="noopener noreferrer"
        className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-[var(--memovia-violet)] hover:underline"
      >
        Consulter <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}

// ── Provider KPI card + source badge ──────────────────────────────────────────

interface ProviderCardProps {
  id: 'openai' | 'gemini' | 'gladia'
  provider: ProviderSummary | undefined
  isLoading: boolean
  error: string | null
}

function ProviderCard({ id, provider, isLoading, error }: ProviderCardProps) {
  const meta = PROVIDER_META[id]
  const value = provider
    ? provider.available
      ? formatUsd(provider.monthTotal)
      : 'N/A'
    : null

  return (
    <div className="flex flex-col gap-1.5">
      <KpiCard
        label={meta.label}
        value={value}
        accent={meta.accent}
        icon={meta.icon}
        isLoading={isLoading}
        error={provider?.available === false && !isLoading ? null : error}
      />
      {!isLoading && provider && (
        <div className="flex items-center gap-2 px-1">
          <SourceBadge source={provider.source} />
          {provider.callCount !== undefined && provider.callCount > 0 && (
            <span className="text-[10px] text-[var(--text-muted)]">
              {provider.callCount} transcription{provider.callCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ApiCostsPage() {
  const { data, isLoading, error } = useApiCosts()

  function handleRefresh() {
    invalidateApiCostsCache()
    window.location.reload()
  }

  const providers = data?.providers ?? []
  const gladiaProvider = providers.find((p) => p.id === 'gladia')
  const openaiProvider = providers.find((p) => p.id === 'openai')
  const geminiProvider = providers.find((p) => p.id === 'gemini')
  const showGladia = (gladiaProvider?.monthTotal ?? 0) > 0
  const gladiaUnavailable = !isLoading && gladiaProvider && gladiaProvider.source === 'unavailable'
  const showPartialBanner = !isLoading && data && (
    openaiProvider?.source === 'db' || geminiProvider?.source === 'db'
  )

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      {/* Header */}
      <motion.header variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tighter text-[var(--text-primary)]">
            Coûts API
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Dépenses OpenAI, Gemini et Gladia pour app.memovia.io.
            {data?.fetchedAt && (
              <span className="ml-2 text-[var(--text-muted)]">
                Mis à jour à{' '}
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

      {/* Global error */}
      {error && (
        <motion.div variants={staggerItem} className="rounded-xl border border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_8%,white)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </motion.div>
      )}

      {/* KPI cards */}
      <motion.div variants={cardGridContainer} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total */}
        <motion.div variants={staggerCard} className="flex flex-col gap-1.5">
          <KpiCard
            label="Total ce mois"
            value={data ? formatUsd(data.totalMonth) : null}
            accent="violet"
            icon={DollarSign}
            isLoading={isLoading}
            error={error}
          />
          {!isLoading && data && (
            <div className="px-1 text-[10px] text-[var(--text-muted)]">
              {data.period.start} → {data.period.end}
            </div>
          )}
        </motion.div>

        {/* Per provider */}
        {(['openai', 'gemini', 'gladia'] as const).map((id) => (
          <motion.div key={id} variants={staggerCard}>
            <ProviderCard
              id={id}
              provider={providers.find((p) => p.id === id)}
              isLoading={isLoading}
              error={error}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Partial data banner (OpenAI + Gemini from DB only) */}
      {showPartialBanner && (
        <motion.div variants={staggerItem}>
          <PartialDataBanner
            openaiCount={openaiProvider?.callCount}
            geminiCount={geminiProvider?.callCount}
          />
        </motion.div>
      )}

      {/* Gladia unavailable banner */}
      {gladiaUnavailable && (
        <motion.div variants={staggerItem}>
          <GladiaUnavailableBanner />
        </motion.div>
      )}

      {/* Daily cost chart */}
      <motion.section variants={staggerItem} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Coût par jour</h3>
            {data?.period && (
              <p className="text-[12px] text-[var(--text-muted)]">
                {data.period.start} → {data.period.end}
              </p>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="h-[220px] skeleton rounded-xl" />
        ) : data ? (
          <DailyCostChart data={data.dailyCosts} showGladia={showGladia} />
        ) : (
          <div className="flex h-[220px] items-center justify-center text-sm text-[var(--text-muted)]">
            Données indisponibles
          </div>
        )}
      </motion.section>

      {/* Pricing reference */}
      <motion.div variants={staggerItem}>
        <PricingReference />
      </motion.div>
    </motion.div>
  )
}
