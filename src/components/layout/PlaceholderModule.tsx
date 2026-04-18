import { Construction } from 'lucide-react'

interface PlaceholderModuleProps {
  title: string
  description?: string
}

export function PlaceholderModule({ title, description }: PlaceholderModuleProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-primary)]">
        <Construction className="h-7 w-7 text-[var(--text-muted)]" />
      </div>
      <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="max-w-xs text-sm text-[var(--text-secondary)]">
        {description ?? 'Ce module est en cours de développement. Revenez bientôt.'}
      </p>
    </div>
  )
}
