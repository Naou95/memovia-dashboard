import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, Pencil, ExternalLink, AlarmClock } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useFinancements } from '@/hooks/useFinancements'
import type { Financement, FinancementInsert } from '@/types/financements'
import {
  FINANCEMENT_TYPE_LABELS,
  FINANCEMENT_STATUS_LABELS,
  FINANCEMENT_STATUS_ORDER,
} from '@/types/financements'

const selectClass =
  'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]'

const CLOSED_STATUSES = ['gagne', 'perdu', 'abandonne'] as const

function daysUntil(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
}

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return null
  const days = daysUntil(deadline)
  const label = new Date(deadline).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  const urgency =
    days < 0
      ? { text: `${label} — dépassé`, cls: 'bg-[var(--danger-bg)] text-[var(--danger)]' }
      : days <= 7
      ? { text: `${label} — J-${days}`, cls: 'bg-[var(--danger-bg)] text-[var(--danger)]' }
      : days <= 14
      ? { text: `${label} — J-${days}`, cls: 'bg-[rgba(245,158,11,0.12)] text-[#B45309]' }
      : { text: label, cls: 'bg-[var(--bg-primary)] text-[var(--text-secondary)]' }
  return (
    <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', urgency.cls)}>
      <AlarmClock className="h-3 w-3" />
      {urgency.text}
    </span>
  )
}

interface FormState {
  name: string
  type: string
  status: string
  deadline: string
  next_action: string
  assigned_to: string
  url: string
  notes: string
}

function emptyForm(): FormState {
  return { name: '', type: 'concours', status: 'veille', deadline: '', next_action: '', assigned_to: '', url: '', notes: '' }
}

function toForm(f: Financement): FormState {
  return {
    name: f.name,
    type: f.type,
    status: f.status,
    deadline: f.deadline ?? '',
    next_action: f.next_action ?? '',
    assigned_to: f.assigned_to ?? '',
    url: f.url ?? '',
    notes: f.notes ?? '',
  }
}

/**
 * Financements & concours (refonte v2 Phase 3) : où on en est, quand postuler,
 * on fait quoi concrètement. Les deadlines ≤ 14 j remontent dans le briefing.
 */
