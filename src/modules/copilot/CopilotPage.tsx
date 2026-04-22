import { Sparkles } from 'lucide-react'

export default function CopilotPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-[8px] bg-[var(--memovia-violet-light)]">
        <Sparkles className="h-7 w-7 text-[var(--memovia-violet)]" />
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Copilote IA
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Le panneau s'ouvre automatiquement — posez vos questions en bas à droite.
        </p>
      </div>
    </div>
  )
}
