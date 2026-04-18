import { useState } from 'react'
import { Globe, FileText, Archive, Trash2, RefreshCw, Clock, Pencil, AlertTriangle } from 'lucide-react'
import type { BlogArticle, ArticleStatus } from '@/types/seo'

interface ArticlesListProps {
  articles: BlogArticle[]
  isLoading: boolean
  onEdit: (article: BlogArticle) => void
  onPublish: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onRefresh: () => void
}

const STATUS_CONFIG: Record<
  ArticleStatus,
  { label: string; dot: string; text: string }
> = {
  draft: { label: 'Brouillon', dot: '#f59e0b', text: '#92400e' },
  published: { label: 'Publié', dot: '#10b981', text: '#065f46' },
  archived: { label: 'Archivé', dot: '#6b7280', text: '#374151' },
}

export function ArticlesList({
  articles,
  isLoading,
  onEdit,
  onPublish,
  onArchive,
  onDelete,
  onRefresh,
}: ArticlesListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const articleToDelete = deletingId ? articles.find((a) => a.id === deletingId) : null

  function confirmDelete() {
    if (deletingId) {
      onDelete(deletingId)
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
      >
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex animate-pulse gap-3">
              <div className="h-14 flex-1 rounded-xl" style={{ backgroundColor: 'var(--bg-primary)' }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className="rounded-2xl border"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div>
            <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              Articles blog
            </h3>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {articles.length} article{articles.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Rafraîchir"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {articles.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12">
            <FileText className="h-8 w-8 opacity-20" style={{ color: 'var(--text-muted)' }} />
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              Aucun article — générez-en un ci-dessus
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
            {articles.map((article) => {
              const cfg = STATUS_CONFIG[article.status]
              return (
                <li key={article.id} className="group px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: `${cfg.dot}18`,
                            color: cfg.text,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: cfg.dot }}
                          />
                          {cfg.label}
                        </span>
                        {article.keyword && (
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            #{article.keyword}
                          </span>
                        )}
                      </div>
                      <p
                        className="mt-1 truncate text-[13px] font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {article.title}
                      </p>
                      <div
                        className="mt-0.5 flex items-center gap-2 text-[11px]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <span className="font-mono">/{article.slug}</span>
                        {article.reading_time && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {article.reading_time} min
                            </span>
                          </>
                        )}
                        {article.published_at && (
                          <>
                            <span>·</span>
                            <span>
                              Publié le{' '}
                              {new Date(article.published_at).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions — visible on hover */}
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <ActionBtn
                        icon={<Pencil className="h-3.5 w-3.5" />}
                        label="Modifier"
                        onClick={() => onEdit(article)}
                        color="var(--memovia-violet)"
                      />
                      {article.status === 'draft' && (
                        <ActionBtn
                          icon={<Globe className="h-3.5 w-3.5" />}
                          label="Publier"
                          onClick={() => onPublish(article.id)}
                          color="#10b981"
                        />
                      )}
                      {article.status === 'published' && (
                        <ActionBtn
                          icon={<Archive className="h-3.5 w-3.5" />}
                          label="Archiver"
                          onClick={() => onArchive(article.id)}
                          color="var(--text-muted)"
                        />
                      )}
                      <ActionBtn
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        label="Supprimer"
                        onClick={() => setDeletingId(article.id)}
                        color="#ef4444"
                      />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deletingId && articleToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setDeletingId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border p-6 shadow-2xl"
            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#fef2f2' }}>
                <AlertTriangle className="h-5 w-5" style={{ color: '#ef4444' }} />
              </div>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Supprimer l&apos;article ?
                </p>
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Cette action est irréversible.
                </p>
              </div>
            </div>
            <p
              className="mb-5 rounded-xl px-3 py-2 text-[12px] font-medium"
              style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
            >
              {articleToDelete.title}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 rounded-xl border px-4 py-2 text-[13px] font-medium transition-colors"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-xl px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#ef4444' }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ActionBtn({
  icon,
  label,
  onClick,
  color,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  color: string
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:opacity-80"
      style={{ color }}
    >
      {icon}
    </button>
  )
}
