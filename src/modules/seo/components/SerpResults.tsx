import { ExternalLink, TrendingUp } from 'lucide-react'
import type { SerpAnalysis } from '@/types/seo'

interface SerpResultsProps {
  serp: SerpAnalysis
}

export function SerpResults({ serp }: SerpResultsProps) {
  const formattedTotal = serp.total_results.toLocaleString('fr-FR')

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      <div className="mb-4 flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--memovia-violet-light)' }}
        >
          <TrendingUp className="h-4 w-4" style={{ color: 'var(--memovia-violet)' }} />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Analyse SERP — &laquo;{serp.keyword}&raquo;
          </h3>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {formattedTotal} résultats · top {serp.results.length} positions
          </p>
        </div>
      </div>

      <ol className="space-y-3">
        {serp.results.map((result) => (
          <li key={result.position} className="flex gap-3">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-muted)',
              }}
            >
              {result.position}
            </span>
            <div className="min-w-0 flex-1">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[13px] font-medium leading-snug hover:underline"
                style={{ color: 'var(--memovia-violet)' }}
              >
                <span className="truncate">{result.title}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
              </a>
              <p
                className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                {result.description || result.url}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
