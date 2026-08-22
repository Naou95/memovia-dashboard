import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import * as Dialog from '@radix-ui/react-dialog'
import { motion } from 'framer-motion'
import { Plus, X, Trash2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { useRoadmap } from '@/hooks/useRoadmap'
import type { RoadmapItem, Horizon } from '@/types/roadmap'
import { HORIZON_ORDER, HORIZON_LABELS, HORIZON_HINTS } from '@/types/roadmap'

// Étiquettes connues = couleur ; le reste retombe en neutre (le tag est libre).
const TAG_STYLE: Record<string, { bg: string; fg: string }> = {
  'en cours': { bg: 'rgba(124,58,237,0.12)', fg: '#6D28D9' },
  'à trancher lundi': { bg: 'var(--danger-bg)', fg: 'var(--danger)' },
  '2 temps': { bg: 'var(--accent-blue-bg)', fg: 'var(--accent-blue)' },
  exploration: { bg: 'rgba(180,83,9,0.12)', fg: '#92400E' },
}
const NEUTRAL_TAG = { bg: 'var(--bg-primary)', fg: 'var(--text-secondary)' }

const inputClass =
  'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--memovia-violet)] focus:ring-1 focus:ring-[var(--memovia-violet)]'

function Card({ item, onOpen }: { item: RoadmapItem; onOpen: (i: RoadmapItem) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id })
  const tag = item.tag ? TAG_STYLE[item.tag] ?? NEUTRAL_TAG : null

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(item)}
      style={{
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="cursor-grab rounded-xl bg-[var(--bg-primary)] p-3.5 text-left active:cursor-grabbing"
    >
      <p className="text-[13px] font-bold leading-snug text-[var(--text-primary)]">{item.title}</p>
      {tag && (
        <span
          className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: tag.bg, color: tag.fg }}
        >
          {item.tag}
        </span>
      )}
      {item.why && (
        <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-primary)]">Pourquoi : </span>
          {item.why}
        </p>
      )}
    </div>
  )
}

function Column({
  horizon,
  items,
  onOpen,
  onAdd,
}: {
  horizon: Horizon
  items: RoadmapItem[]
  onOpen: (i: RoadmapItem) => void
  onAdd: (h: Horizon) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: horizon })

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-[220px] flex-col rounded-[var(--radius-card)] border bg-[var(--bg-secondary)] p-3 shadow-[var(--shadow-xs)] transition-colors ${
        isOver ? 'border-[var(--memovia-violet)]' : 'border-[var(--border-color)]'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-bold text-[var(--text-primary)]">
            {HORIZON_LABELS[horizon]}
            <span className="ml-1.5 text-[12px] font-semibold text-[var(--text-muted)]">{items.length}</span>
          </h2>
          <p className="text-[11px] text-[var(--text-secondary)]">{HORIZON_HINTS[horizon]}</p>
        </div>
        <button
          type="button"
          onClick={() => onAdd(horizon)}
          aria-label={`Ajouter dans ${HORIZON_LABELS[horizon]}`}
          className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.id} item={item} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}

/** Brouillon d'édition : une carte existante, ou une carte neuve dans une colonne. */
type Draft = { item: RoadmapItem | null; horizon: Horizon }

