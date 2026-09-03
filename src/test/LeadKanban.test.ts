import { describe, it, expect } from 'vitest'
import { followUpLabel, groupLeadsByStatus } from '@/lib/leadKanban'
import type { Lead } from '@/types/leads'

const lead = (over: Partial<Lead>): Lead => ({
  id: 'x', name: 'X', type: 'cfa', canal: 'email', status: 'nouveau',
  next_action: null, follow_up_date: null, assigned_to: null, notes: null,
  created_at: '', updated_at: '', created_by: null, contact_email: null,
  contact_name: null, contact_role: null, source: null, maturity: null,
  relance_count: 0, last_contact_date: null, timeline: null,
  contact_phone: null, archived: false, why: null, pitch: null, ...over,
})

const now = new Date('2026-09-02T12:00:00')

describe('groupLeadsByStatus', () => {
  it('une colonne par statut du pipeline, toujours présente même vide', () => {
    const g = groupLeadsByStatus([], now)
    expect(Object.keys(g)).toEqual(['nouveau', 'contacte', 'en_discussion', 'proposition', 'gagne', 'perdu'])
    expect(g.proposition).toEqual([])
  })

  it('dans une colonne : retards en tête, puis dates croissantes, puis sans date', () => {
    const g = groupLeadsByStatus(
      [
        lead({ id: 'sans-date' }),
        lead({ id: 'demain', follow_up_date: '2026-09-03' }),
        lead({ id: 'retard', follow_up_date: '2026-08-24' }),
      ],
      now,
    )
    expect(g.nouveau.map((l) => l.id)).toEqual(['retard', 'demain', 'sans-date'])
  })

  it('à date égale et score égal, le nom départage (ordre stable entre deux chargements)', () => {
    const a = lead({ id: 'b', name: 'Beta', follow_up_date: '2026-09-10' })
    const b = lead({ id: 'a', name: 'Alpha', follow_up_date: '2026-09-10' })
    expect(groupLeadsByStatus([a, b], now).nouveau.map((l) => l.name)).toEqual(['Alpha', 'Beta'])
    expect(groupLeadsByStatus([b, a], now).nouveau.map((l) => l.name)).toEqual(['Alpha', 'Beta'])
  })

  it("un statut hors pipeline ('actif') ne casse pas le regroupement", () => {
    const g = groupLeadsByStatus([lead({ id: 'p', status: 'actif' })], now)
    expect(g.nouveau).toEqual([])
  })
})

describe('followUpLabel', () => {
  it('lit le retard, le jour même et le délai', () => {
    expect(followUpLabel('2026-08-30', now)).toEqual({ text: 'En retard de 3 j', tone: 'late' })
    expect(followUpLabel('2026-09-02', now)).toEqual({ text: "Aujourd'hui", tone: 'today' })
    expect(followUpLabel('2026-09-03', now)).toEqual({ text: 'Demain (03/09)', tone: 'soon' })
    expect(followUpLabel('2026-09-08', now)).toEqual({ text: 'Dans 6 j (08/09)', tone: 'soon' })
    expect(followUpLabel(null, now)).toEqual({ text: '', tone: 'none' })
  })
})
