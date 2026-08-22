import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { QontoTransaction } from '@/types/qonto'

const formatEur = (val: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val)

/** Même humanisation de slug que TransactionTable */
function formatCategory(raw: string | null): string {
  if (!raw) return 'Autre'
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Gamme violette du design system (chart-purple) — les catégories ne sont pas
// sémantiques, une échelle mono-teinte suffit et reste dans la marque.
const SCALE = ['#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE', '#EDE9FF']

interface CategoryDonutProps {
  transactions: QontoTransaction[]
  /** Fenêtre en jours (défaut 90) */
  days?: number
}

/**
 * Donut des dépenses par catégorie (22/08/2026, maquette Naoufel « argent »).
 * Débits uniquement, top 5 + « Autres », légende chiffrée à droite.
 */
export function CategoryDonut({ transactions, days = 90 }: CategoryDonutProps) {
  const data = useMemo(() => {
    const cutoff = Date.now() - days * 86_400_000
    const sums = new Map<string, number>()
    for (const tx of transactions) {
      if (tx.side !== 'debit') continue
      if (new Date(tx.settledAt).getTime() < cutoff) continue
      const cat = formatCategory(tx.category)
      sums.set(cat, (sums.get(cat) ?? 0) + tx.amount)
    }
    const sorted = [...sums.entries()].sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 5).map(([name, value]) => ({ name, value }))
    const rest = sorted.slice(5).reduce((s, [, v]) => s + v, 0)
    if (rest > 0) top.push({ name: 'Autres', value: rest })
    return top
  }, [transactions, days])

  const total = data.reduce((s, d) => s + d.value, 0)

  if (data.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-[var(--text-muted)]">
        Aucune dépense sur {days} jours.
      </div>
    )
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={54}
              outerRadius={84}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={SCALE[i % SCALE.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [formatEur(value), name]}
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #EDEDF0',
                borderRadius: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                fontSize: 12,
              }}
              wrapperStyle={{ outline: 'none' }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Total au centre du donut */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-[var(--text-secondary)]">{days} j</span>
          <span className="tabular-nums text-[15px] font-bold text-[var(--text-primary)]">{formatEur(total)}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-[12px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: SCALE[i % SCALE.length] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{d.name}</span>
            <span className="shrink-0 tabular-nums font-medium text-[var(--text-primary)]">{formatEur(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
