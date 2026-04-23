import { describe, it, expect } from 'vitest'
import { computeLeadScore, leadScoreColor } from '@/lib/leadScoring'
import type { Lead } from '@/types/leads'

type ScoreInput = Pick<Lead, 'maturity' | 'status' | 'relance_count' | 'last_contact_date'>

const NOW = new Date('2026-04-23T12:00:00')

function dateOffset(days: number): string {
  const d = new Date(NOW)
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function base(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    maturity: null,
    status: 'nouveau',
    relance_count: 0,
    last_contact_date: null,
    ...overrides,
  }
}

describe('computeLeadScore — maturité (base)', () => {
  it('maturité null → 0 points base', () => {
    // null maturity + nouveau + 0 relances + jamais contacté = 0 + 0 + 0 + (-15) = -15 → 0 (plancher)
    expect(computeLeadScore(base({ maturity: null }), NOW)).toBe(0)
  })

  it('froid = 10 points base', () => {
    // 10 + 0 + 0 - 15 = -5 → 0
    expect(computeLeadScore(base({ maturity: 'froid' }), NOW)).toBe(0)
    // avec contact aujourd'hui : 10 + 0 + 0 + 10 = 20
    expect(
      computeLeadScore(base({ maturity: 'froid', last_contact_date: dateOffset(0) }), NOW)
    ).toBe(20)
  })

  it('tiede = 40 points base', () => {
    // 40 + 0 + 0 + 10 = 50
    expect(
      computeLeadScore(base({ maturity: 'tiede', last_contact_date: dateOffset(0) }), NOW)
    ).toBe(50)
  })

  it('chaud = 70 points base', () => {
    // 70 + 0 + 0 + 10 = 80
    expect(
      computeLeadScore(base({ maturity: 'chaud', last_contact_date: dateOffset(0) }), NOW)
    ).toBe(80)
  })
})

describe('computeLeadScore — statut', () => {
  const args = { maturity: 'tiede' as const, last_contact_date: dateOffset(0) } // baseline 50

  it('nouveau = +0', () => {
    expect(computeLeadScore(base({ ...args, status: 'nouveau' }), NOW)).toBe(50)
  })

  it('contacté = +5', () => {
    expect(computeLeadScore(base({ ...args, status: 'contacte' }), NOW)).toBe(55)
  })

  it('en_discussion = +15', () => {
    expect(computeLeadScore(base({ ...args, status: 'en_discussion' }), NOW)).toBe(65)
  })

  it('proposition = +20', () => {
    expect(computeLeadScore(base({ ...args, status: 'proposition' }), NOW)).toBe(70)
  })

  it('gagné = +30', () => {
    expect(computeLeadScore(base({ ...args, status: 'gagne' }), NOW)).toBe(80)
  })

  it('perdu = -50 (peut tomber au plancher)', () => {
    // 50 - 50 = 0
    expect(computeLeadScore(base({ ...args, status: 'perdu' }), NOW)).toBe(0)
  })

  it('perdu + chaud + contact aujourd\'hui : 70 + 10 - 50 = 30', () => {
    expect(
      computeLeadScore(
        base({ maturity: 'chaud', status: 'perdu', last_contact_date: dateOffset(0) }),
        NOW
      )
    ).toBe(30)
  })
})

describe('computeLeadScore — relances', () => {
  const args = { maturity: 'tiede' as const, last_contact_date: dateOffset(0) } // baseline 50

  it('0 relances = +0', () => {
    expect(computeLeadScore(base({ ...args, relance_count: 0 }), NOW)).toBe(50)
  })

  it('1 relance = +5', () => {
    expect(computeLeadScore(base({ ...args, relance_count: 1 }), NOW)).toBe(55)
  })

  it('2 relances = +10 (optimum)', () => {
    expect(computeLeadScore(base({ ...args, relance_count: 2 }), NOW)).toBe(60)
  })

  it('3 relances = +5 (pénalisé)', () => {
    expect(computeLeadScore(base({ ...args, relance_count: 3 }), NOW)).toBe(55)
  })

  it('5 relances = +5 (trop)', () => {
    expect(computeLeadScore(base({ ...args, relance_count: 5 }), NOW)).toBe(55)
  })
})

