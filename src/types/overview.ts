export interface StripeMetrics {
  /** MRR total (Stripe + contrats B2B actifs) */
  mrr: number
  /** MRR Stripe seul */
  mrr_stripe: number
  /** MRR contrats B2B actifs (SUM contracts.mrr_eur WHERE status='actif') */
  mrr_contracts: number
  /** mrr_stripe + mrr_contracts */
  mrr_total: number
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
