import type { CampaignStats } from '@/hooks/useCampaigns'

interface RapportsTabProps {
  stats: CampaignStats
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="my-2.5 grid grid-cols-[110px_1fr_60px] items-center gap-3 text-[13px] sm:grid-cols-[130px_1fr_60px]">
      <span className="font-semibold text-[var(--text-primary)]">
        {label} <small className="ml-1 font-normal text-[var(--text-muted)] tabular-nums">{value}</small>
      </span>
      <div className="relative h-[22px] overflow-hidden rounded-full bg-[var(--bg-primary)]" role="img" aria-label={`${label} : ${value} sur ${total}`}>
        <div
          className="flex h-full items-center justify-end rounded-full pr-2 text-[11px] font-bold text-white transition-[width]"
          style={{ width: `${pct}%`, backgroundColor: color, minWidth: pct > 0 ? 34 : 0 }}
        >
          {pct > 0 ? `${pct} %` : ''}
        </div>
      </div>
      <span className="text-right text-[12px] text-[var(--text-muted)] tabular-nums">{value} / {total}</span>
    </div>
  )
}

/** Onglet Rapports : entonnoir en barres + table par étape (grammaire La Growth Machine). */
export function RapportsTab({ stats }: RapportsTabProps) {
  const total = stats.total
  const violet = 'var(--memovia-violet)'
  const violetSoft = 'color-mix(in oklab, var(--memovia-violet) 70%, white)'
  const green = 'var(--success)'
  const red = 'var(--danger)'

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-4">
        <h3 className="mb-3 text-[14px] font-semibold text-[var(--text-primary)]">
          Entonnoir de la campagne <span className="text-[12.5px] font-normal text-[var(--text-muted)]">· {total} contact{total > 1 ? 's' : ''}</span>
        </h3>
        <Bar label="Contactés" value={stats.contacted} total={total} color={violet} />
        <Bar label="Joints par appel" value={stats.reached} total={total} color={violetSoft} />
        <Bar label="Réponse écrite" value={stats.replied} total={total} color={violetSoft} />
        <Bar label="Intéressés" value={stats.interested} total={total} color={green} />
        <Bar label="RDV" value={stats.rdv} total={total} color={green} />
        <Bar label="Refus" value={stats.refused} total={total} color={red} />
        <p className="mt-3 text-[12.5px] text-[var(--text-muted)]">
          {total < 30 ? 'Moins de 30 contacts : lis des nombres, pas des taux. ' : ''}
          Le tableau se remplit à chaque envoi et à chaque appel enregistré, sans rien saisir de plus.
        </p>
      </section>

      <section className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-4">
        <h3 className="mb-3 text-[14px] font-semibold text-[var(--text-primary)]">Par étape</h3>
        <table className="w-full text-[13px]" aria-label="Résultats par étape">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              <th scope="col" className="py-2 pr-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Étape</th>
              <th scope="col" className="py-2 px-2 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Envoyés / appels</th>
              <th scope="col" className="py-2 pl-2 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Réponses / joints</th>
            </tr>
          </thead>
          <tbody>
            {stats.perStep.length === 0 && (
              <tr><td colSpan={3} className="py-3 text-[var(--text-muted)]">Aucune étape.</td></tr>
            )}
            {stats.perStep.map(({ step, sent, replies }) => (
              <tr key={step.id} className="border-b border-[var(--border-color)] last:border-0">
                <td className="py-2 pr-2 text-[var(--text-primary)]">
                  {step.name}
                  <span className="ml-1.5 text-[11.5px] text-[var(--text-muted)]">{step.kind === 'call' ? 'appel' : 'mail'}</span>
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-[var(--text-primary)]">{sent}</td>
                <td className="py-2 pl-2 text-right tabular-nums text-[var(--text-primary)]">
                  {sent === 0 ? <span className="text-[var(--text-muted)]">·</span> : step.kind === 'call' ? `${replies} joint${replies > 1 ? 's' : ''}` : replies}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
