import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { MemoviaUser, MemoviaUserPlan, MemoviaAccountType } from '@/types/users'

// Limite : 500 utilisateurs les plus récents
const LIMIT = 500

export interface UseMemoviaUsersResult {
  users: MemoviaUser[]
  total: number
  isLoading: boolean
  error: string | null
}

/**
 * Charge les utilisateurs de app.memovia.io via la vue v_dashboard_users.
 * Lecture seule — la vue joint profiles + auth.users + organizations.
 * dateRangeDays : null = toutes dates, sinon N derniers jours (filtre created_at).
 */
export function useMemoviaUsers(dateRangeDays: number | null): UseMemoviaUsersResult {
  const [users, setUsers] = useState<MemoviaUser[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('v_dashboard_users')
        .select(
          'id, email, first_name, last_name, plan, account_type, subscription_status, organization_id, organization_name, created_at, last_sign_in_at',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .limit(LIMIT)

      if (dateRangeDays !== null) {
        const threshold = new Date()
        threshold.setDate(threshold.getDate() - dateRangeDays)
        query = query.gte('created_at', threshold.toISOString())
      }

      const { data, error: sbError, count } = await query

      if (sbError) {
        setError(`Impossible de charger les utilisateurs : ${sbError.message}`)
        setIsLoading(false)
        return
      }

      if (!data || data.length === 0) {
        setUsers([])
        setTotal(0)
        setIsLoading(false)
        return
      }

      setTotal(count ?? data.length)

      const merged: MemoviaUser[] = data.map((row) => ({
        id: row.id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        account_type: (row.account_type ?? 'student') as MemoviaAccountType,
        created_at: row.created_at,
        last_sign_in_at: row.last_sign_in_at,
        plan: derivePlan(row),
        organization_name: row.organization_name,
      }))

      setUsers(merged)
    } catch {
      setError('Erreur inattendue lors du chargement des utilisateurs.')
    } finally {
      setIsLoading(false)
    }
  }, [dateRangeDays])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { users, total, isLoading, error }
}

function derivePlan(row: {
  organization_id: string | null
  account_type: string
  subscription_status: string | null
  plan: string | null
}): MemoviaUserPlan {
  if (row.organization_id !== null || row.account_type === 'b2b') return 'b2b'
  if (row.subscription_status === 'active') return 'pro'
  return 'free'
}