export default function FinancementsPage() {
  const { financements, isLoading, error, createFinancement, updateFinancement } = useFinancements()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Financement | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showClosed, setShowClosed] = useState(false)

  const sorted = [...financements].sort((a, b) => {
    const orderDiff =
      FINANCEMENT_STATUS_ORDER.indexOf(a.status) - FINANCEMENT_STATUS_ORDER.indexOf(b.status)
    if (orderDiff !== 0) return orderDiff
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline)
    return a.deadline ? -1 : b.deadline ? 1 : 0
  })
  const open = sorted.filter((f) => !CLOSED_STATUSES.includes(f.status as (typeof CLOSED_STATUSES)[number]))
  const closed = sorted.filter((f) => CLOSED_STATUSES.includes(f.status as (typeof CLOSED_STATUSES)[number]))

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setFormOpen(true)
  }

  function openEdit(f: Financement) {
    setEditing(f)
    setForm(toForm(f))
    setFormOpen(true)
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setIsSubmitting(true)
    try {
      const payload: FinancementInsert = {
        name: form.name.trim(),
        type: form.type as FinancementInsert['type'],
        status: form.status as FinancementInsert['status'],
        deadline: form.deadline || null,
        next_action: form.next_action.trim() || null,
        assigned_to: (form.assigned_to || null) as FinancementInsert['assigned_to'],
        url: form.url.trim() || null,
        notes: form.notes.trim() || null,
      }
      if (editing) {
        await updateFinancement(editing.id, payload)
        toast.success('Financement mis à jour.')
      } else {
        await createFinancement(payload)
        toast.success('Financement créé.')
      }
      setFormOpen(false)
    } catch {
      toast.error('Une erreur est survenue.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function Card({ f }: { f: Financement }) {
    return (
      <li className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold text-[var(--text-primary)]">{f.name}</span>
              {f.url && (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--text-muted)] hover:text-[var(--memovia-violet)]"
                  aria-label="Ouvrir le site"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">
              {FINANCEMENT_TYPE_LABELS[f.type]} · {FINANCEMENT_STATUS_LABELS[f.status]}
              {f.assigned_to ? ` · ${f.assigned_to === 'naoufel' ? 'Naoufel' : 'Emir'}` : ''}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DeadlineBadge deadline={f.deadline} />
            <button
              type="button"
              onClick={() => openEdit(f)}
              className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-[var(--memovia-violet)]"
              aria-label="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {f.next_action && (
          <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">À faire :</span> {f.next_action}
          </p>
        )}
        {f.notes && <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">{f.notes}</p>}
      </li>
    )
  }

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.header variants={staggerItem} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Financements
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Concours, subventions et prêts : statut, deadline, prochaine action.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nouveau
        </Button>
      </motion.header>

      {error && !isLoading && (
        <motion.div variants={staggerItem} className="rounded-md border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </motion.div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-[var(--border-color)]" />
          ))}
        </div>
      ) : (
        <>
          <motion.ul variants={staggerItem} className="space-y-3">
            {open.length === 0 ? (
              <p className="px-1 py-3 text-[13px] text-[var(--text-muted)]">Rien en cours.</p>
            ) : (
              open.map((f) => <Card key={f.id} f={f} />)
            )}
          </motion.ul>

          {closed.length > 0 && (
            <motion.div variants={staggerItem}>
              <button
                type="button"
                onClick={() => setShowClosed((v) => !v)}
                className="text-[12px] text-[var(--text-muted)] underline-offset-2 hover:underline"
              >
                {showClosed ? 'Masquer' : 'Afficher'} les clos ({closed.length})
              </button>
              {showClosed && (
                <ul className="mt-3 space-y-3 opacity-70">
                  {closed.map((f) => (
                    <Card key={f.id} f={f} />
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </>
      )}

      {/* Création / édition */}
      <Dialog.Root open={formOpen} onOpenChange={setFormOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Dialog.Title className="text-[16px] font-semibold text-[var(--text-primary)]">
                {editing ? 'Modifier' : 'Nouveau financement'}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label="Fermer">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fin-name">
                  Nom <span className="text-[var(--danger)]">*</span>
                </Label>
                <Input id="fin-name" name="name" value={form.name} onChange={handleChange} placeholder="Ex : Handitech Trophy" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fin-type">Type</Label>
                  <select id="fin-type" name="type" value={form.type} onChange={handleChange} className={selectClass}>
                    {Object.entries(FINANCEMENT_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fin-status">Statut</Label>
                  <select id="fin-status" name="status" value={form.status} onChange={handleChange} className={selectClass}>
                    {FINANCEMENT_STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>{FINANCEMENT_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fin-deadline">Deadline</Label>
                  <Input id="fin-deadline" name="deadline" type="date" value={form.deadline} onChange={handleChange} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fin-assigned">Qui</Label>
                  <select id="fin-assigned" name="assigned_to" value={form.assigned_to} onChange={handleChange} className={selectClass}>
                    <option value="">—</option>
                    <option value="naoufel">Naoufel</option>
                    <option value="emir">Emir</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fin-next">Prochaine action</Label>
                <Input id="fin-next" name="next_action" value={form.next_action} onChange={handleChange} placeholder="Quoi, concrètement" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fin-url">URL</Label>
                <Input id="fin-url" name="url" type="url" value={form.url} onChange={handleChange} placeholder="https://…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fin-notes">Notes</Label>
                <textarea
                  id="fin-notes"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={3}
                  className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]"
                />
              </div>
              <Button type="submit" disabled={!form.name.trim() || isSubmitting} className="w-full">
                {isSubmitting ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer'}
              </Button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </motion.div>
  )
}
