import { RevenueBarChart } from '@/components/shared/RevenueBarChart'
import type { MonthlyRevenue } from '@/types/stripe'

interface MrrChartProps {
  data: MonthlyRevenue[]
}

export function MrrChart({ data }: MrrChartProps) {
  return <RevenueBarChart data={data} variant="full" />
}
