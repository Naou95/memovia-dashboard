import { useState, useEffect, useMemo } from 'react'
import { Save, Globe, FileText, Clock, Tag, Layers, Image, ChevronDown, Link2 } from 'lucide-react'
import type { GeneratedArticle, ArticleCreatePayload, BlogCategory } from '@/types/seo'

interface ArticleEditorProps {
  article: GeneratedArticle
  keyword: string
  categories: BlogCategory[]
  articleId?: string
  initialContent?: string
  initialCategoryId?: string
  initialCoverImageUrl?: string
  onSave: (payload: ArticleCreatePayload) => Promise<void>
  onPublish: (payload: ArticleCreatePayload) => Promise<void>
  onUpdate?: (id: string, payload: Partial<ArticleCreatePayload>) => Promise<void>
  isSaving: boolean
}

type PreviewTab = 'edit' | 'preview'

// ── SEO Scoring ───────────────────────────────────────────────────────────────

const FR_STOPWORDS = new Set([
  'le', 'la', 'les', 'de', 'du', 'des', 'en', 'et', 'ou', 'pour',
  'par', 'sur', 'avec', 'dans', 'un', 'une', 'ce', 'se', 'sa', 'son',
  'ses', 'qui', 'que', 'au', 'aux',
])

function extractKeywordFromH1(content: string): string {
  const htmlMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i)
  const h1Text = htmlMatch
    ? htmlMatch[1].replace(/<[^>]+>/g, '').trim()
    : (content.match(/^# (.+)/m)?.[1]?.trim() ?? '')

  if (!h1Text) return ''

  return h1Text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FR_STOPWORDS.has(w))
    .slice(0, 4)
    .join(' ')
}

interface SeoCheck {
  label: string
  pass: boolean
  points: number
}

