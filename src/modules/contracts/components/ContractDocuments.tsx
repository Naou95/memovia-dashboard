import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Upload, Download, Trash2, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  useContractDocuments,
  type ContractDocument,
} from '@/hooks/useContractDocuments'

interface ContractDocumentsProps {
  open: boolean
  onClose: () => void
  contractId: string
  contractName: string
  canDelete: boolean
}

const ACCEPTED = '.pdf,.doc,.docx'
const ACCEPTED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_SIZE_MB = 20

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function FileIcon() {
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--accent-purple-bg)]">
      <FileText className="h-4 w-4 text-[var(--memovia-violet)]" />
    </div>
  )
}

export function ContractDocuments({
  open,
  onClose,
  contractId,
  contractName,
  canDelete,
}: ContractDocumentsProps) {
  const { documents, isLoading, error, uploadDocument, downloadDocument, deleteDocument } =
    useContractDocuments(contractId)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file: File) {
    if (!ACCEPTED_MIME.includes(file.type)) {
      toast.error('Format non supporté. Utilisez PDF ou DOCX.')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${MAX_SIZE_MB} Mo).`)
      return
    }

    setUploading(true)
    try {
      await uploadDocument(file)
      toast.success(`"${file.name}" uploadé avec succès.`)
    } catch {
      toast.error("Erreur lors de l'upload. Veuillez réessayer.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  async function handleDownload(doc: ContractDocument) {
    setDownloadingId(doc.id)
    try {
      await downloadDocument(doc)
    } catch {
      toast.error('Impossible de générer le lien de téléchargement.')
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleDelete(doc: ContractDocument) {
    setDeletingId(doc.id)
    try {
      await deleteDocument(doc)
      toast.success(`"${doc.file_name}" supprimé.`)
    } catch {
      toast.error('Impossible de supprimer le document.')
    } finally {
      setDeletingId(null)
      setConfirmingId(null)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
          {/* Header */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
            <div>
              <Dialog.Title className="text-[15px] font-semibold text-[var(--text-primary)]">
                Documents
              </Dialog.Title>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{contractName}</p>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Upload zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 transition-colors cursor-pointer"
              style={{
                borderColor: dragOver ? 'var(--memovia-violet)' : 'var(--border-color)',
                backgroundColor: dragOver ? 'var(--accent-purple-bg)' : 'var(--bg-primary)',
              }}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={handleInputChange}
                disabled={uploading}
              />
              {uploading ? (
                <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Upload en cours…
                </div>
              ) : (
                <>
                  <Upload className="mb-2 h-5 w-5 text-[var(--text-muted)]" />
                  <p className="text-[13px] font-medium text-[var(--text-secondary)]">
                    Glissez un fichier ou{' '}
                    <span className="text-[var(--memovia-violet)]">cliquez pour parcourir</span>
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    PDF, DOC, DOCX — max {MAX_SIZE_MB} Mo
                  </p>
                </>
              )}
            </div>

            {/* Error */}
            {error && !isLoading && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {error}
              </div>
            )}

            {/* Document list */}
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg p-3">
                    <div className="h-8 w-8 animate-pulse rounded-lg bg-[var(--border-color)]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--border-color)]" />
                      <div className="h-2.5 w-1/3 animate-pulse rounded bg-[var(--border-color)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]" />
                <p className="text-[14px] font-medium text-[var(--text-primary)]">
                  Aucun document
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                  Uploadez le premier fichier pour ce contrat.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-color)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-[var(--accent-purple-bg)]"
                  >
                    <FileIcon />

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                        {doc.file_name}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {formatBytes(doc.file_size)} · {formatDate(doc.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-shrink-0 items-center gap-1">
                      {/* Download */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingId === doc.id}
                        className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-[var(--memovia-violet)]"
                      >
                        {downloadingId === doc.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        <span className="sr-only">Télécharger</span>
                      </Button>

                      {/* Delete (admin_full only) */}
                      {canDelete && (
                        confirmingId === doc.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmingId(null)}
                              className="h-7 px-2 text-[11px] text-[var(--text-muted)]"
                            >
                              Annuler
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(doc)}
                              disabled={deletingId === doc.id}
                              className="h-7 px-2 text-[11px] text-[var(--danger)] hover:bg-[var(--trend-down-bg)]"
                            >
                              {deletingId === doc.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                'Supprimer'
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmingId(doc.id)}
                            className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-[var(--danger)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Supprimer</span>
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
