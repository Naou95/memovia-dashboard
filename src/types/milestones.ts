// Historique produit (mémoire d'entreprise, 21/08/2026).
// Les jalons arrivent en 'candidat' via le cron changelog-collect (PRs mergées des
// 5 dépôts) ; le tri humain les passe en 'retenu' ou 'ecarte' en un clic.

export interface Milestone {
  id: string
  date: string
  repo: string
  title: string
  // Phrase en clair pour non-tech (00049), générée par Gemini puis relue au tri.
  // NULL → le front affiche stripTechPrefix(title).
  title_public: string | null
  detail: string | null
  source_url: string | null
  status: 'candidat' | 'retenu' | 'ecarte'
  created_at: string
}

// ── Habillage lisible (retour Naoufel 21/08 : « on est pas tech ») ─────────────

export const MILESTONE_PRODUCT_LABELS: Record<string, string> = {
  'memovia-ia-notes': 'App élèves',
  'memovia-dashboard': 'Dashboard interne',
  'memovia-ia-notes-landing-page': 'Site memovia.io',
  'memovia-landing-it': 'Site italien',
  'memovia-guides': "Guide d'aide",
}

export type MilestoneCategory =
  | 'nouveaute'
  | 'correction'
  | 'securite'
  | 'accessibilite'
  | 'design'
  | 'technique'

export const MILESTONE_CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  nouveaute: 'Nouveauté',
  correction: 'Correction',
  securite: 'Sécurité',
  accessibilite: 'Accessibilité',
  design: 'Design',
  technique: 'Technique',
}

// Déduit la catégorie du préfixe conventionnel du titre de PR. Les familles
// spécifiques (sécurité, accessibilité, design) priment sur fix/feat : un
// « fix(a11y): … » est d'abord de l'accessibilité.
export function categorizeMilestone(title: string): MilestoneCategory {
  const head = title.slice(0, 30).toLowerCase()
  if (head.includes('secur') || head.includes('sécur')) return 'securite'
  if (head.includes('a11y') || head.includes('accessib')) return 'accessibilite'
  if (head.includes('design')) return 'design'
  if (/^(ci|docs|chore|refactor|test)\b/.test(head)) return 'technique'
  if (head.startsWith('fix')) return 'correction'
  return 'nouveaute'
}

// Retire le préfixe technique « fix(scope): », « feat: », « sécurité : »… et
// remet une majuscule. Repli d'affichage quand title_public est NULL.
export function stripTechPrefix(title: string): string {
  const stripped = title.replace(/^[a-zà-ÿ0-9_ ]{2,15}(\([^)]*\))?\s*[:：]\s*/i, '').trim()
  const base = stripped || title.trim()
  return base.charAt(0).toUpperCase() + base.slice(1)
}

export function groupMilestones(items: Milestone[]): { retenus: Milestone[]; candidats: Milestone[] } {
  const byDateDesc = (a: Milestone, b: Milestone) => b.date.localeCompare(a.date)
  return {
    retenus: items.filter((m) => m.status === 'retenu').sort(byDateDesc),
    candidats: items.filter((m) => m.status === 'candidat').sort(byDateDesc),
  }
}
