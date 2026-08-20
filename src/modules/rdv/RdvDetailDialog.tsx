import { useState, useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Mic, Loader2, Pencil, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Rdv } from '@/types/rdv'

interface RdvDetailDialogProps {
  rdv: Rdv | null
  onClose: () => void
  onSaveCr: (id: string, cr: string) => Promise<void>
  onUploadAudio: (id: string, file: File) => Promise<void>
}

const mdClass =
  'text-sm text-[var(--text-primary)] [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-[12px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-[var(--text-secondary)] [&_p]:mt-1 [&_p]:leading-relaxed [&_ul]:mt-1 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-0.5'

/**
 * Fiche RDV (refonte v2 Phase 2) : compte rendu généré depuis l'audio ou saisi
 * à la main, éditable dans les deux cas. Transcription repliée sous le CR.
 */
export function RdvDetailDialog({ rdv, onClose, onSaveCr, onUploadAudio }: RdvDetailDialogProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditing(false)
    setDraft('')
    setIsUploading(false)
  }, [rdv?.id])

  if (!rdv) return null
  const enCours = rdv.cr_status === 'en_cours' || isUploading

  async function saveCr() {
    if (!rdv) return
    setIsSaving(true)
    try {
      await onSaveCr(rdv.id, draft)
      setEditing(false)
      toast.success('Compte rendu enregistré.')
    } catch {
      toast.error('Sauvegarde impossible.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !rdv) return
    setIsUploading(true)
    try {
      await onUploadAudio(rdv.id, file)
      toast.success('Compte rendu généré.')
    } catch {
      toast.error("Transcription impossible — réessaie ou saisis le CR à la main.")
    } finally {
      setIsUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const dateLabel = new Date(rdv.rdv_date).toLocaleString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })

  return (
    <Dialog.Root open onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-xl">
          <div className="mb-1 flex items-start justify-between gap-2">
            <Dialog.Title className="text-[16px] font-semibold text-[var(--text-primary)]">
              {rdv.title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <p className="mb-4 text-[13px] text-[var(--text-secondary)]">{dateLabel}</p>

          {/* Compte rendu */}
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
                Compte rendu
              </h3>
              {!editing && !enCours && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(rdv.cr ?? '')
                    setEditing(true)
                  }}
                  className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <Pencil className="h-3 w-3" />
                  {rdv.cr ? 'Modifier' : 'Saisir à la main'}
                </button>
              )}
            </div>

            {enCours ? (
              <div className="flex items-center gap-2 py-4 text-[13px] text-[var(--text-secondary)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Transcription et rédaction en cours…
              </div>
            ) : editing ? (
              <div className="space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={10}
                  placeholder={'## Contexte\n\n## Points clés\n\n## Décisions\n\n## Prochaine action'}
                  className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 font-mono text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                    Annuler
                  </Button>
                  <Button size="sm" onClick={saveCr} disabled={isSaving || !draft.trim()} className="gap-1">
                    <Check className="h-3.5 w-3.5" />
                    {isSaving ? '…' : 'Enregistrer'}
                  </Button>
                </div>
              </div>
            ) : rdv.cr ? (
              <div className={mdClass}>
                <ReactMarkdown>{rdv.cr}</ReactMarkdown>
              </div>
            ) : (
              <p className="py-2 text-[13px] text-[var(--text-muted)]">
                Pas encore de compte rendu. Uploade l'enregistrement, ou saisis-le à la main.
              </p>
            )}
          </div>

          {/* Audio → CR */}
          {!enCours && (
            <div className="mt-3">
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,video/*"
                onChange={handleFile}
                className="hidden"
                id="rdv-audio-input"
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                className="w-full gap-1.5"
              >
                <Mic className="h-4 w-4" />
                {rdv.audio_path ? 'Remplacer l\'audio (régénère le CR)' : 'Uploader l\'enregistrement'}
              </Button>
            </div>
          )}

          {/* Transcription brute, repliée */}
          {rdv.transcript && (
            <details className="mt-3 rounded-lg border border-[var(--border-color)] p-3">
              <summary className="cursor-pointer text-[12px] font-medium text-[var(--text-muted)]">
                Transcription brute
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--text-secondary)]">
                {rdv.transcript}
              </p>
            </details>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
