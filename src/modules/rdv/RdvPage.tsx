import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, FileWarning, Loader2, FileCheck2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRdv } from '@/hooks/useRdv'
import { useLeads } from '@/hooks/useLeads'
import { RdvDetailDialog } from './RdvDetailDialog'
import type { Rdv } from '@/types/rdv'

const selectClass =
  'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]'

function CrBadge({ rdv }: { rdv: Rdv }) {
  const past = new Date(rdv.rdv_date).getTime() < Date.now()
  if (rdv.cr_status === 'en_cours') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-[var(--accent-purple-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--memovia-violet)]">
        <Loader2 className="h-3 w-3 animate-spin" /> Transcription
      </span>
    )
  }
  if (rdv.cr_status === 'fait') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-[rgba(16,185,129,0.12)] px-2 py-0.5 text-[11px] font-semibold text-[#059669]">
        <FileCheck2 className="h-3 w-3" /> CR fait
      </span>
    )
  }
  if (past) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--danger)]">
        <FileWarning className="h-3 w-3" /> CR manquant
      </span>
    )
  }
  return null
}

/**
 * RDV & comptes rendus (refonte v2 Phase 2). Un RDV passé sans CR est un état
 * anormal : badge rouge ici, relance quotidienne dans le briefing Telegram.
 */
export default function RdvPage() {
  const { rdvs, isLoading, error, createRdv, updateRdv, uploadAndTranscribe } = useRdv()
  const { leads } = useLeads()
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<Rdv | null>(null)
  const [title, setTitle] = useState('')
  const [dateTime, setDateTime] = useState('')
  const [leadId, setLeadId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const now = Date.now()
  const upcoming = rdvs.filter((r) => new Date(r.rdv_date).getTime() >= now).reverse()
  const past = rdvs.filter((r) => new Date(r.rdv_date).getTime() < now)
  const missingCount = past.filter((r) => r.cr_status === 'manquant').length
  const activeLeads = leads.filter((l) => !l.archived)

  // La liste vit en realtime : garder la fiche ouverte synchronisée (ex. CR qui
  // arrive pendant qu'on regarde la fiche).
  const selectedFresh = selected ? rdvs.find((r) => r.id === selected.id) ?? null : null

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !dateTime) return
    setIsSubmitting(true)
    try {
      await createRdv({
        title: title.trim(),
        rdv_date: new Date(dateTime).toISOString(),
        lead_id: leadId || null,
      })
      toast.success('RDV créé.')
      setCreateOpen(false)
      setTitle('')
      setDateTime('')
      setLeadId('')
    } catch {
      toast.error('Impossible de créer le RDV.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSaveCr(id: string, cr: string) {
    await updateRdv(id, { cr, cr_status: 'fait' })
  }

  function RdvList({ items, emptyLabel }: { items: Rdv[]; emptyLabel: string }) {
    if (items.length === 0) {
      return <p className="px-1 py-3 text-[13px] text-[var(--text-muted)]">{emptyLabel}</p>
    }
    return (
      <ul className="space-y-2">
        {items.map((rdv) => (
          <li key={rdv.id}>
            <button
              type="button"
              onClick={() => setSelected(rdv)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 text-left shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--memovia-violet)]"
            >
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-[var(--text-primary)]">
                  {rdv.title}
                </div>
                <div className="text-[12px] tabular-nums text-[var(--text-secondary)]">
                  {new Date(rdv.rdv_date).toLocaleString('fr-FR', {
                    weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
              <CrBadge rdv={rdv} />
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.header variants={staggerItem} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">RDV</h1>
            {!isLoading && missingCount > 0 && (
              <span className="rounded-full bg-[var(--danger-bg)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--danger)]">
                {missingCount} sans CR
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Un RDV = une fiche = un compte rendu. Enregistre, uploade, le CR s'écrit.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nouveau RDV
        </Button>
      </motion.header>

      {error && !isLoading && (
        <motion.div variants={staggerItem} className="rounded-md border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </motion.div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-[var(--border-color)]" />
          ))}
        </div>
      ) : (
        <>
          <motion.section variants={staggerItem}>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              À venir
            </h2>
            <RdvList items={upcoming} emptyLabel="Aucun RDV planifié." />
          </motion.section>

          <motion.section variants={staggerItem}>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Passés
            </h2>
            <RdvList items={past} emptyLabel="Aucun RDV passé." />
          </motion.section>
        </>
      )}

      {/* Création */}
      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Dialog.Title className="text-[16px] font-semibold text-[var(--text-primary)]">
                Nouveau RDV
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label="Fermer">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="rdv-title">
                  Titre <span className="text-[var(--danger)]">*</span>
                </Label>
                <Input
                  id="rdv-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex : Appel CFA Blagnac — démo"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rdv-date">
                  Date et heure <span className="text-[var(--danger)]">*</span>
                </Label>
                <Input
                  id="rdv-date"
                  type="datetime-local"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rdv-lead">Lead concerné</Label>
                <select id="rdv-lead" value={leadId} onChange={(e) => setLeadId(e.target.value)} className={selectClass}>
                  <option value="">— Aucun</option>
                  {activeLeads.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={!title.trim() || !dateTime || isSubmitting} className="w-full">
                {isSubmitting ? 'Création…' : 'Créer le RDV'}
              </Button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Fiche */}
      <RdvDetailDialog
        rdv={selectedFresh}
        onClose={() => setSelected(null)}
        onSaveCr={handleSaveCr}
        onUploadAudio={uploadAndTranscribe}
      />
    </motion.div>
  )
}
