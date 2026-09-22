/**
 * La vue de l'agenda, rendue avec des données fictives (aucune base). Vérifie ce qu'un humain
 * regarderait : l'ordre de la séance, la fiche qui s'ouvre, les messages d'état, la navigation.
 */
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'sonner'
// AgendaPage importe le conteneur (useAgenda → client Supabase). La vue testée ici ne lit jamais la
// base : un client vide suffit, et évite d'exiger des variables d'environnement pour tester.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { AgendaView } from '@/modules/agenda/AgendaPage'
import { agendaFixture, noopActions, FIXTURE_TODAY } from './fixtures/agendaFixture'
import { CallPartiallySavedError } from '@/lib/callActions'
import type { AgendaActions } from '@/types/agenda'

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
    // L'issue se note ici même : les 5 issues de la Revue, et rien n'est enregistrable sans en choisir une.
    expect(within(sheet).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Joint', 'Pas répondu', 'Rappel demandé', 'Refus', 'Intéressé'])
    expect(within(sheet).getByRole('button', { name: 'Enregistrer l’appel' })).toBeDisabled()
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

describe('AgendaView · écritures', () => {
  const spied = (over: Partial<AgendaActions> = {}): AgendaActions => ({ ...noopActions, ...over })

  it('enregistre l’issue d’un appel depuis la fiche, avec sa note, puis referme la fiche', async () => {
    const user = userEvent.setup()
    const recordOutcome = vi.fn().mockResolvedValue(undefined)
    renderView({ actions: spied({ recordOutcome }) })
    await user.click(within(screen.getByTestId('agenda-grille-jour')).getByRole('button', { name: /MFR du Lauragais/ }))
    const sheet = screen.getByRole('complementary')
    await user.click(within(sheet).getByRole('radio', { name: 'Intéressé' }))
    await user.type(within(sheet).getByLabelText('Note d\'appel'), 'veut une démo')
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer l’appel' }))
    expect(recordOutcome).toHaveBeenCalledTimes(1)
    expect(recordOutcome.mock.calls[0][0]).toMatchObject({ key: 'msg:M3', campaign: { messageId: 'M3' } })
    // Une étape de campagne suit sa séquence : pas de date de relance à choisir, rien de passé pour elle.
    expect(within(sheet).queryByLabelText('Prochaine relance')).not.toBeInTheDocument()
    expect(recordOutcome.mock.calls[0].slice(1)).toEqual(['interesse', 'veut une démo', undefined])
    expect(await within(screen.getByRole('complementary')).findByText('Reste à faire')).toBeInTheDocument()
  })

  it('une relance hors campagne propose sa prochaine relance selon l’issue, et garde une date changée à la main', async () => {
    const user = userEvent.setup()
    const recordOutcome = vi.fn().mockResolvedValue(undefined)
    renderView({ actions: spied({ recordOutcome }) })
    await user.click(within(screen.getByTestId('agenda-grille-jour')).getByRole('button', { name: /CFA Agricole du Roussillon/ }))
    const sheet = screen.getByRole('complementary')
    await user.click(within(sheet).getByRole('radio', { name: 'Pas répondu' }))
    const date = within(sheet).getByLabelText('Prochaine relance')
    expect(date).toHaveValue('2026-09-16')
    fireEvent.change(date, { target: { value: '2026-09-24' } })
    // Une autre issue ne réécrit pas une date choisie à la main.
    await user.click(within(sheet).getByRole('radio', { name: 'Joint' }))
    expect(date).toHaveValue('2026-09-24')
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer l’appel' }))
    expect(recordOutcome.mock.calls[0][0]).toMatchObject({ key: 'lead:L5', campaign: null })
    expect(recordOutcome.mock.calls[0].slice(1)).toEqual(['joint', '', '2026-09-24'])
  })

  it('un refus sur une relance la clôt : aucune prochaine relance', async () => {
    const user = userEvent.setup()
    const recordOutcome = vi.fn().mockResolvedValue(undefined)
    renderView({ actions: spied({ recordOutcome }) })
    await user.click(within(screen.getByTestId('agenda-grille-jour')).getByRole('button', { name: /CFA Agricole du Roussillon/ }))
    const sheet = screen.getByRole('complementary')
    await user.click(within(sheet).getByRole('radio', { name: 'Refus' }))
    expect(within(sheet).getByLabelText('Prochaine relance')).toHaveValue('')
    expect(within(sheet).getByText('aucune : le lead sort des relances')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer l’appel' }))
    expect(recordOutcome.mock.calls[0].slice(1)).toEqual(['refus', '', null])
  })

  it('garde la fiche ouverte si l’enregistrement échoue', async () => {
    const user = userEvent.setup()
    const recordOutcome = vi.fn().mockRejectedValue(new Error('boom'))
    renderView({ actions: spied({ recordOutcome }) })
    await user.click(within(screen.getByTestId('agenda-grille-jour')).getByRole('button', { name: /MFR du Lauragais/ }))
    const sheet = screen.getByRole('complementary')
    await user.click(within(sheet).getByRole('radio', { name: 'Joint' }))
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer l’appel' }))
    expect(recordOutcome).toHaveBeenCalled()
    expect(within(screen.getByRole('complementary')).getByText('Objectif de l’appel')).toBeInTheDocument()
  })

  it('reporte un appel à la prochaine séance', async () => {
    const user = userEvent.setup()
    const postponeCall = vi.fn().mockResolvedValue('2026-09-15')
    renderView({ actions: spied({ postponeCall }) })
    await user.click(within(screen.getByTestId('agenda-grille-jour')).getByRole('button', { name: /MFR du Lauragais/ }))
    await user.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Reporter' }))
    // Le jour où l'appel s'affiche part avec lui : le report se compte depuis ce jour-là.
    expect(postponeCall.mock.calls[0][0]).toMatchObject({ key: 'msg:M3' })
    expect(postponeCall.mock.calls[0][1]).toBe(FIXTURE_TODAY)
  })

  it('appel écrit mais fiche non mise à jour : on le dit, et la fiche se ferme pour ne pas le ressaisir', async () => {
    const user = userEvent.setup()
    const warning = vi.spyOn(toast, 'warning')
    const recordOutcome = vi.fn().mockRejectedValue(new CallPartiallySavedError(new Error('boom')))
    renderView({ actions: spied({ recordOutcome }) })
    await user.click(within(screen.getByTestId('agenda-grille-jour')).getByRole('button', { name: /MFR du Lauragais/ }))
    await user.click(within(screen.getByRole('complementary')).getByRole('radio', { name: 'Joint' }))
    await user.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Enregistrer l’appel' }))
    expect(warning).toHaveBeenCalledWith(expect.stringMatching(/^Appel enregistré, mais/))
    expect(await within(screen.getByRole('complementary')).findByText('Reste à faire')).toBeInTheDocument()
    warning.mockRestore()
  })

  it('coche une tâche depuis le panneau', async () => {
    const user = userEvent.setup()
    const updateTask = vi.fn().mockResolvedValue(undefined)
    renderView({ actions: spied({ updateTask }) })
    await user.click(within(screen.getByRole('complementary')).getByRole('checkbox', { name: 'Terminer : Renvoyer l’accès démo' }))
    expect(updateTask).toHaveBeenCalledWith('T2', { done: true })
  })

  it('ajoute une tâche sans heure par le champ du panneau', async () => {
    const user = userEvent.setup()
    const createTask = vi.fn().mockResolvedValue(undefined)
    renderView({ actions: spied({ createTask }) })
    const panel = screen.getByRole('complementary')
    await user.type(within(panel).getByLabelText('Nouvelle tâche'), 'Relire la spec')
    await user.click(within(panel).getByRole('button', { name: 'Ajouter' }))
    expect(createTask).toHaveBeenCalledWith({ title: 'Relire la spec', day: FIXTURE_TODAY, startMin: null, durMin: 30, leadId: null })
    expect(within(panel).getByLabelText('Nouvelle tâche')).toHaveValue('')
  })

  it('garde le titre tapé si l’ajout échoue', async () => {
    const user = userEvent.setup()
    const createTask = vi.fn().mockRejectedValue(new Error('boom'))
    renderView({ actions: spied({ createTask }) })
    const panel = screen.getByRole('complementary')
    await user.type(within(panel).getByLabelText('Nouvelle tâche'), 'Relire la spec')
    await user.click(within(panel).getByRole('button', { name: 'Ajouter' }))
    expect(createTask).toHaveBeenCalled()
    expect(within(panel).getByLabelText('Nouvelle tâche')).toHaveValue('Relire la spec')
  })

  it('ouvre une tâche, change son heure et l’enregistre', async () => {
    const user = userEvent.setup()
    const updateTask = vi.fn().mockResolvedValue(undefined)
    renderView({ actions: spied({ updateTask }) })
    await user.click(within(screen.getByRole('complementary')).getByRole('button', { name: /^Renvoyer l’accès démo/ }))
    const form = screen.getByRole('complementary')
    expect(within(form).getByLabelText('Titre')).toHaveValue('Renvoyer l’accès démo')
    expect(within(form).getByLabelText('Heure')).toHaveValue('')
    await user.selectOptions(within(form).getByLabelText('Heure'), '900')
    await user.click(within(form).getByRole('button', { name: 'Enregistrer' }))
    // Seulement ce qui a changé : ni le statut, ni le titre, ni le lead ne sont réécrits.
    expect(updateTask).toHaveBeenCalledWith('T2', { startMin: 900 })
  })

  it('une tâche sans échéance qu’on termine ne reçoit pas la date du jour', async () => {
    const user = userEvent.setup()
    const updateTask = vi.fn().mockResolvedValue(undefined)
    renderView({ actions: spied({ updateTask }) })
    await user.click(within(screen.getByRole('complementary')).getByRole('button', { name: /^Ranger le vault/ }))
    const form = screen.getByRole('complementary')
    await user.click(within(form).getByRole('checkbox', { name: 'Terminée' }))
    await user.click(within(form).getByRole('button', { name: 'Enregistrer' }))
    expect(updateTask).toHaveBeenCalledWith('T5', { done: true })
  })

  it('au clavier, la poignée d’un bloc ouvre son formulaire (qui sait tout déplacer)', async () => {
    const user = userEvent.setup()
    renderView()
    await user.click(within(screen.getByTestId('agenda-grille-jour')).getByRole('button', { name: 'Modifier ou déplacer : Séance d’appels' }))
    expect(within(screen.getByRole('complementary')).getByLabelText('Jour')).toHaveValue(FIXTURE_TODAY)
  })

  it('ne propose pas de supprimer une tâche que la base refuserait de supprimer', async () => {
    const user = userEvent.setup()
    renderView()
    await user.click(within(screen.getByRole('complementary')).getByRole('button', { name: /^Renvoyer l’accès démo/ }))
    const form = screen.getByRole('complementary')
    expect(within(form).queryByRole('button', { name: 'Supprimer' })).toBeNull()
    expect(within(form).getByText(/on peut la terminer/)).toBeInTheDocument()
  })

  it('un clic sur un créneau vide ouvre la création, à l’heure du créneau', async () => {
    const user = userEvent.setup()
    const createTask = vi.fn().mockResolvedValue(undefined)
    renderView({ actions: spied({ createTask }) })
    // jsdom ne mesure rien : le haut de la colonne et le clic valent 0, donc le créneau de 8h.
    await user.click(within(screen.getByTestId('agenda-grille-jour')).getByTestId(`agenda-colonne-${FIXTURE_TODAY}`))
    const form = screen.getByRole('complementary')
    expect(within(form).getByLabelText('Heure')).toHaveValue('480')
    await user.type(within(form).getByLabelText('Titre'), 'Appeler le standard de Béziers')
    await user.click(within(form).getByRole('button', { name: 'Créer' }))
    expect(createTask).toHaveBeenCalledWith({ title: 'Appeler le standard de Béziers', day: FIXTURE_TODAY, startMin: 480, durMin: 30, leadId: null })
  })

  it('la séance d’appels s’ouvre en modification et se déplace par le formulaire', async () => {
    const user = userEvent.setup()
    const saveSession = vi.fn().mockResolvedValue(undefined)
    renderView({ actions: spied({ saveSession }) })
    await user.click(within(screen.getByTestId('agenda-grille-jour')).getByText(/Séance d’appels · 09:00 – 11:30/))
    const form = screen.getByRole('complementary')
    await user.selectOptions(within(form).getByLabelText('Heure'), '840')
    await user.click(within(form).getByRole('button', { name: 'Enregistrer' }))
    expect(saveSession).toHaveBeenCalledWith(FIXTURE_TODAY, 840, 150, FIXTURE_TODAY)
  })

  it('refuse de poser la séance sur un jour qui a la sienne, ou le week-end ; vendredi, oui', async () => {
    const user = userEvent.setup()
    const error = vi.spyOn(toast, 'error')
    const saveSession = vi.fn().mockResolvedValue(undefined)
    renderView({ actions: spied({ saveSession }) })
    await user.click(within(screen.getByTestId('agenda-grille-jour')).getByText(/Séance d’appels · 09:00 – 11:30/))
    const form = screen.getByRole('complementary')
    const day = within(form).getByLabelText('Jour')
    fireEvent.change(day, { target: { value: '2026-09-15' } })
    await user.click(within(form).getByRole('button', { name: 'Enregistrer' }))
    expect(error).toHaveBeenLastCalledWith(expect.stringMatching(/déjà sa séance/))
    fireEvent.change(day, { target: { value: '2026-09-19' } })
    await user.click(within(form).getByRole('button', { name: 'Enregistrer' }))
    expect(error).toHaveBeenLastCalledWith(expect.stringMatching(/lundi au vendredi/))
    expect(saveSession).not.toHaveBeenCalled()
    fireEvent.change(day, { target: { value: '2026-09-18' } })
    await user.click(within(form).getByRole('button', { name: 'Enregistrer' }))
    expect(saveSession).toHaveBeenCalledWith('2026-09-18', 540, 150, FIXTURE_TODAY)
    error.mockRestore()
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
