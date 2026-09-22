import { describe, it, expect } from 'vitest'
import {
  DEFAULT_WINDOW,
  addDays,
  assigneeForRole,
  buildAgenda,
  canDeleteTask,
  clampStart,
  classify,
  daySummary,
  diffDays,
  firstWorkdayFrom,
  hasSessionOn,
  isMine,
  isoWeekday,
  missedSessions,
  nextCallDay,
  parisDay,
  parisMinutes,
  parisToUtcIso,
  parseCallWindow,
  placeInSession,
  postponeTarget,
  prioritize,
  projectNextCalls,
  sessionFor,
  sessionMoveRefusal,
  snap,
  suggestFollowUp,
  taskUpdate,
  taskView,
  workWeek,
  type BuildInput,
} from '@/lib/agenda'
import type { AgendaLead, LeadCallLite, PendingCall, SessionOverride } from '@/types/agenda'
import type { Task } from '@/types/tasks'

// Semaine de référence : lundi 14/09/2026 → vendredi 18/09/2026.
const MON = '2026-09-14', TUE = '2026-09-15', WED = '2026-09-16', THU = '2026-09-17', FRI = '2026-09-18'
const NEXT_MON = '2026-09-21'

const lead = (over: Partial<AgendaLead> = {}): AgendaLead => ({
  id: 'L1', name: 'CFA Test', type: 'cfa', status: 'contacte', archived: false, maturity: 'froid',
  last_contact_date: null, follow_up_date: null, next_action: null, contact_name: null, contact_role: null,
  contact_phone: null, contact_email: null, why: null, pitch: null, assigned_to: null, ...over,
})

const pending = (over: Partial<PendingCall> = {}): PendingCall => ({
  key: 'msg:1', lead: lead(), source: 'campaign', dueDay: MON, callbackAt: null, campaign: null, ...over,
})

const task = (over: Partial<Task> = {}): Task => ({
  id: 'T1', title: 'Tâche', description: null, status: 'todo', priority: 'normale', due_date: null,
  assigned_to: 'emir', assignees: [], is_private: false, created_at: '', updated_at: '', created_by: null,
  lead_id: null, scheduled_at: null, duration_min: 30, auto_key: null, ...over,
})

const input = (over: Partial<BuildInput> = {}): BuildInput => ({
  today: MON, nowMin: 8 * 60, days: workWeek(MON), window: DEFAULT_WINDOW, overrides: [], pending: [], calls: [],
  leadsById: new Map(), rdvs: [], tasks: [], projections: [], ...over,
})

describe('dates de Paris', () => {
  it('lit le jour et l’heure de Paris, été comme hiver', () => {
    expect(parisDay('2026-09-14T07:30:00Z')).toBe(MON)
    expect(parisMinutes('2026-09-14T07:30:00Z')).toBe(9 * 60 + 30) // UTC+2
    expect(parisMinutes('2026-12-14T07:30:00Z')).toBe(8 * 60 + 30) // UTC+1
  })

  it('un instant tard le soir en UTC appartient déjà au lendemain à Paris', () => {
    expect(parisDay('2026-09-14T22:30:00Z')).toBe(TUE)
  })

  it('fait l’aller-retour jour + minutes → UTC → jour + minutes', () => {
    for (const [day, min] of [[MON, 540], ['2026-12-14', 540], ['2026-10-25', 600], ['2026-03-29', 600]] as const) {
      const iso = parisToUtcIso(day, min)
      expect(parisDay(iso)).toBe(day)
      expect(parisMinutes(iso)).toBe(min)
    }
  })

  it('9h à Paris vaut 07:00Z l’été et 08:00Z l’hiver, y compris le jour du changement d’heure', () => {
    expect(parisToUtcIso(MON, 540)).toBe('2026-09-14T07:00:00.000Z')
    expect(parisToUtcIso('2026-10-25', 540)).toBe('2026-10-25T08:00:00.000Z') // retour à l'heure d'hiver à 3h
    expect(parisToUtcIso('2026-10-24', 540)).toBe('2026-10-24T07:00:00.000Z')
  })

  it('calcule les jours sans dépendre du fuseau de la machine', () => {
    expect(addDays(FRI, 3)).toBe(NEXT_MON)
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
    expect(diffDays(NEXT_MON, MON)).toBe(7)
    expect(isoWeekday(MON)).toBe(1)
    expect(isoWeekday('2026-09-20')).toBe(7)
    expect(workWeek(WED)).toEqual([MON, TUE, WED, THU, FRI])
  })
})

