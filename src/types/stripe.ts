// Types pour le Module 3 — Stripe & Finance

export interface SubscriptionRow {
  id: string
  /** Email du client, '' si le client a été supprimé dans Stripe */
  customerEmail: string
  planName: string
  /** Montant mensuel en euros (plans annuels normalisés ÷ 12) */
  amount: number
  interval: 'month' | 'year'
  /** Date de début de l'abonnement (ISO) */
  startDate: string
  /** true = abonnement actif mais ne se renouvellera pas */
  cancelAtPeriodEnd: boolean
}

export interface MonthlyRevenue {
  /** Ex : 'Jan 2025', 'Fév 2025' */
  month: string
  /** Revenus facturés et encaissés ce mois (€) */
  revenue: number
}

export interface TransactionRow {
  id: string
  /** ISO date */
  date: string
  description: string
  /** Montant en euros */
  amount: number
  currency: string
  status: 'succeeded' | 'failed' | 'refunded'
}

export interface StripeFinanceData {
  /** MRR en euros */
  mrr: number
  /** ARR = MRR × 12 */
  arr: number
  /** Nouveaux abonnés payants créés ce mois civil */
  newThisMonth: number
  /** Abonnements terminés (subscription.deleted) ce mois civil */
  churnsThisMonth: number
  /** Somme des revenus facturés sur les 12 derniers mois */
  totalRevenue12mo: number
  subscriptions: SubscriptionRow[]
  /** 12 entrées : du mois le plus ancien au plus récent */
  revenueByMonth: MonthlyRevenue[]
  recentTransactions: TransactionRow[]
  fetchedAt: string
}
