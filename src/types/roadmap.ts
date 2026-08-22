/** Horizon = colonne du kanban. Jamais de date : la roadmap se déplace, elle ne se planifie pas. */
export type Horizon = 'maintenant' | 'ensuite' | 'plus_tard' | 'parque'

export interface RoadmapItem {
  id: string
  title: string
  why: string | null
  horizon: Horizon
  /** Étiquette libre affichée sur la carte : « en cours », « à trancher lundi »… */
  tag: string | null
  ordre: number
  created_at: string
  updated_at: string
}

export type RoadmapItemUpdate = Partial<Pick<RoadmapItem, 'title' | 'why' | 'horizon' | 'tag' | 'ordre'>>
export type RoadmapItemInsert = Pick<RoadmapItem, 'title'> &
  Partial<Pick<RoadmapItem, 'why' | 'horizon' | 'tag' | 'ordre'>>

export const HORIZON_ORDER: Horizon[] = ['maintenant', 'ensuite', 'plus_tard', 'parque']

export const HORIZON_LABELS: Record<Horizon, string> = {
  maintenant: 'Maintenant',
  ensuite: 'Ensuite',
  plus_tard: 'Plus tard',
  parque: 'Parqué',
}

export const HORIZON_HINTS: Record<Horizon, string> = {
  maintenant: 'Le temps fondateur va là',
  ensuite: 'Dès que Maintenant se libère',
  plus_tard: 'Décidé, pas commencé',
  parque: 'Assumé : on ne le fait pas',
}
