// Types pour le Module 4 — Qonto Trésorerie

export interface QontoTransaction {
  id: string
  /** Libellé de la transaction */
  label: string
  /** Montant en euros (toujours positif — utiliser `side` pour le sens) */
  amount: number
  /** credit = entrée d'argent, debit = sortie */
  side: 'credit' | 'debit'
  /** Catégorie Qonto (ex: 'software_subscriptions', 'salaries') ou null */
  category: string | null
  /** Date de règlement (ISO 8601) */
  settledAt: string
  status: 'completed' | 'declined' | 'pending'
}

export interface MonthlyCashFlow {
  /** Ex : 'Jan 2025', 'Avr 2026' */
  month: string
  /** Somme des crédits (entrées) en euros */
  income: number
  /** Somme des débits (sorties) en euros */
  expenses: number
  /** income - expenses */
  net: number
}

export interface QontoFinanceData {
  /** Solde total en euros (somme de tous les comptes) */
  balance: number
  currency: string
  /** 100 dernières transactions complétées, du plus récent au plus ancien */
  transactions: QontoTransaction[]
  /** 6 entrées : du mois le plus ancien au plus récent */
  monthlyCashFlow: MonthlyCashFlow[]
  fetchedAt: string
}
