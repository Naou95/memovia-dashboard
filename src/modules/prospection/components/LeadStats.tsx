import { Users2, Trophy, MessageSquare, TrendingUp } from 'lucide-react'
import { KpiCard } from '@/components/shared/KpiCard'
import type { Lead } from '@/types/leads'

interface LeadStatsProps {
  leads: Lead[]
  isLoading: boolean
  error: string | null
}

export function LeadStats({ leads, isLoading, error }: LeadStatsProps) {
  const total = leads.length
  const enCours = leads.filter(
    (l) => !['gagne', 'perdu'].includes(l.status)
  ).length
  const thisMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  const gagnesMonth = leads.filter(
    (l) => l.status === 'gagne' && l.updated_at.startsWith(thisMonth)
  ).length
  const closes = leads.filter((l) => ['gagne', 'perdu'].includes(l.status)).length
  const gagnes = leads.filter((l) => l.status === 'gagne').length
  const tauxConversion = closes > 0 ? Math.round((gagnes / closes) * 100) : 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Total leads"
        value={isLoading ? null : String(total)}
        accent="violet"
        icon={Users2}
        isLoading={isLoading}
        error={error}
      />
      <KpiCard
        label="En cours"
        value={isLoading ? null : String(enCours)}
        accent="blue"
        icon={MessageSquare}
        isLoading={isLoading}
        error={error}
      />
      <KpiCard
        label="Gagnés ce mois"
        value={isLoading ? null : String(gagnesMonth)}
        accent="green"
        icon={Trophy}
        isLoading={isLoading}
        error={error}
      />
      <KpiCard
        label="Taux de conversion"
        value={isLoading ? null : `${tauxConversion} %`}
        accent="cyan"
        icon={TrendingUp}
        isLoading={isLoading}
        error={error}
      />
    </div>
  )
}
