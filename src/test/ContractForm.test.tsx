/**
 * Tests Module 5 — ContractForm
 * Couvre : rendu création/édition, validation, soumission.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Contract } from '@/types/contracts'

import { ContractForm } from '@/modules/contracts/components/ContractForm'

// Suppress console noise
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const mockContract: Contract = {
  id: 'uuid-1',
  organization_name: 'CFA Compagnons du Devoir',
  organization_type: 'cfa',
  status: 'actif',
  license_count: 30,
  contact_name: 'Antoaneta',
  contact_email: 'antoaneta@cfa.fr',
  contact_phone: null,
  mrr_eur: 360,
  renewal_date: '2026-09-01',
  notes: 'Premier client',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  created_by: null,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ContractForm', () => {
  it('affiche le formulaire vide en mode création', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <ContractForm open={true} onClose={onClose} contract={null} onSubmit={onSubmit} />
    )

    // Title
    expect(screen.getByText('Nouveau contrat')).toBeInTheDocument()

    // Submit button label
    expect(screen.getByRole('button', { name: 'Créer le contrat' })).toBeInTheDocument()

    // organization_name field should be empty
    const nameInput = screen.getByLabelText(/nom de l'organisation/i) as HTMLInputElement
    expect(nameInput.value).toBe('')
  })

  it('pré-remplit les champs en mode édition', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <ContractForm
        open={true}
        onClose={onClose}
        contract={mockContract}
        onSubmit={onSubmit}
      />
    )

    // Title
    expect(screen.getByText('Modifier le contrat')).toBeInTheDocument()

    // Submit button label
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument()

    // Fields pre-filled
    const nameInput = screen.getByLabelText(/nom de l'organisation/i) as HTMLInputElement
    expect(nameInput.value).toBe('CFA Compagnons du Devoir')

    const contactInput = screen.getByLabelText(/^contact$/i) as HTMLInputElement
    expect(contactInput.value).toBe('Antoaneta')

    const emailInput = screen.getByLabelText(/email contact/i) as HTMLInputElement
    expect(emailInput.value).toBe('antoaneta@cfa.fr')
  })

  it('valide que organization_name est requis', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <ContractForm open={true} onClose={onClose} contract={null} onSubmit={onSubmit} />
    )

    // Submit without filling name
    fireEvent.click(screen.getByRole('button', { name: 'Créer le contrat' }))

    await waitFor(() => {
      expect(
        screen.getByText("Le nom de l'organisation est requis.")
      ).toBeInTheDocument()
    })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('appelle onSubmit avec les bonnes données', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <ContractForm open={true} onClose={onClose} contract={null} onSubmit={onSubmit} />
    )

    // Fill organization_name
    fireEvent.change(screen.getByLabelText(/nom de l'organisation/i), {
      target: { value: 'Nouvelle École' },
    })

    // Fill license count
    fireEvent.change(screen.getByLabelText(/licences/i), {
      target: { value: '20' },
    })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Créer le contrat' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    const submittedData = onSubmit.mock.calls[0][0]
    expect(submittedData.organization_name).toBe('Nouvelle École')
    expect(submittedData.license_count).toBe(20)
    expect(submittedData.status).toBe('prospect')
  })
})
