/**
 * Fusion d'une analyse du détecteur de leads dans un lead EXISTANT. Logique pure (aucun import
 * Deno) : testée par vitest (src/test/LeadMerge.test.ts), importée par email-lead-detector.
 *
 * Pourquoi : le détecteur remplaçait sur un lead existant name, status, maturity, notes,
 * next_action, relance_count, last_contact_date, timeline et contact_role par ce que l'IA lisait
 * dans le fil de mails. Un prospect de campagne qui répondait perdait ses entrées « envoyé », ses
 * notes saisies à la main, et pouvait voir son statut reculer. Ici, ce que la fiche sait déjà
 * gagne, l'analyse ne fait que compléter.
 */

export interface TimelineEntryLike {
  date: string
  direction: string
  sujet: string
  résumé: string
}

export interface ExistingLead {
  name: string | null
  status: string | null
  maturity: string | null
  notes: string | null
  next_action: string | null
  relance_count: number | null
  last_contact_date: string | null
  timeline: TimelineEntryLike[] | null
  contact_role: string | null
}

export interface IncomingAnalysis {
  name: string
  status: string
  maturity: string
  notes: string | null
  next_action: string | null
  relance_count: number
  last_contact_date: string | null
  timeline: TimelineEntryLike[] | null
  contact_role: string | null
}

export type LeadPatch = Partial<{
  name: string
  status: string
  maturity: string
  notes: string
  next_action: string
  relance_count: number
  last_contact_date: string
  timeline: TimelineEntryLike[]
  contact_role: string
}>

// Le pipeline avance de gauche à droite. gagne / perdu / actif sont posés par un humain (ou par un
// refus à l'appel) : le détecteur n'y touche jamais.
const STATUS_RANK: Record<string, number> = { nouveau: 0, contacte: 1, en_discussion: 2, proposition: 3 }
const MATURITY_RANK: Record<string, number> = { froid: 0, tiede: 1, chaud: 2 }

const filled = (s: string | null | undefined): s is string => typeof s === 'string' && s.trim() !== ''

