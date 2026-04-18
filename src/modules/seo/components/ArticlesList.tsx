import { Globe, FileText, Archive, Trash2, RefreshCw, Clock } from 'lucide-react'
import type { BlogArticle, ArticleStatus } from '@/types/seo'

interface ArticlesListProps {
  articles: BlogArticle[]
  isLoading: boolean
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
  onPublish,
  onArchive,
  onDelete,
  onRefresh,
}: ArticlesListProps) {
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
              <li key={article.id} className="px-5 py-3.5">
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
                        <span
                          className="text-[10px]"
                          style={{ color: 'var(--text-muted)' }}
                        >
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

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    {article.status === 'draft' && (
                      <ActionBtn
                        icon={<Globe className="h-3.5 w-3.5" />}
                        label="Publier"
                        onClick={() => onPublish(article.id)}
                        color="var(--memovia-violet)"
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
                      onClick={() => {
                        if (confirm(`Supprimer "${article.title}" ?`)) onDelete(article.id)
                      }}
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
