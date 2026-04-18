import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Contract, ContractInsert, ContractUpdate } from '@/types/contracts'

export interface UseContractsResult {
  contracts: Contract[]
  isLoading: boolean
  error: string | null
  createContract: (data: ContractInsert) => Promise<void>
  updateContract: (id: string, data: ContractUpdate) => Promise<void>
  deleteContract: (id: string) => Promise<void>
}

export function useContracts(): UseContractsResult {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const { data, error: sbError } = await supabase
      .from('contracts')
      .select('*')
      .order('renewal_date', { ascending: true, nullsFirst: false })

    if (sbError || !data) {
      setError('Impossible de charger les contrats')
      setIsLoading(false)
      return
    }

    setContracts(data as Contract[])
    setError(null)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()

    const channel = supabase
      .channel('contracts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, fetchAll)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  const createContract = async (data: ContractInsert): Promise<void> => {
    const { error: sbError } = await supabase.from('contracts').insert(data)
    if (sbError) throw sbError
    await fetchAll()
  }

  const updateContract = async (id: string, data: ContractUpdate): Promise<void> => {
    const { error: sbError } = await supabase.from('contracts').update(data).eq('id', id)
    if (sbError) throw sbError
    await fetchAll()
  }

  const deleteContract = async (id: string): Promise<void> => {
    const { error: sbError } = await supabase.from('contracts').delete().eq('id', id)
    if (sbError) throw sbError
    await fetchAll()
  }

  return { contracts, isLoading, error, createContract, updateContract, deleteContract }
}