describe('réglage du créneau', () => {
  it('retombe sur le défaut quand le réglage est illisible ou incohérent', () => {
    expect(parseCallWindow(null)).toEqual(DEFAULT_WINDOW)
    expect(parseCallWindow('pas du json')).toEqual(DEFAULT_WINDOW)
    expect(parseCallWindow('{"days":[],"start":"09:00","end":"11:30","slot_minutes":10}')).toEqual(DEFAULT_WINDOW)
    expect(parseCallWindow('{"days":[1],"start":"12:00","end":"11:30","slot_minutes":10}')).toEqual(DEFAULT_WINDOW)
  })

  it('lit un réglage valide', () => {
    expect(parseCallWindow('{"days":[2,4],"start":"14:00","end":"16:00","slot_minutes":15}')).toEqual({ days: [2, 4], start: '14:00', end: '16:00', slot_minutes: 15 })
  })
})

describe('séances d’appels', () => {
  it('lundi à jeudi par défaut, rien le vendredi', () => {
    expect(sessionFor(MON, DEFAULT_WINDOW, [])).toMatchObject({ startMin: 540, endMin: 690, overridden: false })
    expect(sessionFor(FRI, DEFAULT_WINDOW, [])).toBeNull()
  })

  it('une séance déplacée ou annulée l’emporte sur le défaut', () => {
    const moved: SessionOverride[] = [{ day: FRI, start_min: 600, end_min: 660, cancelled: false }, { day: TUE, start_min: 540, end_min: 690, cancelled: true }]
    expect(sessionFor(FRI, DEFAULT_WINDOW, moved)).toMatchObject({ startMin: 600, endMin: 660, overridden: true })
    expect(sessionFor(TUE, DEFAULT_WINDOW, moved)).toBeNull()
  })

  it('le prochain jour d’appels saute le vendredi et le week-end', () => {
    expect(nextCallDay(THU, DEFAULT_WINDOW, [])).toBe(THU)
    expect(nextCallDay(FRI, DEFAULT_WINDOW, [])).toBe(NEXT_MON)
    expect(nextCallDay(FRI, { ...DEFAULT_WINDOW, days: [] as number[] }, [], 5)).toBeNull()
  })

  it('propose la prochaine relance selon l’issue, toujours un jour de séance', () => {
    // Mercredi + 2 = vendredi, sans séance : lundi suivant.
    expect(suggestFollowUp('pas_repondu', WED, DEFAULT_WINDOW, [])).toBe(NEXT_MON)
    expect(suggestFollowUp('rappel', MON, DEFAULT_WINDOW, [])).toBe(WED)
    expect(suggestFollowUp('joint', WED, DEFAULT_WINDOW, [])).toBe('2026-09-23')
    expect(suggestFollowUp('interesse', WED, DEFAULT_WINDOW, [])).toBe('2026-09-23')
    expect(suggestFollowUp('refus', WED, DEFAULT_WINDOW, [])).toBeNull()
    // Séance annulée ce lundi-là : le jour d'après.
    const off: SessionOverride = { day: NEXT_MON, start_min: 540, end_min: 690, cancelled: true }
    expect(suggestFollowUp('pas_repondu', WED, DEFAULT_WINDOW, [off])).toBe('2026-09-22')
  })

  it('borne le calcul pour un appel dû depuis des années', () => {
    const started = Date.now()
    const n = missedSessions('2024-09-16', NEXT_MON, DEFAULT_WINDOW, [])
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThanOrEqual(40) // au plus 60 jours regardés, 4 séances par semaine
    expect(Date.now() - started).toBeLessThan(200)
  })

  it('compte les séances réellement manquées', () => {
    expect(missedSessions(FRI, NEXT_MON, DEFAULT_WINDOW, [])).toBe(0)
    expect(missedSessions(THU, NEXT_MON, DEFAULT_WINDOW, [])).toBe(1)
    expect(missedSessions(MON, THU, DEFAULT_WINDOW, [])).toBe(3)
  })
})