export default function RoadmapProduitPage() {
  const { items, isLoading, error, createItem, updateItem, deleteItem, moveItem } = useRoadmap()
  const [dragging, setDragging] = useState<RoadmapItem | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [form, setForm] = useState({ title: '', tag: '', why: '', horizon: 'maintenant' as Horizon })
  const [isSaving, setIsSaving] = useState(false)

  // 6 px de garde : sans ça le clic d'ouverture de la fiche est mangé par le drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function openDraft(item: RoadmapItem | null, horizon: Horizon) {
    setDraft({ item, horizon })
    setForm({
      title: item?.title ?? '',
      tag: item?.tag ?? '',
      why: item?.why ?? '',
      horizon: item?.horizon ?? horizon,
    })
  }

  async function save() {
    if (!draft || !form.title.trim()) return
    setIsSaving(true)
    const payload = {
      title: form.title.trim(),
      tag: form.tag.trim() || null,
      why: form.why.trim() || null,
      horizon: form.horizon,
    }
    try {
      if (draft.item) await updateItem(draft.item.id, payload)
      else await createItem(payload)
      setDraft(null)
      toast.success(draft.item ? 'Ligne mise à jour.' : 'Ligne ajoutée.')
    } catch {
      toast.error('Sauvegarde impossible.')
    } finally {
      setIsSaving(false)
    }
  }

  async function remove() {
    if (!draft?.item) return
    setIsSaving(true)
    try {
      await deleteItem(draft.item.id)
      setDraft(null)
      toast.success('Ligne supprimée.')
    } catch {
      toast.error('Suppression impossible.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleDragStart(e: DragStartEvent) {
    setDragging(items.find((i) => i.id === e.active.id) ?? null)
  }

  async function handleDragEnd(e: DragEndEvent) {
    setDragging(null)
    const target = e.over?.id as Horizon | undefined
    const item = items.find((i) => i.id === e.active.id)
    if (!target || !item || item.horizon === target) return
    try {
      await moveItem(item.id, target)
    } catch {
      toast.error('Déplacement impossible.')
    }
  }

  return (
    <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="show">
      <motion.header variants={staggerItem}>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Roadmap</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Ce qu'on construit et POURQUOI. Chaque ligne vient d'une demande terrain datée, jamais d'une envie de
          feature — et rien de daté n'est promis à un client. Glisse une carte pour changer d'horizon.
        </p>
      </motion.header>

      {error && <p className="text-[13px] text-[var(--danger)]">{error}</p>}
      {isLoading && <p className="text-[13px] text-[var(--text-muted)]">Chargement…</p>}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <motion.div variants={staggerItem} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {HORIZON_ORDER.map((h) => (
            <Column
              key={h}
              horizon={h}
              items={items.filter((i) => i.horizon === h)}
              onOpen={(i) => openDraft(i, h)}
              onAdd={(hz) => openDraft(null, hz)}
            />
          ))}
        </motion.div>
        <DragOverlay>
          {dragging && (
            <div className="rounded-xl border border-[var(--memovia-violet)] bg-[var(--bg-secondary)] p-3.5 shadow-lg">
              <p className="text-[13px] font-bold text-[var(--text-primary)]">{dragging.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <Dialog.Root open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-0 top-0 z-50 h-[100dvh] w-full overflow-y-auto bg-[var(--bg-secondary)] p-4 shadow-xl sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:w-[calc(100vw-2rem)] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:border-[var(--border-color)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-2">
              <Dialog.Title className="text-[16px] font-semibold text-[var(--text-primary)]">
                {draft?.item ? 'Modifier la ligne' : 'Nouvelle ligne'}
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

            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Ligne</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Horizon</span>
                  <select
                    value={form.horizon}
                    onChange={(e) => setForm({ ...form, horizon: e.target.value as Horizon })}
                    className={`mt-1 ${inputClass}`}
                  >
                    {HORIZON_ORDER.map((h) => (
                      <option key={h} value={h}>
                        {HORIZON_LABELS[h]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Étiquette</span>
                  <input
                    value={form.tag}
                    onChange={(e) => setForm({ ...form, tag: e.target.value })}
                    placeholder="en cours, exploration…"
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Pourquoi</span>
                <textarea
                  value={form.why}
                  onChange={(e) => setForm({ ...form, why: e.target.value })}
                  rows={7}
                  placeholder="La demande terrain datée qui justifie cette ligne."
                  className={`mt-1 ${inputClass}`}
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              {draft?.item ? (
                <Button variant="outline" size="sm" onClick={remove} disabled={isSaving} className="gap-1 text-[var(--danger)]">
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
                  Annuler
                </Button>
                <Button size="sm" onClick={save} disabled={isSaving || !form.title.trim()} className="gap-1">
                  <Check className="h-3.5 w-3.5" />
                  {isSaving ? '…' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </motion.div>
  )
}
