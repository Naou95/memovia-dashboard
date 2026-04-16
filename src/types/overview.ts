export interface StripeMetrics {
  /** MRR en euros, ex : 360 */
  mrr: number
  /** Taux de churn en %, ex : 3.3 */
  churnRate: number
  /** Nombre d'abonnements actifs, ex : 30 */
  activeSubscribers: number
  fetchedAt: string
}

export interface QontoBalance {
  /** Solde total en euros (somme de tous les comptes), ex : 12430.50 */
  balance: number
  currency: string
  fetchedAt: string
}

export interface OverviewKpis {
  stripe: StripeMetrics | null
  qonto: QontoBalance | null
  stripeError: string | null
  qontoError: string | null
  isLoading: boolean
}
