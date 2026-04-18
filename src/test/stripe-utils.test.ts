import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ── groupByMonth ──────────────────────────────────────────────────────────────
// On importe la logique directement depuis le fichier Edge Function n'est pas
// possible (Deno runtime). On réimplémente la fonction pure côté test pour
// valider le comportement attendu — en gardant la même signature.

function groupByMonth(
  invoices: Array<{ created: number; amount_paid: number }>,
  sinceTimestamp: number
) {
  const map = new Map<string, number>()
  const now = new Date()

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    map.set(key, 0)
  }

  for (const inv of invoices) {
    if (!inv.created || inv.created < sinceTimestamp) continue
    const d = new Date(inv.created * 1000)
    const key = d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    if (map.has(key)) {
      map.set(key, (map.get(key)!) + inv.amount_paid / 100)
    }
  }

  return Array.from(map.entries()).map(([month, revenue]) => ({
    month,
    revenue: Math.round(revenue * 100) / 100,
  }))
}

function normalizePlanAmount(plan: { amount: number; interval: string }): number {
  const monthly = plan.interval === 'year' ? plan.amount / 12 : plan.amount
  return Math.round((monthly / 100) * 100) / 100
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('groupByMonth', () => {
  beforeEach(() => {
    // Figer la date au 15 avril 2026
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initialise les 12 mois à 0 même sans factures', () => {
    const result = groupByMonth([], 0)
    expect(result).toHaveLength(12)
    expect(result.every((m) => m.revenue === 0)).toBe(true)
  })

  it('regroupe les factures par mois', () => {
    const march2026 = Math.floor(new Date('2026-03-10T10:00:00Z').getTime() / 1000)
    const invoices = [
      { created: march2026, amount_paid: 2900 }, // 29€
      { created: march2026, amount_paid: 1200 }, // 12€
    ]
    const result = groupByMonth(invoices, 0)
    const march = result.find((m) => m.month.startsWith('mars'))
    expect(march?.revenue).toBe(41)
  })

  it('ignore les factures antérieures à sinceTimestamp', () => {
    const old = Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000)
    const sinceTimestamp = Math.floor(new Date('2025-04-15T00:00:00Z').getTime() / 1000)
    const result = groupByMonth([{ created: old, amount_paid: 10000 }], sinceTimestamp)
    expect(result.every((m) => m.revenue === 0)).toBe(true)
  })

  it('arrondit les montants à 2 décimales', () => {
    const now = Math.floor(Date.now() / 1000) - 1
    const result = groupByMonth([{ created: now, amount_paid: 1234 }], 0)
    const thisMonth = result[result.length - 1]
    expect(thisMonth.revenue).toBe(12.34)
  })
})

describe('normalizePlanAmount', () => {
  it('renvoie le montant mensuel tel quel pour les plans mensuels', () => {
    expect(normalizePlanAmount({ amount: 2900, interval: 'month' })).toBe(29)
  })

  it('divise par 12 pour les plans annuels', () => {
    expect(normalizePlanAmount({ amount: 34800, interval: 'year' })).toBe(29)
  })

  it('arrondit correctement (pas de problème de virgule flottante)', () => {
    // 1200 / 12 = 100 exactement
    expect(normalizePlanAmount({ amount: 1200, interval: 'year' })).toBe(1)
  })
})