function normalizeSubject(subject: string): string {
  return (subject || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Préfixes de réponse et de transfert, français, anglais, allemand, avec ou sans compteur : « RE[2]: », « Rép : ».
    .replace(/^(\s*(re|rep|tr|fw|fwd|aw|wg)\s*(\[\d+\])?\s*:\s*)+/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const isEntry = (e: unknown): e is TimelineEntryLike =>
  !!e && typeof e === 'object' && typeof (e as TimelineEntryLike).date === 'string' && typeof (e as TimelineEntryLike).direction === 'string'

/** Écart en jours entre deux dates 'YYYY-MM-DD…' ; Infinity si l'une des deux est illisible. */
function dayGap(a: string, b: string): number {
  const ms = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  const gap = (ms(a) - ms(b)) / 86400000
  return Number.isFinite(gap) ? Math.abs(gap) : Infinity
}

/**
 * Deux entrées décrivent-elles le même échange ? Même sens et même objet, à la même date… ou à un
 * jour près : la campagne date ses envois au jour de Paris, le détecteur lit l'en-tête du mail (UTC)
 * et le modèle peut glisser d'un jour. Sans objet, on exige la même date, pour ne rien confondre.
 */
function sameEntry(a: TimelineEntryLike, b: TimelineEntryLike): boolean {
  if (a.direction !== b.direction) return false
  const subject = normalizeSubject(a.sujet)
  if (subject !== normalizeSubject(b.sujet)) return false
  if (a.date === b.date) return true
  return subject !== '' && dayGap(a.date, b.date) <= 1
}

/**
 * Garde TOUTES les entrées existantes, dans LEUR ordre (dont les appels, les envois de campagne, et
 * même une entrée de forme inattendue : on ne supprime ni ne déplace ce qu'on ne comprend pas).
 * Les entrées nouvelles de l'analyse s'insèrent à leur place chronologique.
 *
 * Deux passes, parce que la tolérance d'un jour est dangereuse si elle sert deux fois : un mail du
 * 14 et sa relance « Re: » du 15 ont le même objet normalisé. D'abord les correspondances EXACTES
 * (même date) ; ensuite seulement, une entrée existante que personne n'a reconnue exactement peut
 * absorber UNE entrée décalée d'un jour. La relance du lendemain, elle, reste une entrée à part.
 */
export function mergeTimeline(
  existing: TimelineEntryLike[] | null | undefined,
  incoming: TimelineEntryLike[] | null | undefined,
): TimelineEntryLike[] {
  const result: TimelineEntryLike[] = Array.isArray(existing) ? [...existing] : []
  const candidates = Array.isArray(incoming) ? incoming.filter(isEntry) : []

  const exact = (x: TimelineEntryLike, e: TimelineEntryLike) => x.date === e.date && sameEntry(x, e)
  const matchedExactly = new Set<number>()
  const unmatched: TimelineEntryLike[] = []
  for (const e of candidates) {
    const at = result.findIndex((x) => isEntry(x) && exact(x, e))
    if (at >= 0) matchedExactly.add(at)
    else unmatched.push(e)
  }

  const absorbed = new Set<number>()
  const fresh: TimelineEntryLike[] = []
  for (const e of unmatched) {
    const at = result.findIndex((x, i) => isEntry(x) && !matchedExactly.has(i) && !absorbed.has(i) && sameEntry(x, e))
    if (at >= 0) absorbed.add(at)
    else if (!fresh.some((x) => exact(x, e))) fresh.push(e)
  }

  fresh
    .map((e, i) => ({ e, i }))
    .sort((x, y) => (x.e.date < y.e.date ? -1 : x.e.date > y.e.date ? 1 : x.i - y.i))
    .forEach(({ e }) => {
      const at = result.findIndex((x) => isEntry(x) && x.date > e.date)
      if (at < 0) result.push(e)
      else result.splice(at, 0, e)
    })
  return result
}

/** Ne rend que les champs qui changent : un lead déjà à jour ne reçoit aucune écriture. */
export function mergeLeadFromAnalysis(existing: ExistingLead, incoming: IncomingAnalysis): LeadPatch {
  const patch: LeadPatch = {}

  // Ce qu'un humain (ou une campagne) a déjà écrit gagne ; l'analyse remplit les vides.
  if (!filled(existing.name) && filled(incoming.name)) patch.name = incoming.name
  if (!filled(existing.notes) && filled(incoming.notes)) patch.notes = incoming.notes
  if (!filled(existing.next_action) && filled(incoming.next_action)) patch.next_action = incoming.next_action
  if (!filled(existing.contact_role) && filled(incoming.contact_role)) patch.contact_role = incoming.contact_role

  // Statut : jamais vers l'arrière, jamais hors du pipeline de prospection.
  const currentRank = existing.status == null ? -1 : STATUS_RANK[existing.status]
  const nextRank = STATUS_RANK[incoming.status]
  if (currentRank !== undefined && nextRank !== undefined && nextRank > currentRank) patch.status = incoming.status

  // Maturité : vers le haut seulement (un aller-retour chaud → tiède → chaud redéclencherait
  // on_lead_becomes_hot : tâche « Relancer » et notification en double).
  const currentMaturity = existing.maturity == null ? -1 : MATURITY_RANK[existing.maturity]
  const nextMaturity = MATURITY_RANK[incoming.maturity]
  if (currentMaturity !== undefined && nextMaturity !== undefined && nextMaturity > currentMaturity) patch.maturity = incoming.maturity

  const count = Math.max(existing.relance_count ?? 0, incoming.relance_count ?? 0)
  if (count !== (existing.relance_count ?? 0)) patch.relance_count = count

  if (filled(incoming.last_contact_date) && (!filled(existing.last_contact_date) || incoming.last_contact_date > existing.last_contact_date)) {
    patch.last_contact_date = incoming.last_contact_date
  }

  const timeline = mergeTimeline(existing.timeline, incoming.timeline)
  if (JSON.stringify(timeline) !== JSON.stringify(Array.isArray(existing.timeline) ? existing.timeline : [])) patch.timeline = timeline

  return patch
}
