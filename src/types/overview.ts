export interface StripeMetrics {
  /** MRR en euros, ex : 360 */
  mrr: number
  /** Abonnements payants actifs (cancel_at_period_end=false), ex : 28 */
  activeSubscribers: number
  /** Abonnements payants qui ne se renouvelleront pas (cancel_at_period_end=true), ex : 2 */
  cancelingAtPeriodEnd: number
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
