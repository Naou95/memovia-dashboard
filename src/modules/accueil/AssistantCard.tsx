import { useRef, useState } from 'react'
import { Send, Loader2, Check, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { supabase } from '@/lib/supabase'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  actions?: string[]
}

const SUGGESTIONS = [
  'Prépare-moi le prochain RDV',
  'Où en sont les financements ?',
  'Quel lead je relance en premier ?',
]

const mdClass =
  'text-[13px] leading-relaxed text-[var(--text-primary)] [&_p]:mt-1 [&_p:first-child]:mt-0 [&_ul]:mt-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mt-0.5 [&_strong]:font-semibold'

/**
 * Assistant IA de l'accueil (22/08/2026) : branché sur l'edge function
 * `accueil-assistant` — répond sur les données réelles (leads, RDV + CR,
 * financements) et peut agir (màj lead/financement, créer un RDV).
 */
export function AssistantCard({ firstName }: { firstName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function send(text: string) {
    const message = text.trim()
    if (!message || isLoading) return
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: message }]
    setMessages(nextMessages)
    setInput('')
    setIsLoading(true)
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)

    try {
      const { data, error } = await supabase.functions.invoke('accueil-assistant', {
        body: {
          message,
          history: nextMessages.slice(-12, -1).map(({ role, content }) => ({ role, content })),
        },
      })
      if (error || !data?.reply) throw error ?? new Error('empty reply')
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: String(data.reply), actions: data.actions ?? [] },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "L'assistant n'a pas répondu — réessaie dans un instant." },
      ])
    } finally {
      setIsLoading(false)
      setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)
    }
  }

  const empty = messages.length === 0

  return (
    <section
      className="flex h-full min-h-[380px] flex-col rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      aria-label="Assistant IA"
    >
      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {/* Orbe (clin d'œil à la maquette) */}
          <div
            className="mb-4 h-16 w-16 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 32% 28%, #E0EAFF 0%, #93B4FF 38%, #7C3AED 78%, #4C1D95 100%)',
              boxShadow: '0 10px 30px rgba(124,58,237,0.35), inset 0 -6px 14px rgba(255,255,255,0.35)',
            }}
            aria-hidden
          />
          <h2 className="text-[19px] font-semibold tracking-tight text-[var(--text-primary)]">
            {firstName ? `Bonjour, ${firstName}` : 'Bonjour'}
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
            Qu'est-ce que je peux faire pour vous ?
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] px-3.5 py-2.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--memovia-violet)] hover:text-[var(--memovia-violet)] md:py-1.5"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Assistant</h2>
          <button
            type="button"
            onClick={() => setMessages([])}
            className="flex items-center gap-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <RotateCcw className="h-3 w-3" />
            Nouvelle conversation
          </button>
        </div>
      )}

      {!empty && (
        <div ref={scrollRef} className="mb-3 flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--memovia-violet)] px-3.5 py-2 text-[13px] leading-relaxed text-white">
                  {m.content}
                </p>
              </div>
            ) : (
              <div key={i} className="max-w-[92%]">
                {m.actions && m.actions.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    {m.actions.map((a, j) => (
                      <span
                        key={j}
                        className="flex items-center gap-1 rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success)]"
                      >
                        <Check className="h-3 w-3" />
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                <div className="rounded-2xl rounded-bl-md bg-[var(--bg-primary)] px-3.5 py-2">
                  <div className={mdClass}>
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ),
          )}
          {isLoading && (
            <div className="flex items-center gap-2 px-1 text-[13px] text-[var(--text-muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Réflexion…
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 focus-within:border-[var(--memovia-violet)]"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pose une question, demande une action…"
          aria-label="Message à l'assistant"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          aria-label="Envoyer"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--memovia-violet)] text-white transition-opacity disabled:opacity-40 md:h-8 md:w-8"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  )
}
