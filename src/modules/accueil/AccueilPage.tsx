import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight, Calendar, Trophy, PhoneCall, BookOpen, FileCheck2, FileWarning } from 'lucide-react'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { BlurFade } from '@/components/ui/blur-fade'
import { useAuth } from '@/contexts/AuthContext'
import { useLeads } from '@/hooks/useLeads'
import { useRdv } from '@/hooks/useRdv'
import { useFinancements } from '@/hooks/useFinancements'
import { LeadPitchDialog } from '@/modules/prospection/components/LeadPitchDialog'
import { AssistantCard } from './AssistantCard'
import type { Lead } from '@/types/leads'

// ── Helpers dates ──────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000
const DAYS_SHOWN = 14

function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

function dayIndex(dateStr: string, first: Date): number {
  return Math.floor((startOfDay(new Date(dateStr)).getTime() - first.getTime()) / DAY_MS)
}

function formatShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

// ── Planning : un événement = une puce sur la bande de 14 jours ────────────────

interface PlanningEvent {
  key: string
  label: string
  day: number
  kind: 'rdv' | 'financement' | 'relance'
  link: string
}

// Barres PLEINES, texte blanc — comme les bandeaux de la maquette de référence.
// Teintes calées AA sur texte blanc 12px (mesuré au DOM le 22/08) :
// ambre 500 = 2,15:1 et bleu 500 = 3,68:1 échouaient → ambre 700 (5,0) et bleu 600 (5,1).
const EVENT_STYLE: Record<PlanningEvent['kind'], { bg: string; icon: typeof Calendar }> = {
  rdv: { bg: '#7C3AED', icon: Calendar },
  financement: { bg: '#B45309', icon: Trophy },
  relance: { bg: '#2563EB', icon: PhoneCall },
}

const AVATAR_COLORS = ['#7C3AED', '#3B82F6', '#16A34A', '#D97706', '#DC2626']

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-ZÀ-Ý0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || name.slice(0, 2).toUpperCase()
}

/**
 * Accueil (22/08/2026) — la page d'atterrissage du dashboard, sur le modèle
 * validé par Naoufel (capture « Planned Absences ») : un planning des 14
 * prochains jours (RDV, deadlines financement, relances leads), les échéances,
 * les leads à contacter avec leur pitch, et l'assistant IA branché aux données.
 */
