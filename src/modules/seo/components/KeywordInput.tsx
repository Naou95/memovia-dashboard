import { useState } from 'react'
import { Search, Loader2, Lightbulb } from 'lucide-react'
import type { GenerationStep } from '@/types/seo'

interface KeywordInputProps {
  step: GenerationStep
  onGenerate: (keyword: string, theme: string) => void
}

const STEP_LABELS: Record<GenerationStep, string> = {
  idle: '',
  fetching_serp: 'Analyse SERP en cours…',
  generating_article: 'Claude rédige l\'article…',
  done: '',
  error: '',
}

export function KeywordInput({ step, onGenerate }: KeywordInputProps) {
  const [keyword, setKeyword] = useState('')
  const [theme, setTheme] = useState('')
  const isLoading = step === 'fetching_serp' || step === 'generating_article'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyword.trim() || isLoading) return
    onGenerate(keyword.trim(), theme.trim())
  }

  return (
    <div
      className="rounded-2xl border p-6"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      <h2
        className="mb-1 text-[15px] font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        Générer un article SEO
      </h2>
      <p className="mb-4 text-[13px]" style={{ color: 'var(--text-muted)' }}>
        Entrez un mot-clé cible — MEMOVIA analysera le SERP Google puis Claude rédigera
        l&apos;article optimisé.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Keyword */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Mot-clé cible · ex : logiciel de gestion pédagogique"
            disabled={isLoading}
            className="h-10 w-full rounded-xl border bg-transparent pl-9 pr-4 text-[13px] outline-none transition-colors focus:border-[var(--memovia-violet)] disabled:opacity-50"
            style={{
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Theme / angle */}
        <div className="relative">
          <Lightbulb
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Thème / angle · ex : comparatif pour responsables pédagogiques (optionnel)"
            disabled={isLoading}
            className="h-10 w-full rounded-xl border bg-transparent pl-9 pr-4 text-[13px] outline-none transition-colors focus:border-[var(--memovia-violet)] disabled:opacity-50"
            style={{
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={!keyword.trim() || isLoading}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--memovia-violet)' }}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Générer l&apos;article
        </button>
      </form>

      {isLoading && STEP_LABELS[step] && (
        <p className="mt-3 text-[12px]" style={{ color: 'var(--memovia-violet)' }}>
          {STEP_LABELS[step]}
        </p>
      )}
    </div>
  )
}
