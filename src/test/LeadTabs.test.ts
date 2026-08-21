import { describe, it, expect } from 'vitest'
import { filterLeadsByTab } from '@/types/leads'
import type { Lead } from '@/types/leads'

const lead = (over: Partial<Lead>): Lead => ({
  id: 'x', name: 'X', type: 'cfa', canal: 'email', status: 'nouveau',
  next_action: null, follow_up_date: null, assigned_to: null, notes: null,
  created_at: '', updated_at: '', created_by: null, contact_email: null,
  contact_name: null, contact_role: null, source: null, maturity: null,
  relance_count: 0, last_contact_date: null, timeline: null,
  contact_phone: null, archived: false, ...over,
})

describe('filterLeadsByTab', () => {
  const leads = [
    lead({ id: 'a', type: 'cfa' }),
    lead({ id: 'b', type: 'partenaire', status: 'actif' }),
    lead({ id: 'c', type: 'autre' }),
  ]
  it('cfa exclut les partenaires, garde tout le reste', () => {
    expect(filterLeadsByTab(leads, 'cfa').map((l) => l.id)).toEqual(['a', 'c'])
  })
  it('partenaires ne garde que les partenaires', () => {
    expect(filterLeadsByTab(leads, 'partenaires').map((l) => l.id)).toEqual(['b'])
  })
})
