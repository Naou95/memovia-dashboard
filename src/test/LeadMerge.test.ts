import { describe, it, expect } from 'vitest'
import {
  mergeTimeline,
  mergeLeadFromAnalysis,
  type ExistingLead,
  type IncomingAnalysis,
  type TimelineEntryLike,
} from '../../supabase/functions/_shared/leadMerge'

const sent1: TimelineEntryLike = { date: '2026-09-10', direction: 'envoyé', sujet: 'CAP maçon : le cours de techno', résumé: 'Mail 1 de la campagne' }
const call: TimelineEntryLike = { date: '2026-09-14', direction: 'appel', sujet: 'Appel · rappel', résumé: 'Standard, rappeler jeudi' }
const sent2: TimelineEntryLike = { date: '2026-09-21', direction: 'envoyé', sujet: 'Re: CAP maçon : le cours de techno', résumé: 'Mail 2 de la campagne' }
const reply: TimelineEntryLike = { date: '2026-09-22', direction: 'reçu', sujet: 'RE: CAP maçon : le cours de techno', résumé: 'Demande un exemple' }

const existing = (over: Partial<ExistingLead> = {}): ExistingLead => ({
  name: 'CFA du Bâtiment',
  status: 'contacte',
  maturity: 'froid',
  notes: 'Indicateurs PSH publiés : 41 accompagnés, 12 RQTH.',
  next_action: 'Rappeler jeudi matin',
  relance_count: 1,
  last_contact_date: '2026-09-14',
  timeline: [sent1, call, sent2],
  contact_role: 'Référente handicap',
  ...over,
})

const analysis = (over: Partial<IncomingAnalysis> = {}): IncomingAnalysis => ({
  name: 'C.F.A. Batiment Montauban',
  status: 'nouveau',
  maturity: 'froid',
  notes: 'Prospect intéressé par une démonstration.',
  next_action: 'Envoyer une présentation',
  relance_count: 0,
  last_contact_date: '2026-09-22',
  timeline: [sent1, reply],
  contact_role: 'Formatrice',
  ...over,
})

describe('mergeTimeline', () => {
  it('garde les appels et les envois de campagne, ajoute la réponse nouvelle', () => {
    const merged = mergeTimeline([sent1, call, sent2], [sent1, reply])
    expect(merged).toEqual([sent1, call, sent2, reply])
  })

  it('ne duplique rien quand la même analyse repasse', () => {
    const once = mergeTimeline([sent1, call], [sent1, reply])
    const twice = mergeTimeline(once, [sent1, reply])
    expect(twice).toEqual(once)
  })

  it('reconnaît un même mail malgré la casse, les accents et les préfixes Re:', () => {
    const variant = { ...sent1, sujet: 'RE: cap macon : LE COURS DE TECHNO', résumé: 'autre résumé' }
    expect(mergeTimeline([sent1], [variant])).toEqual([sent1])
  })

  it('distingue deux mails du même jour aux sujets différents', () => {
    const other = { ...sent1, sujet: 'Accès démo' }
    expect(mergeTimeline([sent1], [other])).toHaveLength(2)
  })

  it('insère une entrée nouvelle à sa place chronologique', () => {
    const early = { ...reply, date: '2026-09-01' }
    expect(mergeTimeline([sent1, call], [early]).map((e) => e.date)).toEqual(['2026-09-01', '2026-09-10', '2026-09-14'])
    const middle = { ...reply, date: '2026-09-12' }
    expect(mergeTimeline([sent1, call], [middle]).map((e) => e.date)).toEqual(['2026-09-10', '2026-09-12', '2026-09-14'])
  })

  it('ne réordonne jamais l’existant, même s’il n’était pas trié', () => {
    expect(mergeTimeline([call, sent1], [reply])).toEqual([call, sent1, reply])
    expect(mergeTimeline([call, sent1], [])).toEqual([call, sent1])
  })

  it('reconnaît un même mail daté à un jour près (jour de Paris contre en-tête UTC)', () => {
    const sameNextDay = { ...sent1, date: '2026-09-11', résumé: 'vu par le détecteur' }
    expect(mergeTimeline([sent1], [sameNextDay])).toEqual([sent1])
    const twoDaysLater = { ...sent1, date: '2026-09-12' }
    expect(mergeTimeline([sent1], [twoDaysLater])).toHaveLength(2)
  })

  it('ne confond pas un mail avec sa relance du lendemain, même objet', () => {
    const mail = { date: '2026-09-14', direction: 'envoyé', sujet: 'Sujet X', résumé: 'premier mail' }
    const followUp = { date: '2026-09-15', direction: 'envoyé', sujet: 'Re: Sujet X', résumé: 'relance' }
    // Le mail est reconnu à sa date exacte : il ne peut plus absorber la relance par la tolérance d'un jour.
    expect(mergeTimeline([mail], [mail, followUp])).toEqual([mail, followUp])
    // Et rejouer la même analyse ne duplique rien.
    expect(mergeTimeline([mail, followUp], [mail, followUp])).toEqual([mail, followUp])
  })

  it('une entrée existante n’absorbe qu’UNE entrée décalée d’un jour', () => {
    const mail = { date: '2026-09-14', direction: 'envoyé', sujet: 'Sujet X', résumé: 'a' }
    const before = { ...mail, date: '2026-09-13' }
    const after = { ...mail, date: '2026-09-15' }
    expect(mergeTimeline([mail], [before, after])).toHaveLength(2)
  })

  it('garde « R : » en tête d’objet, qui n’est pas un préfixe de réponse', () => {
    const a = { date: '2026-09-14', direction: 'reçu', sujet: 'R : devis', résumé: 'a' }
    const b = { date: '2026-09-14', direction: 'reçu', sujet: 'devis', résumé: 'b' }
    expect(mergeTimeline([a], [b])).toHaveLength(2)
  })

  it('sans objet, exige la même date pour ne rien confondre', () => {
    const a = { date: '2026-09-10', direction: 'reçu', sujet: '', résumé: 'a' }
    const b = { date: '2026-09-11', direction: 'reçu', sujet: '', résumé: 'b' }
    expect(mergeTimeline([a], [b])).toHaveLength(2)
    expect(mergeTimeline([a], [{ ...a, résumé: 'autre' }])).toEqual([a])
  })

  it('reconnaît les préfixes « Rép : », « RE[2]: », « TR : »', () => {
    for (const sujet of ['Rép : CAP maçon : le cours de techno', 'RE[2]: CAP maçon : le cours de techno', 'TR : Re: CAP maçon : le cours de techno']) {
      expect(mergeTimeline([sent1], [{ ...sent1, sujet }])).toEqual([sent1])
    }
  })

  it('accepte null des deux côtés', () => {
    expect(mergeTimeline(null, null)).toEqual([])
    expect(mergeTimeline(null, [reply])).toEqual([reply])
    expect(mergeTimeline([call], null)).toEqual([call])
  })

  it('conserve une entrée existante de forme inattendue', () => {
    const odd = { note: 'ancienne forme' } as unknown as TimelineEntryLike
    expect(mergeTimeline([odd, sent1], [reply])).toEqual([odd, sent1, reply])
  })
})

