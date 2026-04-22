import { useState } from 'react'
import { BarChart3, Layers, ArrowLeft, Lightbulb, Plus, X, Sparkles, ArrowRight, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useSeo } from '@/hooks/useSeo'
import { KeywordInput } from './components/KeywordInput'
import { SerpResults } from './components/SerpResults'
import { ArticleEditor } from './components/ArticleEditor'
import { ArticlesList } from './components/ArticlesList'
import type { ArticleCreatePayload, BlogArticle, SeoSeed, SeoSuggestion } from '@/types/seo'

type Tab = 'generator' | 'articles' | 'suggestions'

function blogArticleToGenerated(a: BlogArticle) {
  return {
    title: a.title,
    meta_title: a.meta_title ?? '',
    meta_description: a.meta_description ?? '',
    excerpt: a.excerpt ?? '',
    content: a.content ?? '',
    reading_time: a.reading_time ?? 5,
    suggested_slug: a.slug,
  }
}

export default function SeoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('generator')
  const [isSaving, setIsSaving] = useState(false)
  const [editingArticle, setEditingArticle] = useState<BlogArticle | null>(null)
  const [pendingKeyword, setPendingKeyword] = useState<string | null>(null)

  const {
    articles,
    categories,
    isLoading,
    generationStep,
    generateResult,
    generate,
    resetGeneration,
    saveArticle,
    updateArticle,
    publishArticle,
    archiveArticle,
    deleteArticle,
    fetchArticles,
    seeds,
    addSeed,
    deleteSeed,
    suggestions,
    suggestionsLoading,
    generateSuggestions,
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

  async function handleUpdate(id: string, payload: Partial<ArticleCreatePayload>) {
    setIsSaving(true)
    await updateArticle(id, payload)
    setIsSaving(false)
    setEditingArticle(null)
    setActiveTab('articles')
  }

  function handleEdit(article: BlogArticle) {
    setEditingArticle(article)
    setActiveTab('generator')
    resetGeneration()
  }

  function handleSelectSuggestion(keyword: string) {
    setPendingKeyword(keyword)
    setActiveTab('generator')
  }

  function cancelEdit() {
    setEditingArticle(null)
    resetGeneration()
  }

  const stats = {
    total: articles.length,
    published: articles.filter((a) => a.status === 'published').length,
    drafts: articles.filter((a) => a.status === 'draft').length,
  }

  return (
    <motion.div className="space-y-5" variants={staggerContainer} initial="hidden" animate="show">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem}>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          SEO & Blog
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Génération d&apos;articles via Claude + DataForSEO · publication sur memovia.io.
        </p>
      </motion.div>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem} className="grid shrink-0 grid-cols-3 gap-3">
        {isLoading ? (
          <>
            <div className="skeleton h-[60px] rounded-[8px]" />
            <div className="skeleton h-[60px] rounded-[8px]" />
            <div className="skeleton h-[60px] rounded-[8px]" />
          </>
        ) : (
          <>
            <StatCard label="Total articles" value={stats.total} accent="#6366f1" />
            <StatCard label="Publiés" value={stats.published} accent="#10b981" />
            <StatCard label="Brouillons" value={stats.drafts} accent="#f59e0b" />
          </>
        )}
      </motion.div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <motion.div
        variants={staggerItem}
        className="flex shrink-0 gap-1 rounded-lg border p-1"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
      >
        {([
          { id: 'generator', label: 'Générateur IA', icon: <BarChart3 className="h-3.5 w-3.5" /> },
          { id: 'articles', label: 'Articles', icon: <Layers className="h-3.5 w-3.5" />, badge: stats.total },
          { id: 'suggestions', label: 'Suggestions', icon: <Lightbulb className="h-3.5 w-3.5" /> },
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
          {/* Edit mode */}
          {editingArticle ? (
            <>
              <button
                onClick={cancelEdit}
                className="flex w-fit items-center gap-1.5 text-[12px] transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Retour aux articles
              </button>
              <ArticleEditor
                article={blogArticleToGenerated(editingArticle)}
                keyword={editingArticle.keyword ?? ''}
                categories={categories}
                articleId={editingArticle.id}
                initialContent={editingArticle.content ?? undefined}
                initialCategoryId={editingArticle.category_id ?? undefined}
                initialCoverImageUrl={editingArticle.cover_image_url ?? undefined}
                onSave={handleSave}
                onPublish={handlePublish}
                onUpdate={handleUpdate}
                isSaving={isSaving}
              />
            </>
          ) : (
            <>
              <KeywordInput
                step={generationStep}
                onGenerate={generate}
                defaultKeyword={pendingKeyword ?? undefined}
                onDefaultKeywordConsumed={() => setPendingKeyword(null)}
              />

              {generationStep === 'done' && generateResult && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
                  <SerpResults serp={generateResult.serp} />
                  <ArticleEditor
                    article={generateResult.article}
                    keyword={generateResult.serp.keyword}
                    categories={categories}
                    initialCoverImageUrl={generateResult.article.cover_image_url ?? undefined}
                    onSave={handleSave}
                    onPublish={handlePublish}
                    isSaving={isSaving}
                  />
                </div>
              )}

              {generationStep === 'error' && (
                <div
                  className="rounded-[8px] border px-5 py-4 text-[13px]"
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
            </>
          )}
        </motion.div>
      )}

      {/* ── Articles tab ───────────────────────────────────────────────────── */}
      {activeTab === 'articles' && (
        <motion.div variants={staggerItem}>
          <ArticlesList
            articles={articles}
            isLoading={isLoading}
            onEdit={handleEdit}
            onPublish={publishArticle}
            onArchive={archiveArticle}
            onDelete={deleteArticle}
            onRefresh={fetchArticles}
          />
        </motion.div>
      )}

      {/* ── Suggestions tab ────────────────────────────────────────────────── */}
      {activeTab === 'suggestions' && (
        <motion.div variants={staggerItem} className="flex flex-col gap-4">
          <SuggestionsTab
            seeds={seeds}
            suggestions={suggestions}
            isLoading={suggestionsLoading}
            onAddSeed={addSeed}
            onDeleteSeed={deleteSeed}
            onGenerate={generateSuggestions}
            onSelectSuggestion={handleSelectSuggestion}
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

// ── SuggestionsTab ────────────────────────────────────────────────────────────
function SuggestionsTab({ seeds, suggestions, isLoading, onAddSeed, onDeleteSeed, onGenerate, onSelectSuggestion }: {
  seeds: SeoSeed[]
  suggestions: SeoSuggestion[]
  isLoading: boolean
  onAddSeed: (keyword: string) => Promise<void>
  onDeleteSeed: (id: string) => Promise<void>
  onGenerate: () => Promise<void>
  onSelectSuggestion: (keyword: string) => void
}) {
  const [newSeed, setNewSeed] = useState('')

  const handleAddSeed = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSeed.trim()) return
    await onAddSeed(newSeed)
    setNewSeed('')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Seeds management */}
      <div className="rounded-[8px] border p-5" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
        <h2 className="mb-3 text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Sujets de base
        </h2>
        <form onSubmit={handleAddSeed} className="mb-3 flex gap-2">
          <input
            value={newSeed}
            onChange={(e) => setNewSeed(e.target.value)}
            placeholder="Ajouter un sujet..."
            className="h-9 flex-1 rounded-lg border bg-transparent px-3 text-[13px] outline-none transition-colors focus:border-[var(--memovia-violet)]"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
          <button
            type="submit"
            disabled={!newSeed.trim()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--memovia-violet)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {seeds.map((seed) => (
            <span
              key={seed.id}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px]"
              style={{ backgroundColor: 'var(--memovia-violet-light)', color: 'var(--memovia-violet)' }}
            >
              {seed.keyword}
              <button
                onClick={() => onDeleteSeed(seed.id)}
                className="ml-1 opacity-60 hover:opacity-100"
                aria-label={`Supprimer ${seed.keyword}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={isLoading || seeds.length === 0}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
        style={{ backgroundColor: 'var(--memovia-violet)' }}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Générer les suggestions du mois
      </button>

      {/* Suggestions cards */}
      {suggestions.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {suggestions.map((s, i) => (
            <SuggestionCard
              key={i}
              suggestion={s}
              onSelect={() => onSelectSuggestion(s.keyword)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── SuggestionCard ────────────────────────────────────────────────────────────
function SuggestionCard({ suggestion, onSelect }: { suggestion: SeoSuggestion; onSelect: () => void }) {
  const scoreColor =
    suggestion.opportunity_score >= 70
      ? '#10b981'
      : suggestion.opportunity_score >= 40
        ? '#f59e0b'
        : '#ef4444'

  return (
    <div
      className="flex flex-col gap-2 rounded-[8px] border p-4"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: '#7c3aed22', color: '#7c3aed' }}
        >
          {suggestion.keyword}
        </span>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{ backgroundColor: `${scoreColor}22`, color: scoreColor }}
        >
          {suggestion.opportunity_score}/100
        </span>
      </div>
      <p className="text-[13px] font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
        {suggestion.title}
      </p>
      <p className="text-[12px] italic" style={{ color: 'var(--text-muted)' }}>
        {suggestion.angle}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {suggestion.volume.toLocaleString('fr-FR')} rech./mois
        </span>
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {suggestion.why_now}
        </span>
      </div>
      <button
        onClick={onSelect}
        className="mt-1 flex items-center gap-1.5 self-end rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors"
        style={{ backgroundColor: 'var(--memovia-violet-light)', color: 'var(--memovia-violet)' }}
      >
        <ArrowRight className="h-3.5 w-3.5" />
        Utiliser ce sujet
      </button>
    </div>
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
      className="flex items-center gap-3 rounded-[8px] border px-4 py-3"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
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