function calculateSeoScore(
  content: string,
  metaDescription: string,
  excerpt: string,
  coverImageUrl: string,
): { score: number; checks: SeoCheck[] } {
  const kw = extractKeywordFromH1(content)

  const textContent = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = textContent ? textContent.split(/\s+/) : []
  const wordCount = words.length
  const first150 = words.slice(0, 150).join(' ').toLowerCase()

  const h2HtmlCount = (content.match(/<h2[\s>]/gi) ?? []).length
  const h2MdCount = (content.match(/^## /gm) ?? []).length
  const h2Count = h2HtmlCount + h2MdCount

  const checks: SeoCheck[] = [
    {
      label: 'Mot-clé présent dans le H1',
      pass: kw.length > 0,
      points: 20,
    },
    {
      label: 'Mot-clé dans les 150 premiers mots',
      pass: kw.length > 0 && first150.includes(kw),
      points: 15,
    },
    {
      label: 'Mot-clé dans la meta description',
      pass: kw.length > 0 && metaDescription.toLowerCase().includes(kw),
      points: 15,
    },
    {
      label: 'Longueur contenu (800-1400 mots)',
      pass: wordCount >= 800 && wordCount <= 1400,
      points: 20,
    },
    {
      label: 'Au moins 3 sous-titres H2',
      pass: h2Count >= 3,
      points: 10,
    },
    {
      label: 'Extrait renseigné',
      pass: excerpt.trim().length > 0,
      points: 10,
    },
    {
      label: 'Image de couverture définie',
      pass: coverImageUrl.trim().length > 0,
      points: 10,
    },
  ]

  const score = checks.reduce((sum, c) => sum + (c.pass ? c.points : 0), 0)
  return { score, checks }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ArticleEditor({
  article,
  keyword,
  categories,
  articleId,
  initialContent,
  initialCategoryId,
  initialCoverImageUrl,
  onSave,
  onPublish,
  onUpdate,
  isSaving,
}: ArticleEditorProps) {
  const isEditMode = Boolean(articleId)
  const [title, setTitle] = useState(article.title)
  const [slug, setSlug] = useState(article.suggested_slug)
  const [content, setContent] = useState(initialContent ?? article.content ?? '')
  const [metaTitle, setMetaTitle] = useState(article.meta_title)
  const [metaDescription, setMetaDescription] = useState(article.meta_description)
  const [excerpt, setExcerpt] = useState(article.excerpt)
  const [coverImageUrl, setCoverImageUrl] = useState(initialCoverImageUrl ?? '')
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? '')
  const [previewTab, setPreviewTab] = useState<PreviewTab>('edit')

  const seo = useMemo(
    () => calculateSeoScore(content, metaDescription, excerpt, coverImageUrl),
    [content, metaDescription, excerpt, coverImageUrl],
  )

  const canPublish = seo.score >= 60

  function buildPayload(status: 'draft' | 'published'): ArticleCreatePayload {
    return {
      title,
      slug,
      content,
      excerpt,
      keyword,
      status,
      category_id: categoryId || undefined,
      meta_title: metaTitle,
      meta_description: metaDescription,
      reading_time: article.reading_time,
      cover_image_url: coverImageUrl || undefined,
    }
  }

  function buildUpdatePayload(): Partial<ArticleCreatePayload> {
    return {
      title,
      slug,
      content,
      excerpt,
      category_id: categoryId || undefined,
      meta_title: metaTitle,
      meta_description: metaDescription,
      cover_image_url: coverImageUrl || undefined,
    }
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-5"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'var(--memovia-violet-light)' }}
          >
            <FileText className="h-4 w-4" style={{ color: 'var(--memovia-violet)' }} />
          </div>
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Article généré
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <Clock className="h-3.5 w-3.5" />
          {article.reading_time} min de lecture
        </div>
      </div>

      {/* Meta fields */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Titre" icon={<FileText className="h-3.5 w-3.5" />}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </Field>
        <Field label="Slug URL" icon={<Globe className="h-3.5 w-3.5" />}>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={`${inputClass} font-mono text-[12px]`}
            style={inputStyle}
          />
        </Field>
        <Field label={`Meta title (${metaTitle.length}/60)`} icon={<Tag className="h-3.5 w-3.5" />}>
          <input
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            maxLength={60}
            className={inputClass}
            style={inputStyle}
          />
        </Field>
        <Field
          label={`Meta description (${metaDescription.length}/155)`}
          icon={<Tag className="h-3.5 w-3.5" />}
        >
          <input
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            maxLength={155}
            className={inputClass}
            style={inputStyle}
          />
        </Field>
        <Field label="Catégorie" icon={<Layers className="h-3.5 w-3.5" />}>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">— Aucune catégorie —</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Excerpt */}
      <Field label={`Extrait (${(excerpt ?? '').length}/160)`} icon={<FileText className="h-3.5 w-3.5" />}>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          maxLength={160}
          className={`${inputClass} resize-none`}
          style={inputStyle}
        />
      </Field>

      {/* Cover image */}
      <Field label="Image de couverture (optionnel)" icon={<Image className="h-3.5 w-3.5" />}>
        <input
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
          placeholder="https://images.unsplash.com/..."
          className={inputClass}
          style={inputStyle}
        />
        {coverImageUrl && (
          <img
            src={coverImageUrl}
            alt="Aperçu image de couverture"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
            onLoad={(e) => { e.currentTarget.style.display = 'block' }}
            className="mt-2 h-24 w-full rounded-xl object-cover"
            style={{ border: '1px solid var(--border-color)', display: 'none' }}
          />
        )}
      </Field>

      {/* SEO Score */}
      <SeoScoreBadge score={seo.score} checks={seo.checks} />

      {/* Content — edit / preview tabs */}
      <div>
        <div className="mb-2 flex gap-1">
          {(['edit', 'preview'] as PreviewTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setPreviewTab(tab)}
              className="rounded-lg px-3 py-1 text-[12px] font-medium transition-colors"
              style={{
                backgroundColor:
                  previewTab === tab ? 'var(--memovia-violet-light)' : 'transparent',
                color:
                  previewTab === tab ? 'var(--memovia-violet)' : 'var(--text-muted)',
              }}
            >
              {tab === 'edit' ? 'Édition' : 'Aperçu'}
            </button>
          ))}
        </div>

        {previewTab === 'edit' ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={22}
            className="w-full resize-y rounded-xl border bg-transparent px-3 py-2.5 font-mono text-[12px] leading-relaxed outline-none transition-colors focus:border-[var(--memovia-violet)]"
            style={{
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />
        ) : (
          <div
            className="prose prose-sm max-h-[440px] max-w-none overflow-y-auto rounded-xl border px-4 py-3"
            style={{
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
              '--tw-prose-body': 'var(--text-primary)',
            } as React.CSSProperties}
          >
            {isHtmlContent(content) ? (
              <div dangerouslySetInnerHTML={{ __html: content }} />
            ) : (
              <MarkdownPreview content={content} />
            )}
          </div>
        )}
      </div>

      {/* Internal linking suggestions */}
      {article.internal_linking_suggestions && article.internal_linking_suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
            <Link2 className="h-3.5 w-3.5" />
            Maillage interne suggéré
          </div>
          <div className="flex flex-wrap gap-1.5">
            {article.internal_linking_suggestions.map((title, i) => (
              <span
                key={i}
                className="rounded-lg px-2.5 py-1 text-[12px] font-medium"
                style={{
                  backgroundColor: 'var(--memovia-violet-light)',
                  color: 'var(--memovia-violet)',
                }}
              >
                {title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
        {!canPublish && (
          <p className="text-[12px]" style={{ color: '#dc2626' }}>
            Score SEO insuffisant ({seo.score}/100). Corrigez les points manquants avant de publier.
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onSave(buildPayload('draft'))}
            disabled={isSaving || !title || !slug}
            className="flex items-center gap-2 rounded-xl border px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
            style={{
              borderColor: 'var(--border-color)',
              color: 'var(--text-secondary)',
            }}
          >
            <Save className="h-3.5 w-3.5" />
            Brouillon
          </button>
          {isEditMode ? (
            <button
              onClick={() => onUpdate?.(articleId!, buildUpdatePayload())}
              disabled={isSaving || !title || !slug || !canPublish}
              title={!canPublish ? `Score SEO insuffisant (${seo.score}/100)` : undefined}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: 'var(--memovia-violet)' }}
            >
              <Save className="h-3.5 w-3.5" />
              Mettre à jour
            </button>
          ) : (
            <button
              onClick={() => onPublish(buildPayload('published'))}
              disabled={isSaving || !title || !slug || !categoryId || !canPublish}
              title={
                !categoryId
                  ? 'Sélectionnez une catégorie pour publier'
                  : !canPublish
                  ? `Score SEO insuffisant (${seo.score}/100)`
                  : undefined
              }
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: 'var(--memovia-violet)' }}
            >
              <Globe className="h-3.5 w-3.5" />
              Publier sur memovia.io
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isHtmlContent(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str)
}

const inputClass =
  'h-9 w-full rounded-xl border bg-transparent px-3 text-[13px] outline-none transition-colors focus:border-[var(--memovia-violet)]'

const inputStyle: React.CSSProperties = {
  borderColor: 'var(--border-color)',
  color: 'var(--text-primary)',
  backgroundColor: 'transparent',
}

function Field({
  label,
  icon,
  children,
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className="flex items-center gap-1 text-[11px] font-medium"
        style={{ color: 'var(--text-muted)' }}
      >
        {icon}
        {label}
      </label>
      {children}
    </div>
  )
}

function SeoScoreBadge({ score, checks }: { score: number; checks: SeoCheck[] }) {
  const [open, setOpen] = useState(false)

  const color =
    score >= 80
      ? { bg: '#dcfce7', text: '#16a34a' }
      : score >= 60
      ? { bg: '#fff7ed', text: '#ea580c' }
      : { bg: '#fef2f2', text: '#dc2626' }

  return (
    <div className="rounded-xl border" style={{ borderColor: 'var(--border-color)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2"
      >
        <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          Score SEO
        </span>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[12px] font-bold"
            style={{ backgroundColor: color.bg, color: color.text }}
          >
            {score}/100
          </span>
          <ChevronDown
            className="h-3.5 w-3.5 transition-transform"
            style={{
              color: 'var(--text-muted)',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </button>
      {open && (
        <div
          className="flex flex-col gap-1.5 border-t px-3 pb-3 pt-2"
          style={{ borderColor: 'var(--border-color)' }}
        >
          {checks.map((c) => (
            <div key={c.label} className="flex items-center justify-between text-[12px]">
              <span style={{ color: 'var(--text-secondary)' }}>
                {c.pass ? '✅' : '❌'} {c.label}
              </span>
              <span style={{ color: c.pass ? '#16a34a' : 'var(--text-muted)' }}>
                +{c.points}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MarkdownPreview({ content }: { content: string }) {
  const lines = (content ?? '').split('\n')

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith('# '))
          return (
            <h1 key={i} className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {line.slice(2)}
            </h1>
          )
        if (line.startsWith('## '))
          return (
            <h2 key={i} className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {line.slice(3)}
            </h2>
          )
        if (line.startsWith('### '))
          return (
            <h3 key={i} className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
              {line.slice(4)}
            </h3>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              {line.slice(2)}
            </li>
          )
        if (line.trim() === '') return <div key={i} className="h-2" />
        return (
          <p key={i} className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {line}
          </p>
        )
      })}
    </div>
  )
}
