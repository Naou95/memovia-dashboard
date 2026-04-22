import { useState } from 'react'
import { Search, Globe, ExternalLink, TrendingUp, Link2, Loader2, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type {
  KeywordResearchResult,
  CompetitorAnalysisResult,
  BacklinksResult,
} from '@/types/seo'

type SubTab = 'keywords' | 'competitors' | 'geo' | 'backlinks'

interface StrategyTabProps {
  onKeywordSelect: (keyword: string) => void
}

// ── Cache in-memory pour éviter les appels DataForSEO répétés ─────────────────
const kwCache = new Map<string, KeywordResearchResult>()
const competitorCache = new Map<string, CompetitorAnalysisResult>()
const backlinksCache = new Map<string, BacklinksResult>()

export function StrategyTab({ onKeywordSelect }: StrategyTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('keywords')

  const subTabs: { id: SubTab; label: string }[] = [
    { id: 'keywords', label: 'Keyword Research' },
    { id: 'competitors', label: 'Concurrents' },
    { id: 'geo', label: 'Score GEO' },
    { id: 'backlinks', label: 'Backlinks' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tabs */}
      <div
        className="flex gap-1 rounded-lg border p-1"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
      >
        {subTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id)}
            aria-pressed={activeSubTab === t.id}
            className="flex flex-1 items-center justify-center rounded-lg py-1.5 text-[12px] font-medium transition-colors"
            style={{
              backgroundColor: activeSubTab === t.id ? 'var(--memovia-violet-light)' : 'transparent',
              color: activeSubTab === t.id ? 'var(--memovia-violet)' : 'var(--text-muted)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'keywords' && <KeywordResearchPanel onUseKeyword={onKeywordSelect} />}
      {activeSubTab === 'competitors' && <CompetitorPanel />}
      {activeSubTab === 'geo' && <GeoExplainerPanel />}
      {activeSubTab === 'backlinks' && <BacklinksPanel />}
    </div>
  )
}

// ── Keyword Research ──────────────────────────────────────────────────────────

function KeywordResearchPanel({ onUseKeyword }: { onUseKeyword: (kw: string) => void }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<KeywordResearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    const kw = query.trim()
    if (!kw) return
    if (kwCache.has(kw)) { setResult(kwCache.get(kw)!); return }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.functions.invoke<KeywordResearchResult>(
      'seo-keyword-research',
      { body: { keyword: kw } },
    )
    setLoading(false)
    if (err || !data) { setError("Erreur lors de la recherche. Vérifiez les secrets DataForSEO."); return }
    kwCache.set(kw, data)
    setResult(data)
  }

  const kdColor = (kd: number) =>
    kd >= 70 ? '#dc2626' : kd >= 40 ? '#d97706' : '#16a34a'

  const competitionLabel = (lvl: string | null) => {
    if (lvl === 'LOW') return { label: 'Faible', color: '#16a34a' }
    if (lvl === 'HIGH') return { label: 'Élevée', color: '#dc2626' }
    return { label: 'Moyenne', color: '#d97706' }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Ex : logiciel CFA, gestion formation…"
          className="h-9 flex-1 rounded-lg border bg-transparent px-3 text-[13px] outline-none transition-colors focus:border-[var(--memovia-violet)]"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        />
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--memovia-violet)' }}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Rechercher
        </button>
      </div>

      {error && (
        <p className="rounded-lg border px-4 py-3 text-[12px]" style={{ borderColor: '#fca5a5', backgroundColor: '#fef2f2', color: '#991b1b' }}>
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          {/* Main metrics */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="Volume mensuel" value={result.search_volume.toLocaleString('fr-FR')} unit="rech." />
            <MetricCard label="Difficulté KD" value={String(result.keyword_difficulty)} unit="/100" valueColor={kdColor(result.keyword_difficulty)} />
            <MetricCard label="CPC estimé" value={result.cpc != null ? `${result.cpc.toFixed(2)} €` : '—'} />
          </div>

          {/* Competition */}
          {result.competition_level && (
            <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              <TrendingUp className="h-3.5 w-3.5" />
              Compétition Google Ads :{' '}
              <span className="font-medium" style={{ color: competitionLabel(result.competition_level).color }}>
                {competitionLabel(result.competition_level).label}
              </span>
            </div>
          )}

          {/* Trend sparkline */}
          {result.trend.length > 0 && (
            <TrendChart trend={result.trend} />
          )}

          {/* Use keyword button */}
          <button
            onClick={() => onUseKeyword(result.keyword)}
            className="flex items-center gap-1.5 self-start rounded-lg px-3 py-2 text-[12px] font-medium"
            style={{ backgroundColor: 'var(--memovia-violet-light)', color: 'var(--memovia-violet)' }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
            Générer un article avec "{result.keyword}"
          </button>

          {/* Related keywords */}
          {result.related_keywords.length > 0 && (
            <div className="rounded-[8px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Mots-clés associés
              </p>
              <div className="flex flex-col gap-1.5">
                {result.related_keywords.map((rk) => (
                  <div key={rk.keyword} className="flex items-center justify-between text-[12px]">
                    <button
                      onClick={() => onUseKeyword(rk.keyword)}
                      className="text-left transition-opacity hover:opacity-70"
                      style={{ color: 'var(--memovia-violet)' }}
                    >
                      {rk.keyword}
                    </button>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {rk.search_volume.toLocaleString('fr-FR')} rech./mois
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Competitor Analysis ───────────────────────────────────────────────────────

function CompetitorPanel() {
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CompetitorAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function analyze() {
    const d = domain.trim()
    if (!d) return
    if (competitorCache.has(d)) { setResult(competitorCache.get(d)!); return }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.functions.invoke<CompetitorAnalysisResult>(
      'seo-competitor-analysis',
      { body: { domain: d } },
    )
    setLoading(false)
    if (err || !data) { setError("Erreur lors de l'analyse. Vérifiez les secrets DataForSEO et ANTHROPIC_API_KEY."); return }
    competitorCache.set(d, data)
    setResult(data)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && analyze()}
          placeholder="Ex : hubspot.fr, ypareo.fr…"
          className="h-9 flex-1 rounded-lg border bg-transparent px-3 text-[13px] outline-none transition-colors focus:border-[var(--memovia-violet)]"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        />
        <button
          onClick={analyze}
          disabled={loading || !domain.trim()}
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--memovia-violet)' }}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
          Analyser
        </button>
      </div>

      {error && (
        <p className="rounded-lg border px-4 py-3 text-[12px]" style={{ borderColor: '#fca5a5', backgroundColor: '#fef2f2', color: '#991b1b' }}>
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          {/* Top pages */}
          <div className="rounded-[8px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Top 20 pages organiques — {result.domain}
            </p>
            <div className="flex flex-col gap-2">
              {result.top_pages.map((page, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-[12px]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>{page.title}</p>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 truncate transition-opacity hover:opacity-70"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      {page.url}
                    </a>
                  </div>
                  <span className="shrink-0 font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {page.traffic_share.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Content gaps */}
          {result.content_gaps.length > 0 && (
            <div className="rounded-[8px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Opportunités content gap pour MEMOVIA
              </p>
              <div className="flex flex-col gap-3">
                {result.content_gaps.map((gap, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{gap.topic}</p>
                      {gap.estimated_volume != null && (
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          ~{gap.estimated_volume.toLocaleString('fr-FR')} rech./mois
                        </span>
                      )}
                    </div>
                    <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{gap.why}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── GEO Explainer ─────────────────────────────────────────────────────────────

const GEO_CRITERIA = [
  { label: 'Structure Q&A', desc: 'Au moins 2 titres H3 formulés comme des questions.', points: 20 },
  { label: 'Citations factuelles', desc: 'Au moins 3 chiffres concrets avec unité (%, €, milliers…).', points: 20 },
  { label: 'Schema JSON-LD', desc: 'Balise <script type="application/ld+json"> présente dans le HTML.', points: 15 },
  { label: 'Longueur optimale', desc: 'Entre 800 et 1 400 mots — ni trop court, ni trop dense.', points: 15 },
  { label: 'Définitions des concepts', desc: 'Au moins 2 tournures "X est…" ou "X désigne…".', points: 15 },
  { label: 'Langage naturel', desc: 'Mots de plus de 12 caractères < 8% du texte total.', points: 15 },
]

function GeoExplainerPanel() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[8px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
        <p className="mb-1 text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Qu'est-ce que le Score GEO ?
        </p>
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Le GEO (Generative Engine Optimization) mesure la capacité d'un article à être correctement
          cité par les IA génératives (ChatGPT, Perplexity, Gemini). Un score ≥ 80 est recommandé
          pour maximiser la visibilité dans les réponses IA.
        </p>
      </div>

      <div className="rounded-[8px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Les 6 critères (total : 100 pts)
        </p>
        <div className="flex flex-col gap-3">
          {GEO_CRITERIA.map((c) => (
            <div key={c.label} className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{c.label}</p>
                <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{c.desc}</p>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{ backgroundColor: 'var(--memovia-violet-light)', color: 'var(--memovia-violet)' }}
              >
                +{c.points}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 text-[12px]">
        <ScoreChip score={0} label="< 60 — À améliorer" bg="#fef2f2" color="#dc2626" />
        <ScoreChip score={0} label="60-79 — Bon" bg="#fff7ed" color="#ea580c" />
        <ScoreChip score={0} label="≥ 80 — Excellent" bg="#dcfce7" color="#16a34a" />
      </div>
    </div>
  )
}

function ScoreChip({ label, bg, color }: { score: number; label: string; bg: string; color: string }) {
  return (
    <span className="rounded-full px-3 py-1 text-[11px] font-medium" style={{ backgroundColor: bg, color }}>
      {label}
    </span>
  )
}

// ── Backlinks ─────────────────────────────────────────────────────────────────

function BacklinksPanel() {
  const [domain, setDomain] = useState('memovia.io')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BacklinksResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function analyze() {
    const d = domain.trim()
    if (!d) return
    if (backlinksCache.has(d)) { setResult(backlinksCache.get(d)!); return }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.functions.invoke<BacklinksResult>(
      'seo-backlinks',
      { body: { domain: d } },
    )
    setLoading(false)
    if (err || !data) { setError("Erreur lors de l'analyse backlinks. Vérifiez les secrets DataForSEO."); return }
    backlinksCache.set(d, data)
    setResult(data)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && analyze()}
          placeholder="Ex : memovia.io"
          className="h-9 flex-1 rounded-lg border bg-transparent px-3 text-[13px] outline-none transition-colors focus:border-[var(--memovia-violet)]"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        />
        <button
          onClick={analyze}
          disabled={loading || !domain.trim()}
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--memovia-violet)' }}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          Analyser
        </button>
      </div>

      {error && (
        <p className="rounded-lg border px-4 py-3 text-[12px]" style={{ borderColor: '#fca5a5', backgroundColor: '#fef2f2', color: '#991b1b' }}>
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          {/* Summary metrics */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="Total backlinks" value={result.total_backlinks.toLocaleString('fr-FR')} />
            <MetricCard label="Domaines référents" value={result.referring_domains.toLocaleString('fr-FR')} />
            <MetricCard label="Domain Rank" value={result.domain_rank != null ? String(result.domain_rank) : '—'} unit="/100" />
          </div>

          {/* Top pages */}
          {result.top_pages.length > 0 && (
            <div className="rounded-[8px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Top 10 pages les plus linkées
              </p>
              <div className="flex flex-col gap-2">
                {result.top_pages.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-[12px]">
                    <a
                      href={p.url.startsWith('http') ? p.url : `https://${p.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate transition-opacity hover:opacity-70"
                      style={{ color: 'var(--memovia-violet)' }}
                    >
                      {p.url}
                    </a>
                    <span className="shrink-0 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {p.backlinks_count.toLocaleString('fr-FR')} BL
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function MetricCard({ label, value, unit, valueColor }: {
  label: string
  value: string
  unit?: string
  valueColor?: string
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-[8px] border px-3 py-2.5"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-[15px] font-bold tabular-nums" style={{ color: valueColor ?? 'var(--text-primary)' }}>
        {value}
        {unit && <span className="ml-0.5 text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
      </p>
    </div>
  )
}

function TrendChart({ trend }: { trend: { year: number; month: number; search_volume: number }[] }) {
  // Last 12 months sorted by date
  const sorted = [...trend].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  ).slice(-12)

  const max = Math.max(...sorted.map((t) => t.search_volume), 1)
  const W = 240
  const H = 40
  const pts = sorted.map((t, i) => {
    const x = (i / (sorted.length - 1)) * W
    const y = H - (t.search_volume / max) * H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

  return (
    <div className="rounded-[8px] border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
      <p className="mb-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>Tendance 12 mois</p>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        <polyline
          points={pts}
          fill="none"
          stroke="var(--memovia-violet)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {sorted.map((t, i) => (
          <span key={i}>{months[t.month - 1]}</span>
        ))}
      </div>
    </div>
  )
}
