/** Contenu de la page Positionnement, en base depuis le 23/08/2026 (migration 00053). */

export type PositionnementSection =
  | 'intro'
  | 'these'
  | 'phrase'
  | 'interdit'
  | 'citation'
  | 'boucle'
  | 'offre'
  | 'argument'
  | 'concurrent'
  | 'sacrifice'

export type Verdict = 'rouge' | 'orange' | 'vert'

export type ItemStyle = 'plain' | 'card' | 'accent'

export interface PositionnementItem {
  id: string
  section: PositionnementSection
  ordre: number
  title: string | null
  /** Markdown. */
  body: string | null
  /** Markdown, ligne secondaire (ce qu'on retient d'une citation, par exemple). */
  note: string | null
  /** Nom d'icône lucide, seulement pour `boucle`. Whitelisté au rendu. */
  icon: string | null
  segment: string | null
  verdict: Verdict | null
  style: ItemStyle
}