describe('mergeLeadFromAnalysis', () => {
  it('ne touche ni au nom, ni aux notes, ni à la prochaine action, ni au rôle déjà saisis', () => {
    const patch = mergeLeadFromAnalysis(existing(), analysis())
    expect(patch.name).toBeUndefined()
    expect(patch.notes).toBeUndefined()
    expect(patch.next_action).toBeUndefined()
    expect(patch.contact_role).toBeUndefined()
  })

  it('remplit les champs vides', () => {
    const patch = mergeLeadFromAnalysis(existing({ notes: null, next_action: '  ', contact_role: '' }), analysis())
    expect(patch.notes).toBe('Prospect intéressé par une démonstration.')
    expect(patch.next_action).toBe('Envoyer une présentation')
    expect(patch.contact_role).toBe('Formatrice')
  })

  it('ne fait jamais reculer le statut', () => {
    expect(mergeLeadFromAnalysis(existing({ status: 'en_discussion' }), analysis({ status: 'nouveau' })).status).toBeUndefined()
    expect(mergeLeadFromAnalysis(existing({ status: 'contacte' }), analysis({ status: 'contacte' })).status).toBeUndefined()
  })

  it('fait avancer le statut dans le pipeline', () => {
    expect(mergeLeadFromAnalysis(existing({ status: 'contacte' }), analysis({ status: 'en_discussion' })).status).toBe('en_discussion')
    expect(mergeLeadFromAnalysis(existing({ status: null }), analysis({ status: 'nouveau' })).status).toBe('nouveau')
  })

  it('ne touche jamais à perdu, gagne, actif', () => {
    for (const status of ['perdu', 'gagne', 'actif']) {
      expect(mergeLeadFromAnalysis(existing({ status }), analysis({ status: 'proposition' })).status).toBeUndefined()
    }
  })

  it('ne fait monter la maturité que vers le haut', () => {
    expect(mergeLeadFromAnalysis(existing({ maturity: 'chaud' }), analysis({ maturity: 'tiede' })).maturity).toBeUndefined()
    expect(mergeLeadFromAnalysis(existing({ maturity: 'froid' }), analysis({ maturity: 'tiede' })).maturity).toBe('tiede')
  })

  it('garde le plus grand compteur de relances et la date de contact la plus récente', () => {
    const patch = mergeLeadFromAnalysis(existing({ relance_count: 2, last_contact_date: '2026-09-14' }), analysis({ relance_count: 1, last_contact_date: '2026-09-22' }))
    expect(patch.relance_count).toBeUndefined()
    expect(patch.last_contact_date).toBe('2026-09-22')
    expect(mergeLeadFromAnalysis(existing({ last_contact_date: '2026-09-30' }), analysis()).last_contact_date).toBeUndefined()
  })

  it('fusionne la timeline sans perdre l’appel', () => {
    const patch = mergeLeadFromAnalysis(existing(), analysis())
    expect(patch.timeline).toEqual([sent1, call, sent2, reply])
  })

  it('rend un patch vide pour un lead déjà à jour', () => {
    const upToDate = existing({ timeline: [sent1, call, sent2, reply], last_contact_date: '2026-09-22' })
    expect(mergeLeadFromAnalysis(upToDate, analysis())).toEqual({})
  })
})
