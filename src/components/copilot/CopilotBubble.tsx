import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, Send, Bot, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCopilot } from '@/hooks/useCopilot'

function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Split on **bold** and *italic*, preserve newlines via pre-wrap
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

const quickChips = [
  'Quel est notre MRR ?',
  'Solde Qonto actuel ?',
  'Tâches en cours ?',
  'Leads actifs ?',
]

export function CopilotBubble() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const { messages, isStreaming, contextReady, contextLoading, sendMessage, clearHistory } = useCopilot(open)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || isStreaming) return
    setDraft('')
    await sendMessage(text)
  }

  const handleChip = async (chip: string) => {
    if (isStreaming) return
    await sendMessage(chip)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fermer le copilote' : 'Ouvrir le copilote IA'}
        aria-expanded={open}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full',
          'bg-[var(--memovia-violet)] text-white shadow-lg shadow-[var(--memovia-violet)]/30',
          'transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-[var(--memovia-violet)]/40',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-2',
        )}
      >
        {open ? (
          <X className="h-5 w-5" strokeWidth={2.25} />
        ) : (
          <Sparkles className="h-5 w-5" strokeWidth={2.25} />
        )}
      </button>

      {open && (
        <button
          type="button"
          aria-label="Fermer"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-[var(--text-primary)]/10 backdrop-blur-[1px] transition-opacity"
        />
      )}

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
            : 'pointer-events-none scale-95 opacity-0',
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
            <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
              {contextLoading && (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              )}
              {contextLoading ? 'Chargement du contexte…' : contextReady ? 'En ligne' : 'Connexion…'}
            </div>
          </div>
          {messages.length > 0 && !isStreaming && (
            <button
              type="button"
              onClick={clearHistory}
              className="rounded-md px-2 py-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              Effacer
            </button>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--memovia-violet-light)]">
                  <Sparkles
                    className="h-3.5 w-3.5 text-[var(--memovia-violet)]"
                    strokeWidth={2.25}
                  />
                </div>
                <div className="rounded-2xl rounded-tl-md bg-[var(--bg-primary)] px-3 py-2 text-[13px] leading-relaxed text-[var(--text-primary)]">
                  Bonjour ! Je suis ton copilote interne. Je suis connecté à tes
                  modules (Stripe, Qonto, CRM, Tâches…) et prêt à répondre à tes
                  questions métier.
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pl-9">
                {quickChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleChip(chip)}
                    disabled={isStreaming}
                    className="rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] transition-colors hover:border-[var(--memovia-violet)] hover:text-[var(--memovia-violet)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex items-start gap-2.5',
                    message.role === 'user' && 'flex-row-reverse',
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--memovia-violet-light)]">
                      <Sparkles
                        className="h-3.5 w-3.5 text-[var(--memovia-violet)]"
                        strokeWidth={2.25}
                      />
                    </div>
                  )}

                  <div
                    className={cn(
                      'max-w-[80%] px-3 py-2 text-[13px] leading-relaxed',
                      message.role === 'user'
                        ? 'rounded-2xl rounded-tr-md bg-[var(--memovia-violet)] text-white'
                        : 'rounded-2xl rounded-tl-md bg-[var(--bg-primary)] text-[var(--text-primary)]',
                    )}
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {message.role === 'assistant'
                      ? renderInlineMarkdown(message.content)
                      : message.content}
                    {message.streaming && (
                      <span className="ml-1 inline-flex gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60 animate-bounce"
                            style={{ animationDelay: `${i * 150}ms` }}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {messages.length === 1 && (
                <div className="flex flex-wrap gap-1.5 pl-9">
                  {quickChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleChip(chip)}
                      disabled={isStreaming}
                      className="rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] transition-colors hover:border-[var(--memovia-violet)] hover:text-[var(--memovia-violet)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          className="border-t border-[var(--border-color)] p-3"
          onSubmit={handleSubmit}
        >
          <label className="relative flex items-center">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={isStreaming}
              placeholder="Posez votre question…"
              className="h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] pl-3 pr-10 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--memovia-violet)] focus:outline-none focus:ring-2 focus:ring-[var(--memovia-violet)]/15 disabled:cursor-not-allowed disabled:opacity-70"
            />
            <button
              type="submit"
              disabled={isStreaming || !draft.trim()}
              aria-label="Envoyer"
              className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-[var(--memovia-violet)] text-white transition-opacity disabled:opacity-40"
            >
              {isStreaming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
              ) : (
                <Send className="h-3.5 w-3.5" strokeWidth={2.25} />
              )}
            </button>
          </label>
        </form>
      </aside>
    </>
  )
}
