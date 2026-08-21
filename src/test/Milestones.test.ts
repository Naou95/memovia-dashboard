import { describe, it, expect } from 'vitest'
import { groupMilestones } from '@/types/milestones'
import type { Milestone } from '@/types/milestones'

const m = (over: Partial<Milestone>): Milestone => ({
  id: 'x', date: '2026-01-01', repo: 'memovia-ia-notes', title: 'T',
  detail: null, source_url: null, status: 'candidat', created_at: '', ...over,
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
