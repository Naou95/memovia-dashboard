import { describe, it, expect } from 'vitest'
import {
  extractAiZones,
  assembleBody,
  assembleSubject,
  stripAiMarks,
  runChecks,
  hasBlockingCheck,
  guessCivility,
  wordCount,
  SIGNATURE_EMIR,
} from '../../supabase/functions/_shared/campaignText'

const TEMPLATE = `Bonjour {{civilité}} {{nom}},

{{IA: le problème de cette cible}}

Nous adaptons les supports, {{IA: ce qui est repris}}. Le cours reste le sien.

{{IA: une seule question}}

{{signature}}

{{rgpd}}`

describe('campaignText — assemblage', () => {
  it('extrait les zones IA dans l\'ordre', () => {
    const zones = extractAiZones(TEMPLATE)
    expect(zones.map((z) => z.brief)).toEqual(['le problème de cette cible', 'ce qui est repris', 'une seule question'])
  })

  it('remplit civilité, nom, zones entre [[ ]], signature et pied RGPD', () => {
    const body = assembleBody({
      template: TEMPLATE,
      zones: ['Vos fiches ne seront pas réécrites.', 'grammages et photos', 'Est-ce une question chez vous ?'],
      lead: { name: 'CFA de Blagnac', contact_name: 'Fabienne Vernadat' },
    })
    expect(body.startsWith('Bonjour Madame Vernadat,')).toBe(true)
    expect(body).toContain('[[Vos fiches ne seront pas réécrites.]]')
    expect(body).toContain('supports, [[grammages et photos]]. Le cours')
    expect(body).toContain(SIGNATURE_EMIR)
    expect(body).toContain('répondez STOP')
    expect(body).not.toMatch(/\{\{/)
  })

  it('sans prénom connu, ne devine pas de civilité', () => {
    expect(guessCivility('Référent handicap')).toBe('')
    const body = assembleBody({ template: 'Bonjour {{civilité}} {{nom}},\n{{signature}}', zones: [], lead: { name: 'X', contact_name: null } })
    expect(body.startsWith('Bonjour,')).toBe(true)
  })

  it('objet : zone IA ou objet précédent en Re:', () => {
    expect(assembleSubject('{{IA: objet}}', 'Vos fiches techniques')).toBe('Vos fiches techniques')
    expect(assembleSubject('Re: {{objet_precedent}}', null, 'Adapter les fiches')).toBe('Re: Adapter les fiches')
    expect(assembleSubject('Re: {{objet_precedent}}', null, 'Re: Adapter les fiches')).toBe('Re: Adapter les fiches')
  })

  it('retire les marqueurs à l\'envoi', () => {
    expect(stripAiMarks('a [[b]] c')).toBe('a b c')
  })
})

describe('campaignText — contrôles', () => {
  const good = assembleBody({
    template: TEMPLATE,
    zones: ['Vos fiches ne seront pas réécrites.', 'grammages et photos', 'Est-ce une question chez vous ?'],
    lead: { name: 'CFA', contact_name: 'Fabienne Vernadat' },
  })

  it('un bon premier mail passe tout en vert', () => {
    const checks = runChecks({ subject: 'Adapter vos fiches', body: good, isReply: false, hasThread: false, isFirst: true })
    expect(checks.every((c) => c.status === 'ok')).toBe(true)
    expect(hasBlockingCheck(checks)).toBe(false)
  })

  it('un interdit bloque, même dans l\'objet', () => {
    const checks = runChecks({ subject: 'Une solution 100 % financée par l\'OPCO', body: good, isReply: false, hasThread: false, isFirst: true })
    expect(hasBlockingCheck(checks)).toBe(true)
    expect(checks.find((c) => c.status === 'ko')?.label).toContain('OPCO')
  })

  it('« sous 48 h » et « je me permets de vous relancer » sont refusés', () => {
    const bad = good.replace('Le cours reste le sien.', 'Je me permets de vous relancer, je vous montre le résultat sous 48 h.')
    const checks = runChecks({ subject: 'x', body: bad, isReply: true, hasThread: true, isFirst: false })
    expect(hasBlockingCheck(checks)).toBe(true)
  })

  it('premier mail sans pied RGPD : bloqué ; relance sans pied : autorisée', () => {
    const noRgpd = good.replace(/Vos coordonnées professionnelles[\s\S]*$/, '')
    expect(hasBlockingCheck(runChecks({ subject: 'x', body: noRgpd, isReply: false, hasThread: false, isFirst: true }))).toBe(true)
    expect(hasBlockingCheck(runChecks({ subject: 'x', body: noRgpd, isReply: true, hasThread: true, isFirst: false }))).toBe(false)
  })

  it('un champ {{ }} resté vide bloque', () => {
    expect(hasBlockingCheck(runChecks({ subject: 'x', body: 'Bonjour {{nom}},\nEmir Boutaleb\n', isReply: true, hasThread: true, isFirst: false }))).toBe(true)
  })

  it('deux questions : avertissement, pas blocage ; les mots se comptent hors signature', () => {
    const two = good.replace('Le cours reste le sien.', 'Le cours reste le sien, non ?')
    const checks = runChecks({ subject: 'x', body: two, isReply: false, hasThread: false, isFirst: true })
    expect(checks.find((c) => c.label.includes('questions'))?.status).toBe('warn')
    expect(hasBlockingCheck(checks)).toBe(false)
    expect(wordCount(good)).toBeLessThan(60)
  })
})
