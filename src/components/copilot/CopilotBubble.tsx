import { useState } from 'react'
import { Sparkles, X, Send, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Floating AI copilot bubble (bottom-right).
 * Click → slide-in chat panel from the right.
 * The chat itself is a placeholder — Anthropic API wiring lands in Module 15.
 */
export function CopilotBubble() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fermer le copilote' : 'Ouvrir le copilote IA'}
        aria-expanded={open}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full',
          'bg-[var(--memovia-violet)] text-white shadow-lg shadow-[var(--memovia-violet)]/30',
          'transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-[var(--memovia-violet)]/40',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-2'
        )}
      >
        {open ? (
          <X className="h-5 w-5" strokeWidth={2.25} />
        ) : (
          <Sparkles className="h-5 w-5" strokeWidth={2.25} />
        )}
      </button>

      {/* Backdrop (subtle, click-to-close) */}
      {open && (
        <button
          type="button"
          aria-label="Fermer"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-[var(--text-primary)]/10 backdrop-blur-[1px] transition-opacity"
        />
      )}

      {/* Slide-in panel */}
      <aside
        role="dialog"
        aria-label="Copilote IA"
        aria-hidden={!open}
        className={cn(
          'fixed bottom-24 right-6 z-50 flex w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden',
          'h-[min(560px,calc(100vh-8rem))] rounded-2xl border border-[var(--border-color)]',
          'bg-[var(--bg-secondary)] shadow-2xl shadow-[var(--text-primary)]/10',
          'origin-bottom-right transition-all duration-200',
          open
            ? 'pointer-events-auto scale-100 opacity-100'
            : 'pointer-events-none scale-95 opacity-0'
        )}
      >
        {/* Header */}
        <header className="flex items-center gap-2.5 border-b border-[var(--border-color)] px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--memovia-violet)]">
            <Bot className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">
              Copilote MEMOVIA
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Assistant IA interne
            </div>
          </div>
        </header>

        {/* Messages zone (placeholder) */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--memovia-violet-light)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--memovia-violet)]" strokeWidth={2.25} />
            </div>
            <div className="rounded-2xl rounded-tl-md bg-[var(--bg-primary)] px-3 py-2 text-[13px] leading-relaxed text-[var(--text-primary)]">
              Bonjour 👋 Je suis ton copilote interne. Je serai bientôt connecté à
              tous tes modules (Stripe, Qonto, CRM, Calendrier…) pour répondre à
              tes questions métier et lancer des actions.
              <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                Branchement API Anthropic au Module 15.
              </div>
            </div>
          </div>
        </div>

        {/* Input (disabled placeholder) */}
        <form
          className="border-t border-[var(--border-color)] p-3"
          onSubmit={(e) => {
            e.preventDefault()
            setDraft('')
          }}
        >
          <label className="relative flex items-center">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled
              placeholder="Disponible au Module 15…"
              className="h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] pl-3 pr-10 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--memovia-violet)] focus:outline-none focus:ring-2 focus:ring-[var(--memovia-violet)]/15 disabled:cursor-not-allowed disabled:opacity-70"
            />
            <button
              type="submit"
              disabled
              aria-label="Envoyer"
              className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-[var(--memovia-violet)] text-white opacity-50"
            >
              <Send className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </label>
        </form>
      </aside>
    </>
  )
}
