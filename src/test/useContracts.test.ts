import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// vi.hoisted permet de déclarer des variables utilisées dans vi.mock (hoisted)
const {
  mockOrder,
  mockSelect,
  mockEq,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockFrom,
  mockSubscribe,
  mockOn,
  mockChannel,
  mockRemoveChannel,
} = vi.hoisted(() => {
  const mockOrder = vi.fn()
  const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
  const mockEq = vi.fn()
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  })

  const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() })
  const mockOn = vi.fn().mockReturnValue({ subscribe: mockSubscribe })
  const mockChannel = vi.fn().mockReturnValue({ on: mockOn })
  const mockRemoveChannel = vi.fn()

  return {
    mockOrder,
    mockSelect,
    mockEq,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockFrom,
    mockSubscribe,
    mockOn,
    mockChannel,
    mockRemoveChannel,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

// On importe APRÈS le mock
import { useContracts } from '@/hooks/useContracts'
import type { Contract } from '@/types/contracts'

const mockContracts: Contract[] = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    organization_name: 'CFA Compagnons du Devoir',
    organization_type: 'cfa',
    status: 'actif',
    license_count: 30,
    contact_name: 'Antoaneta',
    contact_email: null,
    contact_phone: null,
    mrr_eur: 360,
    renewal_date: '2026-09-01',
    notes: 'Premier client MEMOVIA AI',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
  },
]

describe('useContracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Réinitialiser les mocks chaînés après clearAllMocks
    mockSubscribe.mockReturnValue({ unsubscribe: vi.fn() })
    mockOn.mockReturnValue({ subscribe: mockSubscribe })
    mockChannel.mockReturnValue({ on: mockOn })
    mockSelect.mockReturnValue({ order: mockOrder })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockDelete.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    })
  })

  it('commence avec isLoading=true et contracts=[]', () => {
    mockOrder.mockReturnValue(new Promise(() => {})) // ne résout jamais
    const { result } = renderHook(() => useContracts())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.contracts).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('charge les contrats avec succès', async () => {
    mockOrder.mockResolvedValue({ data: mockContracts, error: null })
    const { result } = renderHook(() => useContracts())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.contracts).toEqual(mockContracts)
    expect(result.current.error).toBeNull()
  })

  it('gère les erreurs Supabase', async () => {
    mockOrder.mockResolvedValue({ data: null, error: new Error('DB error') })
    const { result } = renderHook(() => useContracts())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.contracts).toEqual([])
    expect(result.current.error).toBe('Impossible de charger les contrats')
  })

  it('createContract insère et recharge la liste', async () => {
    // Premier appel fetchAll (montage) : liste vide
    mockOrder.mockResolvedValueOnce({ data: [], error: null })
    // Deuxième appel fetchAll (après insert) : liste avec le contrat
    mockOrder.mockResolvedValueOnce({ data: mockContracts, error: null })
    mockInsert.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useContracts())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.createContract({
        organization_name: 'CFA Compagnons du Devoir',
        organization_type: 'cfa',
        status: 'actif',
        license_count: 30,
        contact_name: 'Antoaneta',
        contact_email: null,
        contact_phone: null,
        mrr_eur: 360,
        renewal_date: '2026-09-01',
        notes: 'Premier client MEMOVIA AI',
        created_by: null,
      })
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(result.current.contracts).toEqual(mockContracts)
  })

  it('updateContract modifie et recharge la liste', async () => {
    // Premier appel fetchAll (montage)
    mockOrder.mockResolvedValueOnce({ data: mockContracts, error: null })
    // Deuxième appel fetchAll (après update)
    const updatedContracts = [{ ...mockContracts[0], license_count: 50 }]
    mockOrder.mockResolvedValueOnce({ data: updatedContracts, error: null })
    mockEq.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useContracts())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.updateContract('123e4567-e89b-12d3-a456-426614174000', { license_count: 50 })
    })

    expect(mockUpdate).toHaveBeenCalledWith({ license_count: 50 })
    expect(mockEq).toHaveBeenCalledWith('id', '123e4567-e89b-12d3-a456-426614174000')
    expect(result.current.contracts).toEqual(updatedContracts)
  })

  it('deleteContract supprime et recharge la liste', async () => {
    // Premier appel fetchAll (montage)
    mockOrder.mockResolvedValueOnce({ data: mockContracts, error: null })
    // Deuxième appel fetchAll (après delete)
    mockOrder.mockResolvedValueOnce({ data: [], error: null })
    mockEq.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useContracts())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.deleteContract('123e4567-e89b-12d3-a456-426614174000')
    })

    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockEq).toHaveBeenCalledWith('id', '123e4567-e89b-12d3-a456-426614174000')
    expect(result.current.contracts).toEqual([])
  })

  it('nettoie le channel Realtime au démontage', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })
    const { result, unmount } = renderHook(() => useContracts())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
  })
})
