import { describe, it, expect } from 'vitest'
import { scriptSection } from '@/lib/callScript'

const SKELETON = `# Script d'appel — CFA France (offre accessibilité)

## Ouverture

_(à rédiger)_

## Questions de qualification

_(à rédiger)_

## Objections courantes

_(à rédiger)_`

const WRITTEN = `# Script d'appel

## Ouverture

Bonjour, Emir Boutaleb, MEMOVIA à Toulouse.

## Questions de qualification

- Combien d'apprentis RQTH déclarés cette année ?
- Qui monte le dossier de majoration ?

## Objections courantes

Pas de budget : la licence se joint au dossier du référent.`

describe('scriptSection', () => {
  it('rend null tant que la section est « à rédiger »', () => {
    expect(scriptSection(SKELETON, 'Questions de qualification')).toBeNull()
  })

  it('rend le texte de la section, sans le titre ni la section suivante', () => {
    expect(scriptSection(WRITTEN, 'Questions de qualification')).toBe("- Combien d'apprentis RQTH déclarés cette année ?\n- Qui monte le dossier de majoration ?")
  })

  it('ignore la casse et les accents du titre, accepte la dernière section', () => {
    expect(scriptSection(WRITTEN, 'objections')).toBe('Pas de budget : la licence se joint au dossier du référent.')
  })

  it('rend null sans script ou sans la section', () => {
    expect(scriptSection(null, 'Ouverture')).toBeNull()
    expect(scriptSection(WRITTEN, 'Prochaine étape')).toBeNull()
  })
})
