import { describe, it, expect } from 'vitest'
import { splitTasksForLead } from '@/types/tasks'
import type { Task } from '@/types/tasks'

const t = (over: Partial<Task>): Task => ({
  id: 'x', title: 'T', description: null, status: 'todo', priority: 'normale',
  due_date: null, assigned_to: 'naoufel', assignees: [], is_private: false,
  created_at: '', updated_at: '', created_by: null, lead_id: null, ...over,
})

describe('splitTasksForLead', () => {
  it('ne prend que les tâches de la fiche, sépare ouvertes/faites', () => {
    const tasks = [
      t({ id: 'a', lead_id: 'L1', status: 'todo' }),
      t({ id: 'b', lead_id: 'L1', status: 'done' }),
      t({ id: 'e', lead_id: 'L1', status: 'en_cours' }),
      t({ id: 'c', lead_id: 'L2' }),
      t({ id: 'd', lead_id: null }),
    ]
    const { ouvertes, faites } = splitTasksForLead(tasks, 'L1')
    expect(ouvertes.map((x) => x.id)).toEqual(['a', 'e'])
    expect(faites.map((x) => x.id)).toEqual(['b'])
  })
})
