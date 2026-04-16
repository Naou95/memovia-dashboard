import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { MonthlyRevenue } from '@/types/stripe'

interface MrrChartProps {
  data: MonthlyRevenue[]
}

const chartConfig = {
  revenue: {
    label: 'Revenus',
    color: 'var(--memovia-violet)',
  },
} satisfies ChartConfig

/** Formatateur axe Y : "1 200 €" */
const formatY = (val: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(val) + ' €'

/** Formatateur tooltip : "1 200,50 €" */
const formatTooltip = (val: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val)

export function MrrChart({ data }: MrrChartProps) {
  const isEmpty = data.every((d) => d.revenue === 0)

  if (isEmpty) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-[var(--text-muted)]">
        Aucun revenu enregistré sur cette période.
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border-color)" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          tickFormatter={formatY}
          width={72}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--accent-purple-bg)' }}
          content={
            <ChartTooltipContent
              formatter={(value) => formatTooltip(Number(value))}
              labelClassName="font-medium text-[var(--text-primary)]"
            />
          }
        />
        <Bar
          dataKey="revenue"
          fill="var(--memovia-violet)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ChartContainer>
  )
}
