import { motion } from 'framer-motion'
import { Mic, Wand2, Radio, Repeat2, BadgeCheck, ShieldAlert, Hammer, type LucideIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { usePositionnement } from '@/hooks/usePositionnement'
import type { ItemStyle, Verdict } from '@/types/positionnement'

/**
 * Positionnement — l'armurerie commerciale.
 *
 * 23/08/2026 : le contenu est passé EN BASE (table positionnement_items,
 * migration 00053). Il vivait en dur ici, donc il ne bougeait qu'au prix d'un
 * déploiement et l'assistant IA ne pouvait pas y toucher. Cette page ne porte
 * plus que la mise en forme ; le texte se modifie depuis l'assistant de l'accueil.
 *
 * La source de vérité reste POSITIONNEMENT.md du vault (18/07/2026) : si la base
 * et le vault divergent, on corrige la base.
 */

/** Icônes autorisées pour la boucle. Une valeur inconnue en base ne casse pas le rendu. */
const ICONS: Record<string, LucideIcon> = { Mic, Wand2, Radio, Repeat2, BadgeCheck }

const VERDICT_STYLE: Record<Verdict, { dot: string; label: string }> = {
  rouge: { dot: '#B91C1C', label: 'Menace directe' },
  orange: { dot: '#B45309', label: 'Menace sur un segment' },
  vert: { dot: '#15803D', label: 'Pas une menace réelle' },
}

/** Markdown court (gras, liens). Les paragraphes restent collés, comme le JSX d'origine. */
function Md({ children, className = '' }: { children: string | null; className?: string }) {
  if (!children) return null
  return (
    <span className={`[&_p]:m-0 [&_p+p]:mt-1 [&_strong]:font-semibold [&_strong]:text-[var(--text-primary)] ${className}`}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </span>
  )
}

const CARD_STYLE: Record<ItemStyle, string> = {
  plain: '',
  card: 'rounded-xl bg-[var(--bg-primary)] p-3.5',
  accent: 'rounded-xl bg-[rgba(124,58,237,0.06)] p-3',
}

export default function PositionnementPage() {
  const { bySection, intro, isLoading, error } = usePositionnement()

  const these = bySection('these')[0]
  const concurrents = bySection('concurrent')

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-[var(--bg-secondary)]" />
        <div className="h-48 animate-pulse rounded-[var(--radius-card)] bg-[var(--bg-secondary)]" />
        <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-[var(--bg-secondary)]" />
      </div>
    )
  }

  if (error) {
    return (
      <p className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 text-sm text-[var(--danger)]">
        {error}
      </p>
    )
  }

  return (
    <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="show">
      <motion.header variants={staggerItem}>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Positionnement</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{intro('page')}</p>
      </motion.header>

      {/* ── La thèse ── */}
      <motion.section
        variants={staggerItem}
        className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 shadow-[var(--shadow-xs)]"
      >
        <p className="font-display max-w-[36ch] text-[26px] font-bold leading-snug tracking-tight text-[var(--text-primary)] sm:text-[30px]">
          {these?.title}
        </p>
        <div className="mt-2 max-w-[75ch] text-[14px] text-[var(--text-secondary)]">
          <Md>{these?.body ?? null}</Md>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {bySection('phrase').map((p) => (
            <div key={p.id} className="rounded-xl bg-[var(--bg-primary)] p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">{p.title}</p>
              <div className="mt-1 text-[13px] leading-relaxed text-[var(--text-primary)]">
                <Md>{p.body}</Md>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-[var(--danger)]" aria-hidden />
          <span className="mr-1 text-[12px] font-semibold text-[var(--danger)]">Interdits :</span>
          {bySection('interdit').map((i) => (
            <span
              key={i.id}
              className="rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--danger)]"
            >
              {i.title}
            </span>
          ))}
        </div>
      </motion.section>

      {/* ── La force terrain (ce que Petrache dit de nous) ── */}
      <motion.section
        variants={staggerItem}
        className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      >
        <div className="flex items-center gap-2">
          <Hammer className="h-4 w-4 text-[var(--memovia-violet)]" aria-hidden />
          <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">{intro('petrache')}</h2>
        </div>
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{intro('citation')}</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {bySection('citation').map((c) => (
            <blockquote
              key={c.id}
              className="rounded-xl bg-[var(--bg-primary)] p-3.5 text-[13px] leading-relaxed text-[var(--text-primary)]"
            >
              <Md>{c.body}</Md>
              {c.note && <span className="mt-1 block text-[11px] text-[var(--text-muted)]">{c.note}</span>}
            </blockquote>
          ))}
        </div>
      </motion.section>

      {/* ── La boucle en 5 temps (= le produit construit) ── */}
      <motion.section
        variants={staggerItem}
        className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      >
        <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">La boucle en 5 temps</h2>
        <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{intro('boucle')}</p>
        <ol className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {bySection('boucle').map((b, i) => {
            const Icon = b.icon ? ICONS[b.icon] : undefined
            return (
              <li key={b.id} className="rounded-xl bg-[var(--bg-primary)] p-3.5">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(124,58,237,0.12)] text-[#6D28D9]"
                    aria-hidden
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="text-[13px] font-bold text-[var(--text-primary)]">
                    <span className="tabular-nums text-[var(--text-muted)]">{i + 1} · </span>
                    {b.title}
                  </span>
                </div>
                <div className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  <Md>{b.body}</Md>
                </div>
              </li>
            )
          })}
        </ol>
      </motion.section>

      {/* ── L'offre ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <motion.section
          variants={staggerItem}
          className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
        >
          <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">L'offre et les prix</h2>
          <ul className="mt-3 space-y-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {bySection('offre').map((o) => (
              <li key={o.id} className={CARD_STYLE[o.style]}>
                {o.title && <span className="font-semibold text-[var(--text-primary)]">{o.title}</span>}{' '}
                <Md className="inline">{o.body}</Md>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          variants={staggerItem}
          className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
        >
          <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">Les 3 arguments, dans cet ordre</h2>
          <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{intro('argument')}</p>
          <ol className="mt-3 space-y-3">
            {bySection('argument').map((a) => (
              <li key={a.id} className="rounded-xl bg-[var(--bg-primary)] p-3.5">
                <p className="text-[13px] font-bold text-[var(--text-primary)]">{a.title}</p>
                <div className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  <Md>{a.body}</Md>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--text-muted)]">{intro('argument_fin')}</p>
        </motion.section>
      </div>

      {/* ── Concurrents ── */}
      <motion.section
        variants={staggerItem}
        className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">Concurrents</h2>
          <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)]">
            {(Object.keys(VERDICT_STYLE) as Verdict[]).map((v) => (
              <span key={v} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: VERDICT_STYLE[v].dot }} aria-hidden />
                {VERDICT_STYLE[v].label}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{intro('concurrent')}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th scope="col" className="pb-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Acteur</th>
                <th scope="col" className="hidden pb-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)] md:table-cell">Ce qu'il fait</th>
                <th scope="col" className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Points forts / notre réponse</th>
              </tr>
            </thead>
            <tbody>
              {concurrents.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border-subtle)] align-top last:border-0">
                  <td className="whitespace-nowrap py-2.5 pr-4">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: c.verdict ? VERDICT_STYLE[c.verdict].dot : 'transparent' }}
                        aria-hidden
                      />
                      <span className="text-[13px] font-semibold text-[var(--text-primary)]">{c.title}</span>
                    </span>
                    <span className="mt-0.5 block pl-4 text-[11px] text-[var(--text-muted)]">{c.segment}</span>
                  </td>
                  <td className="hidden py-2.5 pr-4 text-[12px] leading-relaxed text-[var(--text-secondary)] md:table-cell">
                    <Md>{c.body}</Md>
                  </td>
                  <td className="py-2.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                    <Md>{c.note}</Md>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* ── Ce qu'on ne fait pas ── */}
      <motion.section
        variants={staggerItem}
        className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      >
        <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">Ce qu'on ne fait PAS</h2>
        <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{intro('sacrifice')}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {bySection('sacrifice').map((s) => (
            <li
              key={s.id}
              className="rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)]"
            >
              {s.title}
            </li>
          ))}
        </ul>
      </motion.section>
    </motion.div>
  )
}
