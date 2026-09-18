/**
 * La vue de l'agenda, rendue avec des données fictives (aucune base). Vérifie ce qu'un humain
 * regarderait : l'ordre de la séance, la fiche qui s'ouvre, les messages d'état, la navigation.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
// AgendaPage importe le conteneur (useAgenda → client Supabase). La vue testée ici ne lit jamais la
// base : un client vide suffit, et évite d'exiger des variables d'environnement pour tester.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { AgendaView } from '@/modules/agenda/AgendaPage'
import { agendaFixture, FIXTURE_TODAY } from './fixtures/agendaFixture'

const renderView = (over = {}, view: 'jour' | 'semaine' = 'jour', onGo = vi.fn()) => {
  render(
    <MemoryRouter>
      <AgendaView agenda={agendaFixture(over)} date={FIXTURE_TODAY} view={view} onGo={onGo} />
    </MemoryRouter>,
  )
  return onGo
}

describe('AgendaView · vue jour', () => {
  it('titre, séance et compteur d’appels sans CR', () => {
    renderView()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Lundi 14 septembre')
    expect(screen.getAllByText(/Séance d’appels · 09:00 – 11:30/).length).toBeGreaterThan(0)
    expect(screen.getByText('1 appel sans compte rendu')).toBeInTheDocument()
  })

  it('liste les appels faits à leur heure, puis ceux à passer par priorité, à partir de l’heure qu’il est', () => {
    renderView()
    const grid = screen.getByTestId('agenda-grille-jour')
    const rows = within(grid).getAllByRole('button').filter((b) => /^\d{2}:\d{2}/.test(b.textContent ?? ''))
    expect(rows.map((r) => r.textContent?.slice(0, 5))).toEqual(['09:02', '09:11', '09:30', '09:40', '09:50'])
    expect(rows[0]).toHaveTextContent('CFA Automobile du Tarn')
    expect(rows[0]).toHaveTextContent('Joint · CR à écrire')
    expect(rows[1]).toHaveTextContent('✓ Rappel demandé · CR')
    // Deux étapes de campagne à égalité : celle due vendredi (jour sans séance, donc pas « en retard »)
    // passe avant celle due aujourd'hui. La relance hors campagne vient en dernier.
    expect(rows[2]).toHaveTextContent('MFR du Lauragais')
    expect(rows[2]).toHaveTextContent('Campagne · à appeler')
    expect(rows[3]).toHaveTextContent('CFA Coiffure & Esthétique')
    expect(rows[4]).toHaveTextContent('CFA Agricole du Roussillon')
    expect(rows[4]).toHaveTextContent('Relance')
  })

  it('ouvre la fiche d’appel au clic, avec ses rubriques, puis la referme', async () => {
    const user = userEvent.setup()
    renderView()
    const grid = screen.getByTestId('agenda-grille-jour')
    await user.click(within(grid).getByRole('button', { name: /MFR du Lauragais/ }))
    const sheet = screen.getByRole('complementary')
    expect(within(sheet).getByRole('heading', { level: 2 })).toHaveTextContent('MFR du Lauragais')
    for (const title of ['Objectif de l’appel', 'Où on en est', 'Pourquoi eux', 'Pitch', 'À poser pendant l’appel', 'Interdits', 'Historique · 90 derniers jours']) {
      expect(within(sheet).getByText(title)).toBeInTheDocument()
    }
    expect(within(sheet).getByText(/Demander le référent handicap par son nom/)).toBeInTheDocument()
    expect(within(sheet).getByText(/Combien d’apprentis RQTH/)).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: /Appeler/ })).toHaveAttribute('href', 'tel:0500000003')
    expect(within(sheet).getByRole('link', { name: 'ouvrir cette étape' })).toHaveAttribute('href', '/campagnes/C1?tab=revue&message=M3')
    await user.click(within(sheet).getByRole('button', { name: /Agenda/ }))
    expect(within(screen.getByRole('complementary')).getByText('Reste à faire')).toBeInTheDocument()
  })

  it('ouvre aussi la fiche d’un appel déjà passé, avec son issue et sa note, et Échap la referme', async () => {
    const user = userEvent.setup()
    renderView()
    await user.click(within(screen.getByTestId('agenda-grille-jour')).getByRole('button', { name: /CFA Automobile du Tarn/ }))
    const sheet = screen.getByRole('complementary')
    expect(within(sheet).getByText('Appel passé')).toBeInTheDocument()
    expect(within(sheet).getByText('Joint · CR à écrire')).toBeInTheDocument()
    expect(within(sheet).getByText(/Joint M\. Dautry\. 3 RQTH/)).toBeInTheDocument()
    expect(within(sheet).getByText('Historique · 90 derniers jours')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(within(screen.getByRole('complementary')).getByText('Reste à faire')).toBeInTheDocument()
  })

  it('résume la journée : prochain appel, mails à valider, tâches dont celle en retard', () => {
    renderView()
    const panel = screen.getByRole('complementary')
    expect(within(panel).getByText(/Prochain · 09:30/)).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: /4 → Campagnes/ })).toHaveAttribute('href', '/campagnes')
    expect(within(panel).getByText('Contacter TBS Alumni')).toBeInTheDocument()
    expect(within(panel).getByText('en retard de 12 j')).toBeInTheDocument()
    expect(within(panel).getByText(/1 tâche sans échéance/)).toBeInTheDocument()
  })

  it('dit clairement quand la migration n’est pas appliquée', () => {
    renderView({ week: [], error: 'La migration 00056 (agenda) n’est pas appliquée sur cette base.', schemaMissing: true })
    expect(screen.getByText(/00056_agenda\.sql/)).toBeInTheDocument()
  })
})

describe('AgendaView · vue semaine', () => {
  it('affiche les cinq jours, reporte au lundi l’appel dû vendredi et signale l’estimé', () => {
    renderView({}, 'semaine')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Semaine 38')
    expect(screen.getAllByRole('button', { name: /^(Lun|Mar|Mer|Jeu|Ven)\.\s*\d+$/ })).toHaveLength(5)
    expect(screen.getByText(/1 appel dû · hors séance → lun\. 21/)).toBeInTheDocument()
    expect(screen.getByText('1 appel prévu (estimé)')).toBeInTheDocument()
  })

  it('un clic sur un jour ouvre sa vue jour', async () => {
    const user = userEvent.setup()
    const onGo = renderView({}, 'semaine')
    await user.click(screen.getByRole('button', { name: /^Jeu\.\s*17$/ }))
    expect(onGo).toHaveBeenCalledWith({ date: '2026-09-17', vue: 'jour' })
  })
})
