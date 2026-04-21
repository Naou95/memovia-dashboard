import { useState, useEffect } from 'react'
import { X, Video, Copy, ExternalLink, Loader2, Calendar, UserCheck, Users, CalendarPlus } from 'lucide-react'
import { toast } from 'sonner'
import type { CreateMeetPayload, CreateMeetResponse } from '@/types/calendar'

interface Props {
  isOpen: boolean
  defaultStart?: Date
  defaultEnd?: Date
  onClose: () => void
  onCreateEvent: (payload: CreateMeetPayload) => Promise<CreateMeetResponse>
  inviteNaoufel?: boolean
}

function formatDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function CreateEventModal({ isOpen, defaultStart, defaultEnd, onClose, onCreateEvent, inviteNaoufel = false }: Props) {
  const [title, setTitle] = useState('')
  const [startStr, setStartStr] = useState('')
  const [endStr, setEndStr] = useState('')
  const [description, setDescription] = useState('')
  const [participants, setParticipants] = useState('')
  const [withMeet, setWithMeet] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CreateMeetResponse | null>(null)

  useEffect(() => {
    if (isOpen) {
      const now = new Date()
      const in30 = new Date(now.getTime() + 30 * 60 * 1000)
      const in60 = new Date(now.getTime() + 60 * 60 * 1000)
      setStartStr(formatDatetimeLocal(defaultStart ?? in30))
      setEndStr(formatDatetimeLocal(defaultEnd ?? in60))
      setTitle('')
      setDescription('')
      setParticipants('')
      setWithMeet(false)
      setResult(null)
      setLoading(false)
    }
  }, [isOpen, defaultStart, defaultEnd])

  function handleClose() {
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    const participantEmails = participants
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.includes('@'))

    setLoading(true)
    try {
      const response = await onCreateEvent({
        title: title.trim(),
        start: new Date(startStr).toISOString(),
        end: new Date(endStr).toISOString(),
        description: description.trim() || undefined,
        timezone: 'Europe/Paris',
        inviteAdminFull: inviteNaoufel,
        withMeet,
        attendees: participantEmails.length > 0 ? participantEmails : undefined,
      })
      setResult(response)
      toast.success('Événement créé avec succès !')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de créer l'événement")
    } finally {
      setLoading(false)
    }
  }

  function copyMeetLink() {
    if (result?.meetLink) {
      navigator.clipboard.writeText(result.meetLink)
      toast.success('Lien Meet copié !')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--memovia-violet-light)]">
              <CalendarPlus className="h-4 w-4 text-[var(--memovia-violet)]" />
            </div>
            <span className="text-[15px] font-semibold text-[var(--text-primary)]">
              Nouvel événement
            </span>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {result ? (
          /* Success state */
          <div className="flex flex-col gap-5 p-5">
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--trend-up-bg)]">
                <Calendar className="h-6 w-6 text-[var(--accent-mint)]" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">{result.title}</p>
                <p className="text-[13px] text-[var(--text-secondary)]">
                  Événement créé dans Google Calendar
                  {inviteNaoufel && ' · Naoufel invité'}
                </p>
              </div>
            </div>

            {result.meetLink && (
              <div className="rounded-xl border border-[var(--memovia-violet)] bg-[var(--memovia-violet-light)] p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--memovia-violet)]">
                  Lien Google Meet
                </p>
                <p className="mb-3 break-all text-[13px] font-mono text-[var(--text-primary)]">
                  {result.meetLink}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={copyMeetLink}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--memovia-violet)] py-2 text-[13px] font-medium text-white hover:bg-[var(--memovia-violet-hover)] transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copier le lien
                  </button>
                  <a
                    href={result.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 rounded-lg border border-[var(--memovia-violet)] px-3 py-2 text-[13px] text-[var(--memovia-violet)] hover:bg-[var(--memovia-violet-light)] transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ouvrir
                  </a>
                </div>
              </div>
            )}

            {result.htmlLink && (
              <a
                href={result.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Voir dans Google Calendar
              </a>
            )}

            <button
              onClick={handleClose}
              className="h-9 rounded-lg border border-[var(--border-color)] text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition-colors"
            >
              Fermer
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
            {inviteNaoufel && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--memovia-violet)] bg-[var(--memovia-violet-light)] px-3 py-2">
                <UserCheck className="h-4 w-4 shrink-0 text-[var(--memovia-violet)]" />
                <p className="text-[12px] text-[var(--memovia-violet)] font-medium">
                  Naoufel sera automatiquement invité à cet événement.
                </p>
              </div>
            )}

            {/* Titre */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                Titre <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Sync hebdo MEMOVIA"
                className="h-9 rounded-lg border border-[var(--border-color)] bg-white px-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--memovia-violet)] focus:ring-2 focus:ring-[var(--memovia-violet)]/20 transition-colors"
                required
                autoFocus
              />
            </div>

            {/* Date/heure */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-[var(--text-secondary)]">Début</label>
                <input
                  type="datetime-local"
                  value={startStr}
                  onChange={(e) => setStartStr(e.target.value)}
                  className="h-9 rounded-lg border border-[var(--border-color)] bg-white px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-2 focus:ring-[var(--memovia-violet)]/20 transition-colors"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-[var(--text-secondary)]">Fin</label>
                <input
                  type="datetime-local"
                  value={endStr}
                  onChange={(e) => setEndStr(e.target.value)}
                  className="h-9 rounded-lg border border-[var(--border-color)] bg-white px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-2 focus:ring-[var(--memovia-violet)]/20 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                Description <span className="text-[var(--text-muted)]">(optionnel)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ordre du jour, notes..."
                rows={2}
                className="resize-none rounded-lg border border-[var(--border-color)] bg-white px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--memovia-violet)] focus:ring-2 focus:ring-[var(--memovia-violet)]/20 transition-colors"
              />
            </div>

            {/* Participants */}
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
                <Users className="h-3.5 w-3.5" />
                Participants <span className="text-[var(--text-muted)]">(optionnel)</span>
              </label>
              <input
                type="text"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="email1@ex.com, email2@ex.com"
                className="h-9 rounded-lg border border-[var(--border-color)] bg-white px-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--memovia-violet)] focus:ring-2 focus:ring-[var(--memovia-violet)]/20 transition-colors"
              />
            </div>

            {/* Toggle Google Meet */}
            <button
              type="button"
              onClick={() => setWithMeet((v) => !v)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] transition-all ${
                withMeet
                  ? 'border-[var(--memovia-violet)] bg-[var(--memovia-violet-light)] text-[var(--memovia-violet)]'
                  : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--memovia-violet)]/40 hover:text-[var(--text-primary)]'
              }`}
            >
              <Video className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 text-left">Ajouter un lien Google Meet</span>
              {/* Mini toggle pill */}
              <div
                className={`relative h-4 w-7 rounded-full transition-colors ${
                  withMeet ? 'bg-[var(--memovia-violet)]' : 'bg-[var(--border-color)]'
                }`}
              >
                <div
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                    withMeet ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </button>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 h-9 rounded-lg border border-[var(--border-color)] text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="flex flex-1 items-center justify-center gap-2 h-9 rounded-lg bg-[var(--memovia-violet)] text-[13px] font-medium text-white hover:bg-[var(--memovia-violet-hover)] disabled:opacity-60 transition-colors"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarPlus className="h-4 w-4" />
                )}
                {loading ? 'Création…' : 'Créer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
