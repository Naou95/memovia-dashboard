import { useState } from 'react'
import { Save, Globe, FileText, Clock, Tag } from 'lucide-react'
import type { GeneratedArticle, ArticleCreatePayload } from '@/types/seo'

interface ArticleEditorProps {
  article: GeneratedArticle
  keyword: string
  onSave: (payload: ArticleCreatePayload) => Promise<void>
  onPublish: (payload: ArticleCreatePayload) => Promise<void>
  isSaving: boolean
}

type PreviewTab = 'edit' | 'preview'

export function ArticleEditor({
  article,
  keyword,
  onSave,
  onPublish,
  isSaving,
}: ArticleEditorProps) {
  const [title, setTitle] = useState(article.title)
  const [slug, setSlug] = useState(article.suggested_slug)
  const [content, setContent] = useState(article.content)
  const [metaTitle, setMetaTitle] = useState(article.meta_title)
  const [metaDescription, setMetaDescription] = useState(article.meta_description)
  const [excerpt, setExcerpt] = useState(article.excerpt)
  const [previewTab, setPreviewTab] = useState<PreviewTab>('edit')

  function buildPayload(status: 'draft' | 'published'): ArticleCreatePayload {
    return {
      title,
      slug,
      content,
      excerpt,
      keyword,
      status,
      meta_title: metaTitle,
      meta_description: metaDescription,
      reading_time: article.reading_time,
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
      </div>

      {/* Excerpt */}
      <Field label="Extrait" icon={<FileText className="h-3.5 w-3.5" />}>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          className={`${inputClass} resize-none`}
          style={inputStyle}
        />
      </Field>

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
              {tab === 'edit' ? 'Édition' : 'Aperçu Markdown'}
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
            <MarkdownPreview content={content} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
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
        <button
          onClick={() => onPublish(buildPayload('published'))}
          disabled={isSaving || !title || !slug}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--memovia-violet)' }}
        >
          <Globe className="h-3.5 w-3.5" />
          Publier sur memovia.io
        </button>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
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

function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split('\n')

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
