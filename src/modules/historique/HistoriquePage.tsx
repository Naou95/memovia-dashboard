import { useMemo } from 'react'
import { Check, X, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { useMilestones } from '@/hooks/useMilestones'
import { groupMilestones } from '@/types/milestones'
import type { Milestone } from '@/types/milestones'

// Historique produit (mémoire d'entreprise, 21/08/2026) : timeline des jalons
// retenus + tri des candidats versés chaque lundi par changelog-collect.
// Règles v2 : erreur affichée jamais silencieuse, tables denses, deep link PR.

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function monthKey(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export default function HistoriquePage() {
  const { milestones, isLoading, error, setStatus } = useMilestones()
  const { retenus, candidats } = useMemo(() => groupMilestones(milestones), [milestones])

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
      toast.success(status === 'retenu' ? `« ${m.title} » retenu.` : `« ${m.title} » écarté.`)
    } catch {
      toast.error('Impossible de trier ce jalon.')
    }
  }

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.header variants={staggerItem}>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Historique produit
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Les jalons MEMOVIA, datés et sourcés (PRs mergées des 5 dépôts).
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
            {candidats.length} candidat{candidats.length > 1 ? 's' : ''} à trier
          </h2>
          <ul className="mt-3 divide-y divide-[var(--border-color)]">
            {candidats.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="text-[13px] tabular-nums text-[var(--text-muted)]">{formatDate(m.date)}</span>
                <span className="rounded bg-[var(--bg-primary)] px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]">{m.repo}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">{m.title}</span>
                {m.source_url && (
                  <a href={m.source_url} target="_blank" rel="noreferrer" aria-label="Ouvrir la PR" className="text-[var(--text-muted)] hover:text-[var(--memovia-violet)]">
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
            Aucun jalon retenu pour l'instant — le backfill initial et le tri des candidats rempliront cette page.
          </p>
        )}
        {parMois.map(({ mois, items }) => (
          <div key={mois}>
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--text-label)]">{mois}</h2>
            <ul className="mt-2 divide-y divide-[var(--border-color)] rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 shadow-[var(--shadow-xs)]">
              {items.map((m) => (
                <li key={m.id} className="flex flex-wrap items-baseline gap-2 py-2.5">
                  <span className="w-16 shrink-0 text-[13px] tabular-nums text-[var(--text-muted)]">{formatDate(m.date).replace(` ${new Date(m.date).getFullYear()}`, '')}</span>
                  <span className="rounded bg-[var(--bg-primary)] px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]">{m.repo}</span>
                  <span className="min-w-0 flex-1 text-sm text-[var(--text-primary)]">{m.title}</span>
                  {m.detail && <span className="basis-full pl-16 text-[13px] text-[var(--text-secondary)]">{m.detail}</span>}
                  {m.source_url && (
                    <a href={m.source_url} target="_blank" rel="noreferrer" aria-label="Ouvrir la PR" className="text-[var(--text-muted)] hover:text-[var(--memovia-violet)]">
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
