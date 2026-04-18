import { useState } from 'react'
import { BarChart3, Layers } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useSeo } from '@/hooks/useSeo'
import { KeywordInput } from './components/KeywordInput'
import { SerpResults } from './components/SerpResults'
import { ArticleEditor } from './components/ArticleEditor'
import { ArticlesList } from './components/ArticlesList'
import type { ArticleCreatePayload } from '@/types/seo'

type Tab = 'generator' | 'articles'

export default function SeoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('generator')
  const [isSaving, setIsSaving] = useState(false)

  const {
    articles,
    isLoading,
    generationStep,
    generateResult,
    generate,
    resetGeneration,
    saveArticle,
    publishArticle,
    archiveArticle,
    deleteArticle,
    fetchArticles,
  } = useSeo()

  async function handleSave(payload: ArticleCreatePayload) {
    setIsSaving(true)
    await saveArticle(payload)
    setIsSaving(false)
    setActiveTab('articles')
    resetGeneration()
  }

  async function handlePublish(payload: ArticleCreatePayload) {
    setIsSaving(true)
    const article = await saveArticle(payload)
    if (article) {
      await publishArticle(article.id)
    }
    setIsSaving(false)
    setActiveTab('articles')
    resetGeneration()
  }

  const stats = {
    total: articles.length,
    published: articles.filter((a) => a.status === 'published').length,
    drafts: articles.filter((a) => a.status === 'draft').length,
  }

  return (
    <motion.div className="flex h-full flex-col gap-4 overflow-y-auto p-6" variants={staggerContainer} initial="hidden" animate="show">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem} className="flex shrink-0 items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'var(--memovia-violet-light)' }}
        >
          <BarChart3 className="h-5 w-5" style={{ color: 'var(--memovia-violet)' }} />
        </div>
        <div>
          <h1 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>
            SEO & Blog
          </h1>
          <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            Génération d&apos;articles via Claude + DataForSEO · publication sur memovia.io
          </p>
        </div>
      </motion.div>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      {!isLoading && (
        <motion.div variants={staggerItem} className="grid shrink-0 grid-cols-3 gap-3">
          <StatCard label="Total articles" value={stats.total} accent="#6366f1" />
          <StatCard label="Publiés" value={stats.published} accent="#10b981" />
          <StatCard label="Brouillons" value={stats.drafts} accent="#f59e0b" />
        </motion.div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <motion.div
        variants={staggerItem}
        className="flex shrink-0 gap-1 rounded-xl border p-1"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
      >
        {([
          { id: 'generator', label: 'Générateur IA', icon: <BarChart3 className="h-3.5 w-3.5" /> },
          { id: 'articles', label: 'Articles', icon: <Layers className="h-3.5 w-3.5" />, badge: stats.total },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            aria-pressed={activeTab === tab.id}
            aria-label={`Onglet ${tab.label}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-2"
            style={{
              backgroundColor:
                activeTab === tab.id ? 'var(--memovia-violet-light)' : 'transparent',
              color:
                activeTab === tab.id ? 'var(--memovia-violet)' : 'var(--text-muted)',
            }}
          >
            {tab.icon}
            {tab.label}
            {'badge' in tab && tab.badge > 0 && (
              <span
                className="rounded-full px-1.5 py-px text-[10px] font-bold"
                style={{
                  backgroundColor: 'var(--memovia-violet)',
                  color: 'white',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {/* ── Generator tab ──────────────────────────────────────────────────── */}
      {activeTab === 'generator' && (
        <motion.div variants={staggerItem} className="flex flex-col gap-4">
          <KeywordInput step={generationStep} onGenerate={generate} />

          {generationStep === 'done' && generateResult && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
              <SerpResults serp={generateResult.serp} />
              <ArticleEditor
                article={generateResult.article}
                keyword={generateResult.serp.keyword}
                onSave={handleSave}
                onPublish={handlePublish}
                isSaving={isSaving}
              />
            </div>
          )}

          {generationStep === 'error' && (
            <div
              className="rounded-2xl border px-5 py-4 text-[13px]"
              style={{
                borderColor: '#fca5a5',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
              }}
            >
              Une erreur est survenue lors de la génération. Vérifiez les clés DATAFORSEO et
              ANTHROPIC_API_KEY dans les secrets Supabase.
            </div>
          )}
        </motion.div>
      )}

      {/* ── Articles tab ───────────────────────────────────────────────────── */}
      {activeTab === 'articles' && (
        <motion.div variants={staggerItem}>
          <ArticlesList
            articles={articles}
            isLoading={isLoading}
            onPublish={publishArticle}
            onArchive={archiveArticle}
            onDelete={deleteArticle}
            onRefresh={fetchArticles}
          />
        </motion.div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <motion.p variants={staggerItem} className="shrink-0 pb-2 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
        MEMOVIA SEO · SERP via DataForSEO · Rédaction via Claude Sonnet 4.6
      </motion.p>
    </motion.div>
  )
}

// ── StatCard ───────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: string
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border px-4 py-3"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${accent}18` }}
      >
        <BarChart3 className="h-4 w-4" style={{ color: accent }} />
      </div>
      <div>
        <p className="text-lg font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
          {value}
        </p>
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
      </div>
    </div>
  )
}
