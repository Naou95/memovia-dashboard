import { Sparkles } from 'lucide-react'

export default function CopilotPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--memovia-violet-light)]">
        <Sparkles className="h-8 w-8 text-[var(--memovia-violet)]" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Copilote IA</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Le panneau s'ouvre automatiquement — posez vos questions en bas à droite.
        </p>
      </div>
    </div>
  )
}
