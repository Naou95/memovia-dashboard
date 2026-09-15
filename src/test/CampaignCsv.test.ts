import { describe, it, expect } from 'vitest'
import { parseCampaignCsv, parseCsv, firstEmail } from '@/lib/campaignCsv'

const LISTE_13_09 = [
  'Établissement,SIRET,UAI,Email du catalogue,Ville du siège,Région,Département des formations,Métiers dominants,Formations CAP/bac pro au catalogue,Part métiers d atelier (%),Niveau de décision,Forme juridique,Stagiaires déclarés,Formateurs déclarés,Déjà en cours',
  '"CFA de Blagnac",123,0310001A,"accompagnement@cfablagnac.org, direction@cfablagnac.org",Toulouse,Occitanie,31,"fleuriste, boulanger",39,80,une signature (association),Association,412,38,',
  'Groupe sans mail,456,,,Lyon,AURA,69,coiffure,12,50,,SAS,10,2,oui',
  '"BTP CFA ""AURA""",789,,marie.garachon@btpcfa-aura.fr,Lyon,AURA,69,"maçon, plâtre",231,100,une signature,Association,,,',
].join('\n')

describe('parseCsv', () => {
  it('gère guillemets doublés, virgules entre guillemets et CRLF', () => {
    const rows = parseCsv('a,b\r\n"x, y","dit ""oui"""\r\n')
    expect(rows).toEqual([['a', 'b'], ['x, y', 'dit "oui"']])
  })

  it('détecte le point-virgule', () => {
    expect(parseCsv('nom;email\nA;a@b.fr')).toEqual([['nom', 'email'], ['A', 'a@b.fr']])
  })
})

describe('firstEmail', () => {
  it('prend la première adresse et la met en minuscules', () => {
    expect(firstEmail('Accompagnement@CFA.org, autre@cfa.org')).toBe('accompagnement@cfa.org')
    expect(firstEmail('pas un mail')).toBe('')
  })
})

describe('parseCampaignCsv, format du 13/09', () => {
  const { contacts, skipped } = parseCampaignCsv(LISTE_13_09)

  it('ignore les lignes sans email', () => {
    expect(skipped).toBe(1)
    expect(contacts.map((c) => c.name)).toEqual(['CFA de Blagnac', 'BTP CFA "AURA"'])
  })

  it('prend la première adresse du catalogue', () => {
    expect(contacts[0].contact_email).toBe('accompagnement@cfablagnac.org')
  })

  it('met les colonnes descriptives en notes « Clé: valeur », sans SIRET ni UAI ni stagiaires', () => {
    const notes = contacts[0].notes || ''
    expect(notes).toContain('Ville du siège: Toulouse')
    expect(notes).toContain('Métiers dominants: fleuriste, boulanger')
    expect(notes).toContain('Formations CAP/bac pro au catalogue: 39')
    expect(notes).toContain('Niveau de décision: une signature (association)')
    expect(notes).not.toMatch(/SIRET|UAI|Stagiaires|Formateurs|Déjà en cours/)
    expect(contacts[0].contact_name).toBeNull()
  })
})

describe('parseCampaignCsv, format générique', () => {
  it('lit name/email/contact/fonction/téléphone avec des points-virgules', () => {
    const csv = 'Nom;Email;Contact;Fonction;Téléphone\nCFA Muret;a@muret.fr;Anne Dislaire;référente handicap;05 61 00 00 00\nSans mail;;X;;'
    const { contacts, skipped } = parseCampaignCsv(csv)
    expect(skipped).toBe(1)
    expect(contacts).toEqual([
      {
        name: 'CFA Muret',
        contact_email: 'a@muret.fr',
        contact_name: 'Anne Dislaire',
        contact_role: 'référente handicap',
        contact_phone: '05 61 00 00 00',
        notes: null,
      },
    ])
  })

  it('rend vide un fichier sans colonne email', () => {
    expect(parseCampaignCsv('nom,ville\nA,Toulouse')).toEqual({ contacts: [], skipped: 1 })
  })
})
