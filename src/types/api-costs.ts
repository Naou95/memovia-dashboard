export type ProviderId = 'openai' | 'gemini' | 'gladia'

/** db = coûts réels depuis api_costs · api = appel direct provider · unavailable = non disponible */
export type CostSource = 'db' | 'api' | 'unavailable'

export interface ProviderSummary {
  id: ProviderId
  label: string
  monthTotal: number
  currency: 'USD'
  available: boolean
  source: CostSource
  /** Nombre d'appels ce mois (transcriptions Gladia, etc.) */
  callCount?: number
}

export interface DailyCost {
  date: string // YYYY-MM-DD
  openai: number
  gemini: number
  gladia: number
}

export interface ApiCostsData {
  providers: ProviderSummary[]
  dailyCosts: DailyCost[]
  totalMonth: number
  fetchedAt: string
  period: { start: string; end: string }
}
