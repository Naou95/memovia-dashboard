/**
 * LogCallDialog — le geste central de la Phase 1 (log d'appel < 30 s).
 * Vérifie : submit bloqué sans issue, payload correct, fermeture après succès.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogCallDialog } from '@/modules/prospection/components/LogCallDialog'
import type { Lead } from '@/types/leads'

const lead = {
  id: 'lead-1',
  name: 'CFA Test',
  contact_phone: '05 61 00 00 00',
  archived: false,
} as Lead

describe('LogCallDialog', () => {
  it('submit désactivé tant qu\'aucune issue n\'est choisie', () => {
    render(<LogCallDialog lead={lead} onClose={() => {}} onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /logger l'appel/i })).toBeDisabled()
  })

  it('envoie le bon payload et ferme après succès', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<LogCallDialog lead={lead} onClose={onClose} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('radio', { name: 'Répondu' }))
    await user.type(screen.getByLabelText(/note/i), 'veut une démo')
    await user.click(screen.getByRole('button', { name: /logger l'appel/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('lead-1', {
        outcome: 'repondu',
        note: 'veut une démo',
        nextAction: undefined,
        followUpDate: undefined,
      })
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('reste ouvert si l\'enregistrement échoue', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('boom'))
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<LogCallDialog lead={lead} onClose={onClose} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('radio', { name: 'Pas de réponse' }))
    await user.click(screen.getByRole('button', { name: /logger l'appel/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
  })
})
