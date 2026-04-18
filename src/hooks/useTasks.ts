import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task, TaskInsert, TaskUpdate } from '@/types/tasks'

export interface UseTasksResult {
  tasks: Task[]
  isLoading: boolean
  error: string | null
  createTask: (data: TaskInsert) => Promise<void>
  updateTask: (id: string, data: TaskUpdate) => Promise<void>
  deleteTask: (id: string) => Promise<void>
}

export function useTasks(): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const { data, error: sbError } = await supabase
      .from('tasks')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })

    if (sbError || !data) {
      setError('Impossible de charger les tâches')
      setIsLoading(false)
      return
    }

    setTasks(data as Task[])
    setError(null)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()

    // Realtime sync — both admins see changes instantly
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchAll)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  const createTask = async (data: TaskInsert): Promise<void> => {
    const { error: sbError } = await supabase.from('tasks').insert(data)
    if (sbError) throw sbError
    await fetchAll()
  }

  const updateTask = async (id: string, data: TaskUpdate): Promise<void> => {
    const { error: sbError } = await supabase.from('tasks').update(data).eq('id', id)
    if (sbError) throw sbError
    await fetchAll()
  }

  const deleteTask = async (id: string): Promise<void> => {
    const { error: sbError } = await supabase.from('tasks').delete().eq('id', id)
    if (sbError) throw sbError
    await fetchAll()
  }

  return { tasks, isLoading, error, createTask, updateTask, deleteTask }
}