describe('priorité', () => {
  it('un appel dû vendredi et montré lundi n’est pas en retard ; dû jeudi, il l’est', () => {
    expect(classify(pending({ dueDay: FRI }), NEXT_MON, DEFAULT_WINDOW, [])).toMatchObject({ signal: 'etape_jour', lateDays: 0 })
    expect(classify(pending({ dueDay: THU }), NEXT_MON, DEFAULT_WINDOW, [])).toMatchObject({ signal: 'etape_retard', lateDays: 4 })
  })

  it('un rappel promis pour jeudi ne passe pas en tête dès lundi', () => {
    const thursday = pending({ dueDay: MON, callbackAt: '2026-09-17T08:00:00Z' })
    expect(classify(thursday, MON, DEFAULT_WINDOW, []).signal).toBe('etape_jour')
    expect(classify(thursday, THU, DEFAULT_WINDOW, []).signal).toBe('rappel_promis')
    // Une fois son jour passé, la promesse non tenue reste en tête.
    expect(classify(thursday, NEXT_MON, DEFAULT_WINDOW, []).signal).toBe('rappel_promis')
  })

  it('un rappel promis passe devant tout, même en retard', () => {
    expect(classify(pending({ dueDay: MON, callbackAt: '2026-09-16T08:00:00Z', source: 'followup' }), WED, DEFAULT_WINDOW, []).signal).toBe('rappel_promis')
  })

  it('ordonne : rappel promis, étape en retard, étape du jour, relance en retard, relance', () => {
    const calls = [
      classify(pending({ key: 'e', source: 'followup', dueDay: WED }), WED, DEFAULT_WINDOW, []),
      classify(pending({ key: 'c', dueDay: WED }), WED, DEFAULT_WINDOW, []),
      classify(pending({ key: 'd', source: 'followup', dueDay: MON }), WED, DEFAULT_WINDOW, []),
      classify(pending({ key: 'a', dueDay: WED, callbackAt: '2026-09-16T08:00:00Z' }), WED, DEFAULT_WINDOW, []),
      classify(pending({ key: 'b', dueDay: MON }), WED, DEFAULT_WINDOW, []),
    ]
    expect(prioritize(calls).map((c) => c.key)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('à signal égal : le plus chaud, puis le contact le plus ancien', () => {
    const calls = [
      classify(pending({ key: 'froid-recent', lead: lead({ maturity: 'froid', last_contact_date: '2026-09-10' }) }), MON, DEFAULT_WINDOW, []),
      classify(pending({ key: 'froid-ancien', lead: lead({ maturity: 'froid', last_contact_date: '2026-08-01' }) }), MON, DEFAULT_WINDOW, []),
      classify(pending({ key: 'chaud', lead: lead({ maturity: 'chaud', last_contact_date: '2026-09-12' }) }), MON, DEFAULT_WINDOW, []),
    ]
    expect(prioritize(calls).map((c) => c.key)).toEqual(['chaud', 'froid-ancien', 'froid-recent'])
  })

  it('tout le reste égal : l’échéance la plus ancienne d’abord, puis l’alphabet', () => {
    const calls = [
      classify(pending({ key: 'b-lundi', dueDay: NEXT_MON, lead: lead({ name: 'B' }) }), NEXT_MON, DEFAULT_WINDOW, []),
      classify(pending({ key: 'z-vendredi', dueDay: FRI, lead: lead({ name: 'Z' }) }), NEXT_MON, DEFAULT_WINDOW, []),
      classify(pending({ key: 'a-lundi', dueDay: NEXT_MON, lead: lead({ name: 'A' }) }), NEXT_MON, DEFAULT_WINDOW, []),
    ]
    expect(prioritize(calls).map((c) => c.key)).toEqual(['z-vendredi', 'a-lundi', 'b-lundi'])
  })
})

describe('placement dans la séance', () => {
  const session = sessionFor(MON, DEFAULT_WINDOW, [])!

  it('un créneau de 10 min par appel, 15 au plus dans 2h30', () => {
    const items = Array.from({ length: 17 }, (_, i) => i)
    const { placed, overflow } = placeInSession(items, session)
    expect(placed).toHaveLength(15)
    expect(placed[0].startMin).toBe(540)
    expect(placed[14].startMin).toBe(680)
    expect(overflow).toEqual([15, 16])
  })

  it('repart de l’heure qu’il est, arrondie au créneau suivant', () => {
    const { placed } = placeInSession(['a', 'b'], session, 9 * 60 + 22)
    expect(placed.map((p) => p.startMin)).toEqual([570, 580])
  })

  it('après la séance, tout part en « à reporter »', () => {
    const { placed, overflow } = placeInSession(['a', 'b'], session, 12 * 60)
    expect(placed).toEqual([])
    expect(overflow).toEqual(['a', 'b'])
  })
})

describe('grille', () => {
  it('aligne sur le quart d’heure et garde le bloc dans la journée', () => {
    expect(snap(9 * 60 + 7)).toBe(9 * 60)
    expect(snap(9 * 60 + 8)).toBe(9 * 60 + 15)
    expect(clampStart(7 * 60, 30)).toBe(8 * 60)
    expect(clampStart(17 * 60 + 50, 30)).toBe(17 * 60 + 30)
  })
})

describe('tâches', () => {
  it('une tâche planifiée s’affiche à son heure de Paris', () => {
    expect(taskView(task({ scheduled_at: '2026-09-16T13:00:00Z', due_date: WED }), MON)).toMatchObject({ day: WED, startMin: 15 * 60, lateDays: 0 })
  })

  it('une tâche sans heure s’affiche le jour de son échéance', () => {
    expect(taskView(task({ due_date: THU }), MON)).toMatchObject({ day: THU, startMin: null })
  })

  it('une tâche ouverte en retard remonte aujourd’hui, sans heure, avec son retard', () => {
    expect(taskView(task({ due_date: '2026-09-10' }), MON)).toMatchObject({ day: MON, startMin: null, lateDays: 4 })
    expect(taskView(task({ scheduled_at: '2026-09-11T13:00:00Z' }), MON)).toMatchObject({ day: MON, startMin: null, lateDays: 3 })
  })

  it('une tâche terminée reste à son jour, une tâche sans date n’entre pas dans la grille', () => {
    expect(taskView(task({ due_date: '2026-09-10', status: 'done' }), MON)).toMatchObject({ day: '2026-09-10', lateDays: 0 })
    expect(taskView(task(), MON)).toBeNull()
  })

  it('le week-end, les retards se posent sur le lundi qui suit, pas sur un samedi que personne n’affiche', () => {
    const SAT = '2026-09-19'
    expect(firstWorkdayFrom(SAT)).toBe(NEXT_MON)
    expect(firstWorkdayFrom('2026-09-20')).toBe(NEXT_MON)
    expect(firstWorkdayFrom(WED)).toBe(WED)
    expect(taskView(task({ due_date: '2026-09-10' }), SAT, firstWorkdayFrom(SAT))).toMatchObject({ day: NEXT_MON, lateDays: 9 })
    const nextWeek = buildAgenda(input({ today: SAT, days: workWeek(NEXT_MON), tasks: [task({ id: 'late', due_date: '2026-09-10' })] }))
    expect(nextWeek[0].allDayTasks.map((t) => [t.task.id, t.lateDays])).toEqual([['late', 9]])
  })

  it('« mes tâches » passe par le rôle', () => {
    expect(assigneeForRole('admin_bizdev')).toBe('emir')
    expect(assigneeForRole('admin_full')).toBe('naoufel')
    expect(isMine(task({ assigned_to: 'emir' }), 'emir', null)).toBe(true)
    expect(isMine(task({ assigned_to: 'naoufel', assignees: ['emir'] }), 'emir', null)).toBe(true)
    expect(isMine(task({ assigned_to: 'naoufel' }), 'emir', null)).toBe(false)
    expect(isMine(task({ assigned_to: null, created_by: 'u1' }), 'emir', 'u1')).toBe(true)
  })

  it('suppression : ce que la base accepte, jamais une tâche automatique', () => {
    expect(canDeleteTask(task({ created_by: 'u1' }), 'admin_bizdev', 'u1')).toBe(true)
    expect(canDeleteTask(task({ created_by: null }), 'admin_bizdev', 'u1')).toBe(false) // créée par une fonction edge
    expect(canDeleteTask(task({ created_by: 'u2' }), 'admin_bizdev', 'u1')).toBe(false)
    expect(canDeleteTask(task({ created_by: null }), 'admin_full', 'u1')).toBe(true)
    expect(canDeleteTask(task({ created_by: 'u1', auto_key: 'rdv_prep:R1' }), 'admin_full', 'u1')).toBe(false)
    expect(canDeleteTask(task({ created_by: null }), 'admin_bizdev', null)).toBe(false)
  })
})

describe('modifier une tâche', () => {
  const planned = task({ status: 'en_cours', due_date: WED, scheduled_at: '2026-09-16T08:00:00Z', lead_id: 'L1' }) // mer. 10:00

  it('n’écrit que ce qui change : une tâche « en cours » renommée reste en cours', () => {
    expect(taskUpdate(planned, { title: 'Nouveau titre', day: WED, startMin: 600, durMin: 30, leadId: 'L1', done: false }, MON)).toEqual({ title: 'Nouveau titre' })
  })

  it('cocher termine, décocher ne rouvre que ce qui était terminé', () => {
    expect(taskUpdate(planned, { done: true }, MON)).toEqual({ status: 'done' })
    expect(taskUpdate(task({ status: 'done' }), { done: false }, MON)).toEqual({ status: 'todo' })
    expect(taskUpdate(task({ status: 'todo' }), { done: false }, MON)).toEqual({})
  })

  it('déplacer écrit le jour et le créneau ensemble, en heure de Paris', () => {
    expect(taskUpdate(planned, { day: THU, startMin: 14 * 60 }, MON)).toEqual({ due_date: THU, scheduled_at: '2026-09-17T12:00:00.000Z' })
    // Changer l'heure seule garde le jour ; « journée » retire l'heure.
    expect(taskUpdate(planned, { startMin: 11 * 60 }, MON)).toEqual({ due_date: WED, scheduled_at: '2026-09-16T09:00:00.000Z' })
    expect(taskUpdate(planned, { day: FRI, startMin: null }, MON)).toEqual({ due_date: FRI, scheduled_at: null })
  })

  it('une tâche sans échéance ne reçoit une date que si on lui en donne une', () => {
    const undated = task({ due_date: null, scheduled_at: null })
    expect(taskUpdate(undated, { title: 'Ranger le vault' }, MON)).toEqual({ title: 'Ranger le vault' })
    expect(taskUpdate(undated, { done: true }, MON)).toEqual({ status: 'done' })
    expect(taskUpdate(undated, { startMin: 600 }, MON)).toEqual({ due_date: MON, scheduled_at: '2026-09-14T08:00:00.000Z' })
  })
})

describe('reporter et déplacer une séance', () => {
  it('reporter part du jour où l’appel s’affiche, jamais avant', () => {
    // Lundi, fiche d'un appel dû jeudi ouverte en vue jeudi : report au lundi suivant, pas au mardi.
    expect(postponeTarget(MON, THU, THU, DEFAULT_WINDOW, [])).toBe(NEXT_MON)
    // Appel en retard montré aujourd'hui : la séance de demain.
    expect(postponeTarget(TUE, MON, TUE, DEFAULT_WINDOW, [])).toBe(WED)
    // Dû vendredi, montré lundi suivant : le mardi d'après, pas le même lundi.
    expect(postponeTarget(THU, FRI, NEXT_MON, DEFAULT_WINDOW, [])).toBe('2026-09-22')
    // Séance annulée le lendemain : la suivante.
    const off: SessionOverride = { day: WED, start_min: 540, end_min: 690, cancelled: true }
    expect(postponeTarget(TUE, TUE, TUE, DEFAULT_WINDOW, [off])).toBe(THU)
  })

  it('une séance ne va ni sur un jour qui a déjà la sienne, ni le week-end', () => {
    const on = (d: string) => [MON, TUE, WED, THU].includes(d)
    expect(sessionMoveRefusal(MON, MON, on)).toBeNull() // même jour, autre heure
    expect(sessionMoveRefusal(MON, FRI, on)).toBeNull()
    expect(sessionMoveRefusal(MON, WED, on)).toMatch(/déjà sa séance/)
    expect(sessionMoveRefusal(MON, '2026-09-19', on)).toMatch(/lundi au vendredi/)
    expect(sessionMoveRefusal('', WED, on)).toMatch(/déjà sa séance/) // création
  })

  it('la semaine affichée fait foi pour savoir si un jour a une séance', () => {
    const week = buildAgenda(input({ overrides: [{ day: TUE, start_min: 540, end_min: 690, cancelled: true }] }))
    expect(hasSessionOn(TUE, week, DEFAULT_WINDOW)).toBe(false)
    expect(hasSessionOn(WED, week, DEFAULT_WINDOW)).toBe(true)
    expect(hasSessionOn('2026-09-24', week, DEFAULT_WINDOW)).toBe(true) // hors semaine : le créneau par défaut
    expect(hasSessionOn('2026-09-25', week, DEFAULT_WINDOW)).toBe(false)
  })
})

describe('projection', () => {
  const steps = [
    { campaign_id: 'C', position: 1, kind: 'email' as const, wait_days: 0, name: 'Mail 1' },
    { campaign_id: 'C', position: 2, kind: 'call' as const, wait_days: 4, name: 'Appel au standard' },
    { campaign_id: 'C', position: 3, kind: 'email' as const, wait_days: 6, name: 'Mail 2' },
  ]
  const enr = (over = {}) => ({ id: 'E1', lead_id: 'L1', campaign_id: 'C', current_position: 1, next_due_at: '2026-09-14T07:00:00Z', ...over })

  it('estime l’appel qui suit un mail pas encore parti', () => {
    expect(projectNextCalls([enr()], steps, new Set())).toEqual([{ enrollmentId: 'E1', leadId: 'L1', day: FRI, stepName: 'Appel au standard' }])
  })

  it('une étape d’appel courante sans brouillon se projette à sa date', () => {
    expect(projectNextCalls([enr({ current_position: 2, next_due_at: '2026-09-17T07:00:00Z' })], steps, new Set())[0].day).toBe(THU)
  })

  it('ne projette ni un appel déjà en brouillon, ni plus d’une étape', () => {
    expect(projectNextCalls([enr({ current_position: 2 })], steps, new Set(['E1']))).toEqual([])
    expect(projectNextCalls([enr({ current_position: 3 })], steps, new Set())).toEqual([])
  })
})

describe('buildAgenda', () => {
  it('reporte au lundi un appel dû vendredi, sans le dire en retard, et le signale vendredi', () => {
    const days = [...workWeek(MON), NEXT_MON]
    const week = buildAgenda(input({ days, pending: [pending({ dueDay: FRI })] }))
    const fri = week.find((d) => d.day === FRI)!
    const mon = week.find((d) => d.day === NEXT_MON)!
    expect(fri.rows).toEqual([])
    expect(fri.chips.map((c) => c.label)).toEqual(['1 appel dû · hors séance → lun. 21'])
    expect(mon.rows).toHaveLength(1)
    expect(mon.rows[0]).toMatchObject({ kind: 'pending', call: { signal: 'etape_jour', lateDays: 0 } })
  })

  it('remonte aujourd’hui un appel d’hier jamais passé', () => {
    const week = buildAgenda(input({ today: TUE, pending: [pending({ dueDay: MON })] }))
    expect(week.find((d) => d.day === MON)!.rows).toEqual([])
    expect(week.find((d) => d.day === TUE)!.rows[0]).toMatchObject({ call: { signal: 'etape_retard', lateDays: 1 } })
  })

  it('liste d’abord les appels faits, à leur heure réelle, puis les appels à passer après l’heure qu’il est', () => {
    const calls: LeadCallLite[] = [
      { id: 'c1', lead_id: 'L1', outcome: 'joint', note: null, called_at: '2026-09-14T07:03:00Z', campaign_message_id: null, callback_at: null, debriefed_at: null, cr: null },
    ]
    const [mon] = buildAgenda(input({ nowMin: 9 * 60 + 22, days: [MON], calls, pending: [pending({ key: 'p1' }), pending({ key: 'p2' })] }))
    expect(mon.rows.map((r) => [r.kind, r.startMin])).toEqual([['done', 543], ['pending', 570], ['pending', 580]])
    expect(mon.chips[0]).toEqual({ tone: 'danger', label: '1 appel sans CR' })
    expect(daySummary(mon)).toEqual({ total: 3, done: 1, pending: 2, noCr: 1 })
  })

  it('range RDV et tâches planifiées en blocs, les tâches sans heure dans la ligne « journée »', () => {
    const [mon] = buildAgenda(input({
      days: [MON],
      rdvs: [{ id: 'r1', title: 'Visio', rdv_date: '2026-09-14T12:00:00Z', lead_id: null, duration_min: 45 }],
      tasks: [task({ id: 'a', due_date: MON }), task({ id: 'b', scheduled_at: '2026-09-14T09:30:00Z', due_date: MON }), task({ id: 'c', due_date: '2026-09-01' })],
    }))
    expect(mon.blocks.map((b) => [b.kind, b.startMin, b.durMin])).toEqual([['rdv', 14 * 60, 45], ['task', 11 * 60 + 30, 30]])
    expect(mon.allDayTasks.map((t) => [t.task.id, t.lateDays])).toEqual([['c', 13], ['a', 0]])
  })

  it('compte les appels estimés sur leur jour d’appels', () => {
    const week = buildAgenda(input({ projections: [{ enrollmentId: 'E1', leadId: 'L1', day: WED, stepName: 'Appel' }] }))
    expect(week.find((d) => d.day === WED)!.chips).toEqual([{ tone: 'dashed', label: '1 appel prévu (estimé)' }])
  })

  it('sans séance ce jour-là, rien n’est placé', () => {
    const [fri] = buildAgenda(input({ days: [FRI], today: FRI }))
    expect(fri.session).toBeNull()
    expect(fri.rows).toEqual([])
  })
})
