import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Sparkles, X, Send, Bot, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { useCopilot, type CopilotMessage, type ChatMessage } from '@/hooks/useCopilot'
import { TaskCard } from './TaskCard'
import { LeadCard } from './LeadCard'
import { ContractCard } from './ContractCard'

const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  p: ({ children }) => <p className="mb-1 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h1 className="mb-1 text-[15px] font-bold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-1 text-[14px] font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 text-[13px] font-semibold">{children}</h3>,
  hr: () => <hr className="my-2 border-[var(--border-color)]" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[var(--memovia-violet)] pl-2 italic opacity-80">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre className="my-1.5 overflow-x-auto rounded-lg bg-[var(--bg-secondary)] p-2.5 text-[11px] font-mono">
      {children}
    </pre>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-[var(--bg-secondary)] px-1 py-0.5 text-[11px] font-mono">
        {children}
      </code>
    ),
  table: ({ children }) => (
    <div className="my-1.5 overflow-x-auto rounded-lg border border-[var(--border-color)]">
      <table className="w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[var(--bg-secondary)]">{children}</thead>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-[var(--border-color)] last:border-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-1.5 text-left font-semibold text-[var(--text-primary)]">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 text-[var(--text-secondary)]">{children}</td>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--memovia-violet)] underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
}

const quickChips = [
  'Quel est notre MRR ?',
  'Solde Qonto actuel ?',
  'Tâches en cours ?',
  'Quels leads sont en attente ?',
  'Ajoute une tâche assignée à Emir',
  'Contrats actifs ?',
]

function renderToolCard(msg: CopilotMessage) {
  if (!('type' in msg) || msg.type !== 'tool_result') return null
  const { tool } = msg
  if (tool.kind === 'task') return <TaskCard data={tool.data} />
  if (tool.kind === 'lead') return <LeadCard data={tool.data} />
  if (tool.kind === 'contract') return <ContractCard data={tool.data} />
  return null
}

export function CopilotBubble() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const { messages, isStreaming, contextReady, contextLoading, sendMessage, clearHistory } = useCopilot(open)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/copilot') setOpen(true)
  }, [location.pathname])

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
          'h-[min(560px,calc(100vh-8rem))] rounded-[12px] border border-[var(--border-color)]',
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
              {messages.map((message) => {
                if ('type' in message && message.type === 'tool_result') {
                  return (
                    <div key={message.id} className="pl-9">
                      {renderToolCard(message)}
                    </div>
                  )
                }

                const chatMsg = message as ChatMessage
                return (
                  <div
                    key={chatMsg.id}
                    className={cn(
                      'flex items-start gap-2.5',
                      chatMsg.role === 'user' && 'flex-row-reverse',
                    )}
                  >
                    {chatMsg.role === 'assistant' && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--memovia-violet-light)]">
                        <Sparkles
                          className="h-3.5 w-3.5 text-[var(--memovia-violet)]"
                          strokeWidth={2.25}
                        />
                      </div>
                    )}

                    <div
                      className={cn(
                        'max-w-[80%] px-3 py-2 text-[13px]',
                        chatMsg.role === 'user'
                          ? 'rounded-2xl rounded-tr-md bg-[var(--memovia-violet)] text-white'
                          : 'rounded-2xl rounded-tl-md bg-[var(--bg-primary)] text-[var(--text-primary)]',
                      )}
                      style={chatMsg.role === 'user' ? { whiteSpace: 'pre-wrap' } : undefined}
                    >
                      {chatMsg.role === 'assistant' ? (
                        <>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={mdComponents}
                          >
                            {chatMsg.content}
                          </ReactMarkdown>
                          {chatMsg.streaming && (
                            <span className="mt-1 inline-flex gap-0.5">
                              {[0, 1, 2].map((i) => (
                                <span
                                  key={i}
                                  className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60 animate-bounce"
                                  style={{ animationDelay: `${i * 150}ms` }}
                                />
                              ))}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {chatMsg.content}
                          {chatMsg.streaming && (
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
                        </>
                      )}
                    </div>
                  </div>
                )
              })}

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
