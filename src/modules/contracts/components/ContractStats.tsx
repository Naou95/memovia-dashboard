import { FileText, CheckCircle, Users, TrendingUp } from 'lucide-react'
import { KpiCard } from '@/components/shared/KpiCard'
import type { Contract } from '@/types/contracts'

interface ContractStatsProps {
  contracts: Contract[]
  isLoading: boolean
  error: string | null
}

export function ContractStats({ contracts, isLoading, error }: ContractStatsProps) {
  const totalContrats = contracts.length
  const contratsActifs = contracts.filter((c) => c.status === 'actif').length
  const licencesTotales = contracts.reduce((sum, c) => sum + c.license_count, 0)
  const mrrTotal = contracts
    .filter((c) => c.status === 'actif')
    .reduce((sum, c) => sum + (c.mrr_eur ?? 0), 0)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Total contrats"
        value={isLoading ? null : String(totalContrats)}
        accent="violet"
        icon={FileText}
        isLoading={isLoading}
        error={error}
      />
      <KpiCard
        label="Contrats actifs"
        value={isLoading ? null : String(contratsActifs)}
        accent="green"
        icon={CheckCircle}
        isLoading={isLoading}
        error={error}
      />
      <KpiCard
        label="Licences totales"
        value={isLoading ? null : String(licencesTotales)}
        accent="cyan"
        icon={Users}
        isLoading={isLoading}
        error={error}
      />
      <KpiCard
        label="MRR total"
        value={isLoading ? null : `${mrrTotal} €`}
        accent="blue"
        icon={TrendingUp}
        isLoading={isLoading}
        error={error}
      />
    </div>
  )
}