describe('computeLeadScore — dernier contact', () => {
  const args = { maturity: 'tiede' as const } // base maturité = 40

  it('jamais contacté = -15', () => {
    // 40 + 0 + 0 - 15 = 25
    expect(computeLeadScore(base({ ...args, last_contact_date: null }), NOW)).toBe(25)
  })

  it('aujourd\'hui = +10', () => {
    expect(
      computeLeadScore(base({ ...args, last_contact_date: dateOffset(0) }), NOW)
    ).toBe(50)
  })

  it('hier (< 7j) = +5', () => {
    expect(
      computeLeadScore(base({ ...args, last_contact_date: dateOffset(1) }), NOW)
    ).toBe(45)
  })

  it('6 jours (< 7j boundary) = +5', () => {
    expect(
      computeLeadScore(base({ ...args, last_contact_date: dateOffset(6) }), NOW)
    ).toBe(45)
  })

  it('7 jours (< 30j) = +0', () => {
    expect(
      computeLeadScore(base({ ...args, last_contact_date: dateOffset(7) }), NOW)
    ).toBe(40)
  })

  it('29 jours (< 30j boundary) = +0', () => {
    expect(
      computeLeadScore(base({ ...args, last_contact_date: dateOffset(29) }), NOW)
    ).toBe(40)
  })

  it('30 jours (>= 30j) = -10', () => {
    expect(
      computeLeadScore(base({ ...args, last_contact_date: dateOffset(30) }), NOW)
    ).toBe(30)
  })

  it('90 jours (très ancien) = -10', () => {
    expect(
      computeLeadScore(base({ ...args, last_contact_date: dateOffset(90) }), NOW)
    ).toBe(30)
  })
})

describe('computeLeadScore — cap 100 / plancher 0', () => {
  it('cap à 100 : chaud + gagné + 2 relances + aujourd\'hui = 70+30+10+10 = 120 → 100', () => {
    expect(
      computeLeadScore(
        base({
          maturity: 'chaud',
          status: 'gagne',
          relance_count: 2,
          last_contact_date: dateOffset(0),
        }),
        NOW
      )
    ).toBe(100)
  })

  it('plancher à 0 : null + perdu + 0 relances + jamais = 0-50+0-15 = -65 → 0', () => {
    expect(
      computeLeadScore(
        base({
          maturity: null,
          status: 'perdu',
          relance_count: 0,
          last_contact_date: null,
        }),
        NOW
      )
    ).toBe(0)
  })

  it('score typique lead chaud en discussion : 70+15+10+5 = 100 (cap)', () => {
    expect(
      computeLeadScore(
        base({
          maturity: 'chaud',
          status: 'en_discussion',
          relance_count: 2,
          last_contact_date: dateOffset(3),
        }),
        NOW
      )
    ).toBe(100)
  })
})

describe('leadScoreColor', () => {
  it('score 0 → rouge', () => {
    expect(leadScoreColor(0)).toBe('red')
  })

  it('score 29 → rouge (boundary)', () => {
    expect(leadScoreColor(29)).toBe('red')
  })

  it('score 30 → orange (boundary)', () => {
    expect(leadScoreColor(30)).toBe('orange')
  })

  it('score 50 → orange', () => {
    expect(leadScoreColor(50)).toBe('orange')
  })

  it('score 60 → orange (boundary)', () => {
    expect(leadScoreColor(60)).toBe('orange')
  })

  it('score 61 → vert (boundary)', () => {
    expect(leadScoreColor(61)).toBe('green')
  })

  it('score 100 → vert', () => {
    expect(leadScoreColor(100)).toBe('green')
  })
})
