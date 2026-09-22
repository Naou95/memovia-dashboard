// @vitest-environment node
/**
 * Migration 00056 et écritures de l'agenda, sur une vraie base Postgres locale (voir localDb.ts) :
 * contraintes, index unique, RLS, pour Emir (admin_bizdev), Naoufel (admin_full) et un compte de
 * l'application hors dashboard. Données fictives.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asUser, createLocalDb, migrations, rowsOf, seedUsers, USERS } from './localDb'

let db: PGlite
let lead: string
let msg: string

beforeAll(async () => {
  const local = await createLocalDb()
  expect(local.failures).toEqual([])
  db = local.db
  await seedUsers(db)
  lead = (await db.query<{ id: string }>(`insert into public.leads (name) values ('CFA Fictif') returning id`)).rows[0].id
  const camp = (await db.query<{ id: string }>(`insert into public.campaigns (name, sender_email) values ('Test', 'test@exemple.test') returning id`)).rows[0].id
  const step = (await db.query<{ id: string }>(`insert into public.campaign_steps (campaign_id, position, kind, wait_days, name) values ($1, 2, 'call', 4, 'Appel') returning id`, [camp])).rows[0].id
  const enr = (await db.query<{ id: string }>(`insert into public.campaign_enrollments (campaign_id, lead_id, current_position, next_due_at) values ($1, $2, 2, now()) returning id`, [camp, lead])).rows[0].id
  msg = (await db.query<{ id: string }>(`insert into public.campaign_messages (enrollment_id, step_id, kind, status, due_at) values ($1, $2, 'call', 'draft', now()) returning id`, [enr, step])).rows[0].id
}, 120_000)

const fails = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code ?? 'erreur')

describe('migration 00056', () => {
  it('se rejoue sur une base qui l’a déjà', async () => {
    const m = migrations().find((x) => x.name.startsWith('00056'))!
    await expect(db.exec(m.sql)).resolves.toBeDefined()
  })

  it('élargit les issues d’appel sans perdre les anciennes', async () => {
    for (const outcome of ['repondu', 'pas_repondu', 'rappel', 'joint', 'refus', 'interesse']) {
      expect(rowsOf(await db.query(`insert into public.lead_calls (lead_id, outcome) values ($1, $2)`, [lead, outcome]))).toBe(1)
    }
    expect(await fails(db.query(`insert into public.lead_calls (lead_id, outcome) values ($1, 'peut_etre')`, [lead]))).toBe('23514')
  })
})

describe('écritures de l’agenda, en tant qu’Emir (admin_bizdev)', () => {
  it('un seul appel par étape de campagne : le second est refusé par l’index unique', async () => {
    await asUser(db, USERS.emir, async () => {
      expect(rowsOf(await db.query(`insert into public.lead_calls (lead_id, outcome, campaign_message_id) values ($1, 'joint', $2)`, [lead, msg]))).toBe(1)
      expect(await fails(db.query(`insert into public.lead_calls (lead_id, outcome, campaign_message_id) values ($1, 'joint', $2)`, [lead, msg]))).toBe('23505')
    })
  })

  it('pose puis déplace une séance (upsert sur le jour), et la base refuse une fin avant le début', async () => {
    await asUser(db, USERS.emir, async () => {
      const upsert = `insert into public.agenda_sessions (day, start_min, end_min, cancelled, updated_by) values ('2026-09-21', $1, $2, false, $3)
        on conflict (day) do update set start_min = excluded.start_min, end_min = excluded.end_min, cancelled = excluded.cancelled, updated_by = excluded.updated_by`
      expect(rowsOf(await db.query(upsert, [600, 750, USERS.emir]))).toBe(1)
      expect(rowsOf(await db.query(upsert, [840, 990, USERS.emir]))).toBe(1)
      expect(await fails(db.query(`insert into public.agenda_sessions (day, start_min, end_min) values ('2026-09-22', 600, 540)`))).toBe('23514')
    })
    expect((await db.query<{ start_min: number }>(`select start_min from public.agenda_sessions where day = '2026-09-21'`)).rows[0].start_min).toBe(840)
  })

  it('crée un RDV avec sa durée', async () => {
    await asUser(db, USERS.emir, async () => {
      expect(rowsOf(await db.query(`insert into public.rdv (title, rdv_date, duration_min, lead_id) values ('Visio test', '2026-09-22T08:00:00Z', 45, $1)`, [lead]))).toBe(1)
    })
  })

  it('supprime SA tâche ; celle d’une fonction edge, non (0 ligne, sans erreur : d’où le bouton masqué)', async () => {
    const orphan = (await db.query<{ id: string }>(`insert into public.tasks (title, status, priority, assigned_to, created_by) values ('Créée par une fonction edge', 'todo', 'normale', 'emir', null) returning id`)).rows[0].id
    await asUser(db, USERS.emir, async () => {
      const mine = (await db.query<{ id: string }>(`insert into public.tasks (title, status, priority, assigned_to, created_by, due_date, scheduled_at, duration_min)
        values ('Ma tâche', 'todo', 'normale', 'emir', $1, '2026-09-21', '2026-09-21T08:00:00Z', 30) returning id`, [USERS.emir])).rows[0].id
      expect(rowsOf(await db.query(`update public.tasks set due_date = '2026-09-22' where id = $1 returning id`, [mine]))).toBe(1)
      expect(rowsOf(await db.query(`delete from public.tasks where id = $1 returning id`, [mine]))).toBe(1)
      expect(rowsOf(await db.query(`delete from public.tasks where id = $1 returning id`, [orphan]))).toBe(0)
      expect(rowsOf(await db.query(`update public.tasks set status = 'done' where id = $1 returning id`, [orphan]))).toBe(1)
    })
    await asUser(db, USERS.naoufel, async () => {
      expect(rowsOf(await db.query(`delete from public.tasks where id = $1 returning id`, [orphan]))).toBe(1)
    })
  })

  it('le fil du débrief porte son auteur (created_by = auth.uid())', async () => {
    const who = await asUser(db, USERS.emir, async () =>
      (await db.query<{ created_by: string }>(`insert into public.debrief_messages (day, role, content) values ('2026-09-21', 'user', '1 : joint') returning created_by`)).rows[0].created_by)
    expect(who).toBe(USERS.emir)
  })
})

describe('un compte de l’application, hors dashboard', () => {
  it('ne lit ni n’écrit rien de l’agenda', async () => {
    // Contre-épreuve : les mêmes lectures rendent des lignes à Emir. Sans elle, ce test passerait
    // même si la requête ne ramenait jamais rien (piège : PGlite met affectedRows à 0 sur un SELECT).
    const vus = await asUser(db, USERS.emir, async () => rowsOf(await db.query(`select id from public.lead_calls`)))
    expect(vus).toBeGreaterThan(0)
    await asUser(db, USERS.app, async () => {
      expect(rowsOf(await db.query(`select id from public.lead_calls`))).toBe(0)
      expect(rowsOf(await db.query(`select id from public.debrief_messages`))).toBe(0)
      expect(await fails(db.query(`insert into public.lead_calls (lead_id, outcome) values ($1, 'joint')`, [lead]))).toBe('42501')
      expect(await fails(db.query(`insert into public.agenda_sessions (day, start_min, end_min) values ('2026-09-23', 540, 690)`))).toBe('42501')
    })
  })
})