export default function AccueilPage() {
  const { user } = useAuth()
  const { leads, isLoading: leadsLoading } = useLeads()
  const { rdvs } = useRdv()
  const { financements } = useFinancements()
  const [pitchLead, setPitchLead] = useState<Lead | null>(null)

  const firstDay = useMemo(() => {
    const d = startOfDay(new Date())
    return new Date(d.getTime() - 2 * DAY_MS) // 2 jours d'historique, 11 devant
  }, [])
  const todayIdx = 2

  const days = useMemo(
    () => [...Array(DAYS_SHOWN)].map((_, i) => new Date(firstDay.getTime() + i * DAY_MS)),
    [firstDay],
  )

  const activeLeads = useMemo(
    () => leads.filter((l) => !l.archived && !['gagne', 'perdu'].includes(l.status)),
    [leads],
  )
  // Les listes « leads » de la page = pipeline seulement ; les partenaires vivent
  // dans leur onglet mais leurs relances restent visibles sur le planning.
  const pipelineLeads = useMemo(
    () =>
      activeLeads
        .filter((l) => l.type !== 'partenaire')
        .sort((a, b) => (a.follow_up_date ?? '9999').localeCompare(b.follow_up_date ?? '9999')),
    [activeLeads],
  )

  // Financements avec échéance, hors clos
  const openFinancements = useMemo(
    () => financements.filter((f) => !['gagne', 'perdu', 'abandonne'].includes(f.status)),
    [financements],
  )

  const events = useMemo<PlanningEvent[]>(() => {
    const list: PlanningEvent[] = []
    for (const r of rdvs) {
      const day = dayIndex(r.rdv_date, firstDay)
      if (day >= 0 && day < DAYS_SHOWN) {
        const time = new Date(r.rdv_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        list.push({ key: `rdv-${r.id}`, label: `${time} ${r.title}`, day, kind: 'rdv', link: '/rdv' })
      }
    }
    for (const f of openFinancements) {
      if (!f.deadline) continue
      const day = dayIndex(f.deadline, firstDay)
      if (day >= 0 && day < DAYS_SHOWN) {
        list.push({ key: `fin-${f.id}`, label: `Deadline ${f.name}`, day, kind: 'financement', link: '/financements' })
      }
    }
    for (const l of activeLeads) {
      if (!l.follow_up_date) continue
      const day = dayIndex(l.follow_up_date, firstDay)
      if (day >= 0 && day < DAYS_SHOWN) {
        list.push({ key: `lead-${l.id}`, label: `Relance ${l.name}`, day, kind: 'relance', link: '/leads' })
      }
    }
    return list.sort((a, b) => a.day - b.day)
  }, [rdvs, openFinancements, activeLeads, firstDay])

  // Échéances (financements datés + prochains RDV), les 5 plus proches
  const echeances = useMemo(() => {
    const now = startOfDay(new Date()).getTime()
    const items = [
      ...openFinancements
        .filter((f) => f.deadline && new Date(f.deadline).getTime() >= now)
        .map((f) => ({
          key: `f-${f.id}`,
          date: f.deadline as string,
          title: f.name,
          sub: f.next_action,
          link: '/financements',
          kind: 'financement' as const,
        })),
      ...rdvs
        .filter((r) => new Date(r.rdv_date).getTime() >= Date.now())
        .map((r) => ({
          key: `r-${r.id}`,
          date: r.rdv_date,
          title: r.title,
          sub: null as string | null,
          link: '/rdv',
          kind: 'rdv' as const,
        })),
    ]
    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
  }, [openFinancements, rdvs])

  // Derniers CR de RDV (mémoire des rendez-vous passés)
  const lastCr = useMemo(
    () =>
      rdvs
        .filter((r) => new Date(r.rdv_date).getTime() < Date.now())
        .slice(0, 2),
    [rdvs],
  )

  const firstName = user?.profile.full_name?.split(' ')[0] ?? ''

  return (
    // ≥ lg : la page tient DANS l'écran (demande 22/08 : tout visible sans
    // scroller). 104px = header 64 + padding vertical du <main> (2 × 20).
    // En dessous de lg (mobile), flux normal : le scroll reste naturel.
    <motion.div
      className="space-y-4 lg:flex lg:h-[calc(100dvh-104px)] lg:flex-col lg:gap-4 lg:space-y-0 lg:overflow-hidden"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* ── Planning 14 jours ────────────────────────────────────────────────── */}
      <motion.section
        variants={staggerItem}
        className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-[var(--shadow-xs)] lg:shrink-0"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-[22px] font-bold text-[var(--text-primary)]">
              Les 2 prochaines semaines
            </h1>
            {/* La plage explicite lève l'ambiguïté des numéros de jours qui
                changent de mois en cours de bande (« 1, 2 » sans mois). */}
            <p className="mt-0.5 text-[12px] tabular-nums text-[var(--text-secondary)]">
              {days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} –{' '}
              {days[DAYS_SHOWN - 1].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[12px]">
            {(
              [
                ['RDV', 'rdv'],
                ['Financements', 'financement'],
                ['Relances', 'relance'],
              ] as const
            ).map(([label, kind]) => (
              <span key={kind} className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: EVENT_STYLE[kind].bg }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
          {/* Leads à suivre (colonne gauche, façon liste d'équipe de la maquette) */}
          <div className="hidden lg:block">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
              Leads suivis
            </h2>
            <ul className="space-y-0.5">
              {pipelineLeads.slice(0, 5).map((lead, i) => (
                <li key={lead.id}>
                  <BlurFade delay={i * 0.04}>
                  <Link
                    to="/leads"
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                      aria-hidden
                    >
                      {initials(lead.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">
                        {lead.name}
                      </span>
                      <span className="block truncate text-[11px] text-[var(--text-muted)]">
                        {(lead.contact_name !== lead.name ? lead.contact_name : lead.contact_role) ?? '—'}
                      </span>
                    </span>
                  </Link>
                  </BlurFade>
                </li>
              ))}
              {!leadsLoading && pipelineLeads.length === 0 && (
                <li className="px-2 text-[13px] text-[var(--text-muted)]">Aucun lead actif.</li>
              )}
            </ul>
          </div>

          {/* Bande de 14 jours */}
          <div className="overflow-x-auto">
            <div className="min-w-[840px]">
              {/* En-têtes de jours */}
              <div className="grid" style={{ gridTemplateColumns: `repeat(${DAYS_SHOWN}, minmax(0, 1fr))` }}>
                {days.map((d, i) => {
                  const isToday = i === todayIdx
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <div key={i} className="px-0.5 pb-2 text-center">
                      <div className="text-[11px] font-medium uppercase text-[var(--text-secondary)]">
                        {d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}
                      </div>
                      <div
                        className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-[14px] tabular-nums ${
                          isToday
                            ? 'bg-[var(--memovia-violet)] font-bold text-white shadow-[0_4px_12px_rgba(124,58,237,0.4)]'
                            : isWeekend
                              ? 'text-[var(--text-muted)]'
                              : 'font-semibold text-[var(--text-primary)]'
                        }`}
                      >
                        {d.getDate()}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Grille des événements */}
              <div
                className="relative grid auto-rows-[32px] gap-y-1 rounded-lg py-1"
                style={{ gridTemplateColumns: `repeat(${DAYS_SHOWN}, minmax(0, 1fr))` }}
              >
                {/* Fonds week-end + repère aujourd'hui — lignes EXPLICITES pour ne
                    pas décaler l'auto-placement des puces (piège grid constaté en QA) */}
                {days.map((d, i) => {
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <div
                      key={`bg-${i}`}
                      className="pointer-events-none rounded-md"
                      style={{
                        gridColumn: `${i + 1} / span 1`,
                        gridRow: `1 / span ${Math.max(events.length, 3)}`,
                        backgroundColor: isWeekend ? 'rgba(16,24,40,0.025)' : undefined,
                        borderLeft: i === todayIdx ? '2px dashed var(--memovia-violet)' : undefined,
                      }}
                      aria-hidden
                    />
                  )
                })}

                {events.map((ev, i) => {
                  const style = EVENT_STYLE[ev.kind]
                  const Icon = style.icon
                  // Une puce s'étend sur 3 colonnes max pour rester lisible
                  const span = Math.min(3, DAYS_SHOWN - ev.day)
                  return (
                    // BlurFade porte le placement grid ; la puce glisse depuis la
                    // gauche (sens de lecture de la timeline) à l'arrivée des données
                    <BlurFade
                      key={ev.key}
                      delay={i * 0.06}
                      direction="right"
                      offset={8}
                      className="z-10 min-w-0"
                      style={{
                        gridColumn: `${ev.day + 1} / span ${span}`,
                        gridRow: `${i + 1}`,
                      }}
                    >
                      <Link
                        to={ev.link}
                        title={ev.label}
                        className="flex h-8 w-full items-center gap-1.5 truncate rounded-full px-3 text-[12px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          backgroundColor: style.bg,
                          boxShadow: `0 4px 12px color-mix(in oklab, ${style.bg} 40%, transparent)`,
                        }}
                      >
                        <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-white/25">
                          <Icon className="h-3 w-3" />
                        </span>
                        <span className="truncate">{ev.label}</span>
                      </Link>
                    </BlurFade>
                  )
                })}

                {events.length === 0 && (
                  <p
                    className="z-10 self-center px-2 text-[13px] text-[var(--text-muted)]"
                    style={{ gridColumn: `1 / span ${DAYS_SHOWN}` }}
                  >
                    Rien de planifié sur les 14 prochains jours.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Rangée basse : échéances · leads à contacter · assistant ─────────── */}
      {/* min-w-0 partout : sans lui, un contenu long élargit la colonne de grille
          et fait déborder la page sur mobile (constaté en QA 390px).
          ≥ lg : la rangée absorbe la hauteur restante, chaque carte gère son
          propre débordement (filet de sécurité sur petit écran). */}
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 lg:min-h-0 lg:flex-1">
        {/* Échéances */}
        <motion.section
          variants={staggerItem}
          className="min-w-0 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-[var(--shadow-xs)] lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">Échéances</h2>
            <Link
              to="/financements"
              className="flex items-center gap-0.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--memovia-violet)]"
            >
              Tout voir <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="space-y-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {echeances.map((e, i) => {
              const days = Math.round((startOfDay(new Date(e.date)).getTime() - startOfDay(new Date()).getTime()) / DAY_MS)
              const urgent = days <= 7
              const first = i === 0
              return (
                <li key={e.key}>
                  <BlurFade delay={i * 0.05}>
                  <Link
                    to={e.link}
                    className="flex items-center gap-2.5 rounded-2xl border p-2.5 transition-colors hover:border-[var(--memovia-violet)]"
                    style={
                      first
                        ? { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }
                        : { backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }
                    }
                  >
                    {/* Tuile d'icône colorée (langue de la maquette) */}
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
                      style={{ backgroundColor: e.kind === 'rdv' ? '#7C3AED' : '#F59E0B' }}
                      aria-hidden
                    >
                      {e.kind === 'rdv' ? <Calendar className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--text-primary)]">
                          {e.title}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                            urgent ? 'bg-[var(--danger-bg)] text-[var(--danger)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {days === 0 ? "Aujourd'hui" : `J-${days}`}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] tabular-nums text-[var(--text-secondary)]">
                        {formatShort(e.date)}
                        {e.sub && ` · ${e.sub}`}
                      </span>
                    </span>
                  </Link>
                  </BlurFade>
                </li>
              )
            })}
            {echeances.length === 0 && (
              <li className="text-[13px] text-[var(--text-muted)]">Aucune échéance datée.</li>
            )}
          </ul>
        </motion.section>

        {/* Leads à contacter + derniers CR */}
        <motion.section
          variants={staggerItem}
          className="min-w-0 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-[var(--shadow-xs)] lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">Leads à contacter</h2>
            <Link
              to="/leads"
              className="flex items-center gap-0.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--memovia-violet)]"
            >
              Tout voir <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="space-y-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {pipelineLeads.slice(0, 3).map((lead, i) => (
              <li key={lead.id} title={lead.next_action ?? undefined}>
              <BlurFade
                delay={i * 0.05}
                className="flex items-center gap-2.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-2.5"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                  style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                  aria-hidden
                >
                  {initials(lead.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[var(--text-primary)]">{lead.name}</span>
                  <span className="block truncate text-[12px] text-[var(--text-secondary)]">
                    {lead.contact_name ?? 'Contact à identifier'}
                    {lead.contact_role ? ` · ${lead.contact_role}` : ''}
                  </span>
                </span>
                {(lead.why || lead.pitch) && (
                  <button
                    type="button"
                    onClick={() => setPitchLead(lead)}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--memovia-violet)] px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(124,58,237,0.35)] transition-transform duration-150 hover:scale-105 active:scale-[0.97]"
                  >
                    <BookOpen className="h-3 w-3" />
                    Pitch
                  </button>
                )}
              </BlurFade>
              </li>
            ))}
            {!leadsLoading && pipelineLeads.length === 0 && (
              <li className="text-[13px] text-[var(--text-muted)]">Aucun lead actif.</li>
            )}
          </ul>

          {lastCr.length > 0 && (
            <>
              <h3 className="mb-1.5 mt-3 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">
                Derniers RDV
              </h3>
              <ul className="shrink-0 space-y-0.5">
                {lastCr.map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/rdv"
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      {r.cr_status === 'fait' ? (
                        <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
                      ) : (
                        <FileWarning className="h-3.5 w-3.5 shrink-0 text-[var(--danger)]" />
                      )}
                      <span className="truncate text-[var(--text-primary)]">{r.title}</span>
                      <span className="ml-auto shrink-0 tabular-nums text-[var(--text-muted)]">
                        {formatShort(r.rdv_date)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </motion.section>

        {/* Assistant IA */}
        <motion.div variants={staggerItem} className="min-w-0 md:col-span-2 xl:col-span-1 lg:min-h-0">
          <AssistantCard firstName={firstName} />
        </motion.div>
      </div>

      <LeadPitchDialog lead={pitchLead} onClose={() => setPitchLead(null)} />
    </motion.div>
  )
}
