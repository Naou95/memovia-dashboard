import { describe, it, expect } from 'vitest'
import { groupMilestones, categorizeMilestone, stripTechPrefix } from '@/types/milestones'
import type { Milestone } from '@/types/milestones'

const m = (over: Partial<Milestone>): Milestone => ({
  id: 'x', date: '2026-01-01', repo: 'memovia-ia-notes', title: 'T',
  title_public: null, detail: null, source_url: null, status: 'candidat', created_at: '', ...over,
})

describe('groupMilestones', () => {
  it('sépare retenus/candidats, écarte les écartés, trie date desc', () => {
    const items = [
      m({ id: 'a', status: 'retenu', date: '2026-05-01' }),
      m({ id: 'b', status: 'candidat', date: '2026-08-01' }),
      m({ id: 'c', status: 'ecarte' }),
      m({ id: 'd', status: 'retenu', date: '2026-07-01' }),
    ]
    const { retenus, candidats } = groupMilestones(items)
    expect(retenus.map((x) => x.id)).toEqual(['d', 'a'])
    expect(candidats.map((x) => x.id)).toEqual(['b'])
  })
})

describe('categorizeMilestone', () => {
  it('les familles spécifiques priment sur fix/feat', () => {
    expect(categorizeMilestone('fix(a11y): plus rien ne recouvre le texte')).toBe('accessibilite')
    expect(categorizeMilestone('fix(securite): fermer la lecture anonyme')).toBe('securite')
    expect(categorizeMilestone('sécurité : les podcasts ne sont plus lisibles')).toBe('securite')
    expect(categorizeMilestone('design(mail): refonte façon Superhuman')).toBe('design')
  })
  it('fix → correction, feat → nouveauté, ci → technique, sans préfixe → nouveauté', () => {
    expect(categorizeMilestone('fix(email-lead-detector): 202 immédiat')).toBe('correction')
    expect(categorizeMilestone('feat: Mail dans la nav v2')).toBe('nouveaute')
    expect(categorizeMilestone('ci(deploy): purge CF doublée')).toBe('technique')
    expect(categorizeMilestone('Refonte v2 — Phase 3 : Financements')).toBe('nouveaute')
  })
})

describe('stripTechPrefix', () => {
  it('retire le préfixe conventionnel et met la majuscule', () => {
    expect(stripTechPrefix('fix(email-lead-detector): 202 immédiat + batch')).toBe('202 immédiat + batch')
    expect(stripTechPrefix('sécurité : les podcasts ne sont plus lisibles')).toBe('Les podcasts ne sont plus lisibles')
    expect(stripTechPrefix('feat: Mail dans la nav v2')).toBe('Mail dans la nav v2')
  })
  it('laisse intact un titre sans préfixe', () => {
    expect(stripTechPrefix('Refonte v2 — Phase 6 : deep links du briefing')).toBe('Refonte v2 — Phase 6 : deep links du briefing')
  })
})
