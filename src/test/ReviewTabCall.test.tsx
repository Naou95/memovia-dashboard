import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { ReviewTab } from '@/modules/campagnes/components/ReviewTab'
import type { UseCampaignResult } from '@/hooks/useCampaigns'
import type { Campaign, CampaignStep, ReviewItem } from '@/types/campagnes'
import type { Lead } from '@/types/leads'

// Données fictives : aucun établissement ni numéro réel.
const campaign = { id: 'C1', name: 'Test', emoji: '📞', status: 'live', sender_email: 'test@exemple.test', owner: 'emir', created_at: '', updated_at: '' } as Campaign
const step: CampaignStep = { id: 'S2', campaign_id: 'C1', position: 2, kind: 'call', wait_days: 4, name: 'Appel J+4', subject_template: null, body_template: null, ai_brief: 'Demander le référent handicap.', created_at: '', updated_at: '' }
const lead = { id: 'L1', name: 'CFA Fictif', contact_name: null, contact_role: null, contact_email: 'contact@exemple.test', contact_phone: '01 00 00 00 00' } as unknown as Lead

function callItem(id: string, dueAt: string): ReviewItem {
  return {
    id, enrollment_id: 'E1', step_id: 'S2', kind: 'call', status: 'draft', subject: null, body: null, checks: null, context: null,
    due_at: dueAt, sent_at: null, message_id: null, outcome: null, note: null, error: null, validated_by: null, created_at: '', updated_at: '',
    enrollment: { id: 'E1', campaign_id: 'C1', lead_id: 'L1', status: 'active', current_position: 2, next_due_at: dueAt, stop_reason: null, thread_message_id: null, thread_subject: null, started_at: '', updated_at: '', lead },
    step,
  }
}

function renderReview(items: ReviewItem[], initialMessageId: string | null) {
  const data = { items, steps: [step], sendMessage: vi.fn(), skipMessage: vi.fn(), postponeMessage: vi.fn(), stopEnrollment: vi.fn(), completeCall: vi.fn() } as unknown as UseCampaignResult
  return render(<MemoryRouter><ReviewTab data={data} campaign={campaign} initialMessageId={initialMessageId} /></MemoryRouter>)
}

describe('Revue · fiche d’appel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-17T08:00:00Z')) // jeudi 17, 10:00 à Paris
  })
  afterEach(() => vi.useRealTimers())

  it('garde ses cinq issues et son bouton d’enregistrement', () => {
    renderReview([callItem('M1', '2026-09-17T07:00:00Z')], null)
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Enregistrer l\'appel' })).toBeDisabled()
  })

  it('un appel en retard ouvre l’agenda à aujourd’hui, là où il s’affiche', () => {
    renderReview([callItem('M1', '2026-09-14T07:00:00Z')], null)
    expect(screen.getByRole('link', { name: /Ouvrir dans l’agenda/ })).toHaveAttribute('href', '/agenda?date=2026-09-17')
  })

  it('un appel à venir ouvre l’agenda à son jour', () => {
    renderReview([callItem('M2', '2026-09-21T07:00:00Z')], 'M2')
    expect(screen.getByRole('link', { name: /Ouvrir dans l’agenda/ })).toHaveAttribute('href', '/agenda?date=2026-09-21')
  })
})
