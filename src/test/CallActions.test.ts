/**
 * Les écritures d'un appel (src/lib/callActions.ts), contre un faux client Supabase qui note chaque
 * requête : ce qui est écrit, dans quel ordre, avec quelles gardes, et ce qui se passe quand ça échoue.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

interface Op {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete'
  payload?: Record<string, unknown>
  eq: Record<string, unknown>
  returning: boolean
}
type Reply = { data?: unknown; error?: { code?: string; message: string } | null }

const h = vi.hoisted(() => ({
  log: [] as Op[],
  reply: null as null | ((op: Op) => Reply | undefined),
}))

vi.mock('@/lib/supabase', () => {
  const from = (table: string) => {
    const op: Op = { table, op: 'select', eq: {}, returning: false }
    const b = {
      insert: (p: Record<string, unknown>) => { op.op = 'insert'; op.payload = p; return b },
      update: (p: Record<string, unknown>) => { op.op = 'update'; op.payload = p; return b },
      delete: () => { op.op = 'delete'; return b },
      eq: (col: string, v: unknown) => { op.eq[col] = v; return b },
      select: () => { op.returning = true; return b },
      single: () => b,
      then: (ok: (r: Reply) => unknown, ko: (e: unknown) => unknown) => {
        h.log.push(op)
        // Par défaut tout réussit ; une mise à jour « avec retour » touche une ligne, un insert rend son id.
        const fallback: Reply = op.op === 'insert' && op.returning ? { data: { id: 'CALL1' }, error: null }
          : op.returning ? { data: [{ id: 'row' }], error: null } : { data: null, error: null }
        return Promise.resolve(h.reply?.(op) ?? fallback).then(ok, ko)
      },
    }
    return b
  }
  return { supabase: { from } }
})

import { CallPartiallySavedError, completeCampaignCall, logLeadCall, postponeCampaignMessage } from '@/lib/callActions'

const enrollment = { id: 'E1', lead_id: 'L1', current_position: 2 }
const steps = [{ position: 1, wait_days: 0 }, { position: 2, wait_days: 4 }, { position: 3, wait_days: 3 }]
const writes = () => h.log.map((o) => `${o.op} ${o.table}`)

beforeEach(() => {
  h.log = []
  h.reply = null
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-14T22:30:00Z')) // mardi 15 à 00:30, heure de Paris
})
afterEach(() => vi.useRealTimers())

describe('completeCampaignCall', () => {
  it('écrit l’appel d’abord, puis l’étape, la fiche et la séquence, avec leurs gardes', async () => {
    await completeCampaignCall({ messageId: 'M1', enrollment, steps, outcome: 'joint', note: '  3 RQTH  ' })
    expect(writes()).toEqual(['insert lead_calls', 'update campaign_messages', 'update leads', 'update campaign_enrollments'])
    expect(h.log[0].payload).toEqual({ lead_id: 'L1', outcome: 'joint', note: '3 RQTH', campaign_message_id: 'M1' })
    expect(h.log[1]).toMatchObject({ payload: { status: 'done', outcome: 'joint', note: '3 RQTH' }, eq: { id: 'M1', status: 'draft' } })
    // Le jour du contact est celui de Paris (le 15), pas celui d'UTC (encore le 14).
    expect(h.log[2]).toMatchObject({ payload: { last_contact_date: '2026-09-15', canal: 'appel' }, eq: { id: 'L1' } })
    expect(h.log[2].payload).not.toHaveProperty('status')
    // Avance d'une étape, avec la garde « même étape qu'au chargement ».
    expect(h.log[3]).toMatchObject({ payload: { current_position: 3 }, eq: { id: 'E1', current_position: 2 } })
  })

  it('un refus arrête la séquence, saute ses brouillons et passe le lead en perdu', async () => {
    await completeCampaignCall({ messageId: 'M1', enrollment, steps, outcome: 'refus', note: '' })
    expect(h.log[0].payload).toMatchObject({ note: null })
    expect(h.log[2].payload).toMatchObject({ status: 'perdu' })
    expect(h.log[3]).toMatchObject({ table: 'campaign_enrollments', payload: { status: 'stopped', stop_reason: 'refused' } })
    expect(h.log[4]).toMatchObject({ table: 'campaign_messages', payload: { status: 'skipped' }, eq: { enrollment_id: 'E1', status: 'draft' } })
  })

  it('déjà enregistré ailleurs (index unique) : refus net, rien d’autre n’est écrit', async () => {
    h.reply = (op) => (op.op === 'insert' ? { data: null, error: { code: '23505', message: 'duplicate' } } : undefined)
    await expect(completeCampaignCall({ messageId: 'M1', enrollment, steps, outcome: 'joint', note: '' })).rejects.toThrow('message_not_sendable')
    expect(writes()).toEqual(['insert lead_calls'])
  })

  it('l’étape n’est plus un brouillon : l’appel qu’on vient d’écrire est retiré', async () => {
    h.reply = (op) => (op.table === 'campaign_messages' && op.op === 'update' ? { data: [], error: null } : undefined)
    await expect(completeCampaignCall({ messageId: 'M1', enrollment, steps, outcome: 'joint', note: '' })).rejects.toThrow('message_not_sendable')
    expect(writes()).toEqual(['insert lead_calls', 'update campaign_messages', 'delete lead_calls'])
    expect(h.log[2].eq).toEqual({ id: 'CALL1' })
  })

  it('la fiche ne suit pas : l’erreur dit que l’appel, lui, est enregistré', async () => {
    h.reply = (op) => (op.table === 'leads' ? { error: { message: 'boom' } } : undefined)
    const run = completeCampaignCall({ messageId: 'M1', enrollment, steps, outcome: 'joint', note: '' })
    await expect(run).rejects.toBeInstanceOf(CallPartiallySavedError)
    expect(writes()).not.toContain('delete lead_calls')
  })
})

describe('postponeCampaignMessage', () => {
  it('décale le brouillon et l’inscription, seulement s’ils sont encore en cours', async () => {
    await postponeCampaignMessage('M1', 'E1', '2026-09-17T07:00:00.000Z')
    expect(h.log[0]).toMatchObject({ table: 'campaign_messages', payload: { due_at: '2026-09-17T07:00:00.000Z' }, eq: { id: 'M1', status: 'draft' } })
    expect(h.log[1]).toMatchObject({ table: 'campaign_enrollments', payload: { next_due_at: '2026-09-17T07:00:00.000Z' }, eq: { id: 'E1', status: 'active' } })
  })

  it('un écran pas à jour ne réécrit pas la cadence d’une séquence qui a avancé', async () => {
    h.reply = (op) => (op.table === 'campaign_messages' ? { data: [], error: null } : undefined)
    await expect(postponeCampaignMessage('M1', 'E1', '2026-09-17T07:00:00.000Z')).rejects.toThrow('message_not_sendable')
    expect(writes()).toEqual(['update campaign_messages'])
  })

  it('séquence arrêtée entre-temps : refus nommé', async () => {
    h.reply = (op) => (op.table === 'campaign_enrollments' ? { data: [], error: null } : undefined)
    await expect(postponeCampaignMessage('M1', 'E1', '2026-09-17T07:00:00.000Z')).rejects.toThrow('enrollment_not_active')
  })
})

describe('logLeadCall', () => {
  it('prochaine relance : absente = inchangée, null = plus de relance', async () => {
    await logLeadCall('L1', { outcome: 'joint', followUpDate: '2026-09-21' })
    await logLeadCall('L1', { outcome: 'refus', followUpDate: null })
    await logLeadCall('L1', { outcome: 'pas_repondu' })
    const leadWrites = h.log.filter((o) => o.table === 'leads').map((o) => o.payload)
    expect(leadWrites[0]).toMatchObject({ follow_up_date: '2026-09-21', last_contact_date: '2026-09-15' })
    expect(leadWrites[1]).toMatchObject({ follow_up_date: null })
    expect(leadWrites[2]).not.toHaveProperty('follow_up_date')
  })

  it('l’appel est écrit mais la fiche ne suit pas : erreur explicite', async () => {
    h.reply = (op) => (op.table === 'leads' ? { error: { message: 'boom' } } : undefined)
    await expect(logLeadCall('L1', { outcome: 'joint' })).rejects.toBeInstanceOf(CallPartiallySavedError)
  })

  it('l’appel lui-même échoue : erreur ordinaire, rien d’écrit sur la fiche', async () => {
    h.reply = (op) => (op.table === 'lead_calls' ? { error: { message: 'refusé' } } : undefined)
    const run = logLeadCall('L1', { outcome: 'joint' })
    await expect(run).rejects.not.toBeInstanceOf(CallPartiallySavedError)
    expect(writes()).toEqual(['insert lead_calls'])
  })
})
