/**
 * Fiche RDV — la trame de préparation est éditable comme le CR.
 * Vérifie : appel à trame vide, payload de sauvegarde, CR intact.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RdvDetailDialog } from '@/modules/rdv/RdvDetailDialog'
import type { Rdv } from '@/types/rdv'

const rdv = {
  id: 'rdv-1',
  title: 'Compagnons — Petrache',
  rdv_date: '2026-08-24T09:00:00.000Z',
  prep: null,
  cr: null,
  cr_status: 'manquant',
  transcript: null,
  audio_path: null,
} as Rdv

function renderDialog(over: Partial<Rdv> = {}, onSavePrep = vi.fn().mockResolvedValue(undefined)) {
  render(
    <RdvDetailDialog
      rdv={{ ...rdv, ...over }}
      onClose={() => {}}
      onSaveCr={vi.fn()}
      onSavePrep={onSavePrep}
      onUploadAudio={vi.fn()}
    />,
  )
  return onSavePrep
}

describe('RdvDetailDialog — trame de préparation', () => {
  it('propose « Ajouter une trame » quand le RDV n\'en a pas', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: /ajouter une trame/i })).toBeInTheDocument()
  })

  it('enregistre la trame saisie via onSavePrep', async () => {
    const onSavePrep = renderDialog()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /ajouter une trame/i }))
    await user.type(screen.getByLabelText(/trame de préparation/i), '## Objectif')
    await user.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => expect(onSavePrep).toHaveBeenCalledWith('rdv-1', '## Objectif'))
  })

  it('garde le CR éditable à côté de la trame', async () => {
    renderDialog({ prep: '## Objectif\n\nDémo réelle' })
    expect(screen.getByText('Démo réelle')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /saisir à la main/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /modifier/i })).toBeInTheDocument()
  })
})
