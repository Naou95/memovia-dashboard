import type { Lead } from '@/types/leads'

interface LeadStatsProps {
  leads: Lead[]
  isLoading: boolean
  error: string | null
}

/**
 * Résumé pipeline en une ligne (22/08/2026). L'ancienne rangée de 4 KpiCard
 * était le pattern « stats banner » générique : à 4 leads, deux tuiles
 * affichaient 0 et « Total » doublonnait « En cours ». Une ligne dit la même
 * chose sans enterrer la liste, qui EST la page.
 */
export function LeadStats({ leads, isLoading, error }: LeadStatsProps) {
  if (error) return <p className="text-[13px] text-[var(--danger)]">{error}</p>
  if (isLoading) return <p className="text-[13px] text-[var(--text-muted)]">Chargement…</p>

  const enCours = leads.filter((l) => !['gagne', 'perdu'].includes(l.status)).length
  const thisMonth = new Date().toISOString().slice(0, 7)
  const gagnesMonth = leads.filter(
    (l) => l.status === 'gagne' && l.updated_at.startsWith(thisMonth)
  ).length
  const closes = leads.filter((l) => ['gagne', 'perdu'].includes(l.status)).length
  const gagnes = leads.filter((l) => l.status === 'gagne').length

  return (
    <p className="text-[13px] text-[var(--text-secondary)]">
      <span className="font-semibold tabular-nums text-[var(--text-primary)]">{enCours}</span>{' '}
      lead{enCours > 1 ? 's' : ''} en cours
      {' · '}
      <span className="font-semibold tabular-nums text-[var(--text-primary)]">{gagnesMonth}</span>{' '}
      gagné{gagnesMonth > 1 ? 's' : ''} ce mois
      {closes > 0 && (
        <>
          {' · '}
          <span className="font-semibold tabular-nums text-[var(--text-primary)]">
            {Math.round((gagnes / closes) * 100)} %
          </span>{' '}
          de conversion
        </>
      )}
    </p>
  )
}
