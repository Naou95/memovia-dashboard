import { useMemo, useState } from 'react'
import { Check, X, ExternalLink, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMilestones } from '@/hooks/useMilestones'
import {
  groupMilestones,
  categorizeMilestone,
  stripTechPrefix,
  MILESTONE_PRODUCT_LABELS,
  MILESTONE_CATEGORY_LABELS,
} from '@/types/milestones'
import type { Milestone, MilestoneCategory } from '@/types/milestones'

// Historique produit (mémoire d'entreprise, 21/08/2026) : timeline des jalons
// retenus + tri des candidats versés chaque lundi par changelog-collect.
// Habillage non-tech (retour Naoufel) : phrase en clair (Gemini, relue au tri),
// produit nommé, badge de catégorie ; le titre technique reste au survol + lien PR.

const CATEGORY_STYLES: Record<MilestoneCategory, React.CSSProperties> = {
  nouveaute: {
    backgroundColor: 'color-mix(in oklab, var(--memovia-violet) 12%, var(--bg-primary))',
    color: 'var(--memovia-violet)',
  },
  correction: { backgroundColor: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' },
  securite: { backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' },
  accessibilite: {
    backgroundColor: 'color-mix(in oklab, var(--success) 15%, var(--bg-primary))',
    color: 'var(--success)',
  },
  design: { backgroundColor: 'color-mix(in oklab, #f59e0b 12%, var(--bg-primary))', color: '#b45309' },
  technique: { backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function monthKey(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function displayTitle(m: Milestone): string {
  return m.title_public ?? stripTechPrefix(m.title)
}

function CategoryBadge({ title }: { title: string }) {
  const cat = categorizeMilestone(title)
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={CATEGORY_STYLES[cat]}>
      {MILESTONE_CATEGORY_LABELS[cat]}
    </span>
  )
}

function ProductChip({ repo }: { repo: string }) {
  return (
    <span className="rounded bg-[var(--bg-primary)] px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]">
      {MILESTONE_PRODUCT_LABELS[repo] ?? repo}
    </span>
  )
}

export default function HistoriquePage() {
  const { milestones, isLoading, error, setStatus, updateTitle } = useMilestones()
  const { retenus, candidats } = useMemo(() => groupMilestones(milestones), [milestones])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const parMois = useMemo(() => {
    const groups: Array<{ mois: string; items: Milestone[] }> = []
    for (const item of retenus) {
      const mois = monthKey(item.date)
      const last = groups[groups.length - 1]
      if (last && last.mois === mois) last.items.push(item)
      else groups.push({ mois, items: [item] })
    }
    return groups
  }, [retenus])

  async function handleTri(m: Milestone, status: 'retenu' | 'ecarte') {
    try {
      await setStatus(m.id, status)
      toast.success(status === 'retenu' ? 'Ajouté à l\'historique.' : 'Écarté.')
    } catch {
      toast.error('Impossible de trier cette entrée.')
    }
  }

  function startEdit(m: Milestone) {
    setEditingId(m.id)
    setEditValue(displayTitle(m))
  }

  async function saveEdit(id: string) {
    try {
      await updateTitle(id, editValue)
      setEditingId(null)
      toast.success('Phrase mise à jour.')
    } catch {
      toast.error('Impossible d\'enregistrer.')
    }
  }

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.header variants={staggerItem}>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Historique produit
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Ce qui a changé dans MEMOVIA, daté et sourcé — en français normal.
        </p>
      </motion.header>

      {error && !isLoading && (
        <motion.div variants={staggerItem} className="rounded-md border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </motion.div>
      )}

      {/* ── Candidats à trier ────────────────────────────────────────────────── */}
      {candidats.length > 0 && (
        <motion.section
          variants={staggerItem}
          className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-[var(--shadow-xs)]"
        >
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
            {candidats.length} changement{candidats.length > 1 ? 's' : ''} à trier
          </h2>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            « Retenir » = ça entre dans l'histoire de MEMOVIA. « Écarter » = détail technique, on n'en parle plus.
            Le crayon corrige la phrase si elle est mal dite.
          </p>
          <ul className="mt-3 divide-y divide-[var(--border-color)]">
            {candidats.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="text-[13px] tabular-nums text-[var(--text-muted)]">{formatDate(m.date)}</span>
                <ProductChip repo={m.repo} />
                <CategoryBadge title={m.title} />
                {editingId === m.id ? (
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(m.id); if (e.key === 'Escape') setEditingId(null) }}
                      className="h-7 flex-1 text-[13px]"
                      autoFocus
                    />
                    <Button size="sm" className="h-7 px-2 text-[12px]" onClick={() => saveEdit(m.id)}>OK</Button>
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]" title={m.title}>
                    {displayTitle(m)}
                  </span>
                )}
                {editingId !== m.id && (
                  <button onClick={() => startEdit(m)} aria-label="Corriger la phrase" className="text-[var(--text-muted)] hover:text-[var(--memovia-violet)]">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {m.source_url && (
                  <a href={m.source_url} target="_blank" rel="noreferrer" aria-label="Voir le détail technique" className="text-[var(--text-muted)] hover:text-[var(--memovia-violet)]">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[12px]" onClick={() => handleTri(m, 'retenu')}>
                    <Check className="h-3 w-3" /> Retenir
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[12px] text-[var(--text-muted)]" onClick={() => handleTri(m, 'ecarte')}>
                    <X className="h-3 w-3" /> Écarter
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {/* ── Timeline des retenus ─────────────────────────────────────────────── */}
      <motion.section variants={staggerItem} className="space-y-5">
        {isLoading && retenus.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">Chargement…</p>
        )}
        {!isLoading && !error && retenus.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">
            Rien de retenu pour l'instant — trie les changements ci-dessus, ou attends le backfill de l'historique.
          </p>
        )}
        {parMois.map(({ mois, items }) => (
          <div key={mois}>
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--text-label)]">{mois}</h2>
            <ul className="mt-2 divide-y divide-[var(--border-color)] rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 shadow-[var(--shadow-xs)]">
              {items.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <span className="w-14 shrink-0 text-[13px] tabular-nums text-[var(--text-muted)]">{formatDate(m.date)}</span>
                  <ProductChip repo={m.repo} />
                  <CategoryBadge title={m.title} />
                  <span className="min-w-0 flex-1 text-sm text-[var(--text-primary)]" title={m.title}>
                    {displayTitle(m)}
                  </span>
                  {m.detail && <span className="basis-full pl-14 text-[13px] text-[var(--text-secondary)]">{m.detail}</span>}
                  {m.source_url && (
                    <a href={m.source_url} target="_blank" rel="noreferrer" aria-label="Voir le détail technique" className="text-[var(--text-muted)] hover:text-[var(--memovia-violet)]">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </motion.section>
    </motion.div>
  )
}
