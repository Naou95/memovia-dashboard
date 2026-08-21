// Historique produit (mémoire d'entreprise, 21/08/2026).
// Les jalons arrivent en 'candidat' via le cron changelog-collect (PRs mergées des
// 5 dépôts) ; le tri humain les passe en 'retenu' ou 'ecarte' en un clic.

export interface Milestone {
  id: string
  date: string
  repo: string
  title: string
  detail: string | null
  source_url: string | null
  status: 'candidat' | 'retenu' | 'ecarte'
  created_at: string
}

export function groupMilestones(items: Milestone[]): { retenus: Milestone[]; candidats: Milestone[] } {
  const byDateDesc = (a: Milestone, b: Milestone) => b.date.localeCompare(a.date)
  return {
    retenus: items.filter((m) => m.status === 'retenu').sort(byDateDesc),
    candidats: items.filter((m) => m.status === 'candidat').sort(byDateDesc),
  }
}
