import { Users, GraduationCap, BookOpen, Building2 } from 'lucide-react'
import { KpiCard } from '@/components/shared/KpiCard'
import type { MemoviaUser } from '@/types/users'

interface UserStatsProps {
  users: MemoviaUser[]
  total: number
  isLoading: boolean
  error: string | null
}

export function UserStats({ users, total, isLoading, error }: UserStatsProps) {
  const studentCount = users.filter((u) => u.account_type === 'student').length
  const teacherCount = users.filter(
    (u) => u.account_type === 'teacher' || u.account_type === 'teacher_b2c'
  ).length
  const adminCount = users.filter((u) => u.account_type === 'school_admin').length

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Total inscrits"
        value={isLoading ? null : String(total)}
        accent="violet"
        icon={Users}
        isLoading={isLoading}
        error={error}
      />
      <KpiCard
        label="Étudiants"
        value={isLoading ? null : String(studentCount)}
        accent="blue"
        icon={GraduationCap}
        isLoading={isLoading}
        error={error}
      />
      <KpiCard
        label="Formateurs"
        value={isLoading ? null : String(teacherCount)}
        accent="cyan"
        icon={BookOpen}
        isLoading={isLoading}
        error={error}
      />
      <KpiCard
        label="Admins B2B"
        value={isLoading ? null : String(adminCount)}
        accent="green"
        icon={Building2}
        isLoading={isLoading}
        error={error}
      />
    </div>
  )
}
