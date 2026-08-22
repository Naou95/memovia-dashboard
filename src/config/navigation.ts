import {
  House,
  Users2,
  Calendar,
  Mail,
  Trophy,
  Wallet,
  Bug,
  Compass,
  Map,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { UserRole } from '@/types/auth'

export type NavItemStatus = 'active' | 'soon'

export interface NavItem {
  id: string
  label: string
  path: string
  icon: LucideIcon
  status: NavItemStatus
  // Roles that can see this item. Empty array = all roles.
  allowedRoles: UserRole[]
}

/**
 * Navigation v2 (refonte 20/08/2026, voir REFONT_PLAN.md) : 5 sections en top-bar.
 * Les anciens modules restent accessibles par URL directe (liens du briefing
 * Telegram intacts) mais n'apparaissent plus dans la navigation.
 * Admin reste accessible via le menu utilisateur.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    // Accueil (22/08/2026) : planning, échéances, leads à contacter, assistant IA.
    id: 'accueil',
    label: 'Accueil',
    path: '/',
    icon: House,
    status: 'active',
    allowedRoles: [],
  },
  {
    id: 'leads',
    label: 'Leads',
    path: '/leads',
    icon: Users2,
    status: 'active',
    allowedRoles: [],
  },
  {
    id: 'rdv',
    label: 'RDV',
    path: '/rdv',
    icon: Calendar,
    status: 'active',
    allowedRoles: [],
  },
  {
    // Réintégré le 20/08/2026 sur décision Naoufel : la boîte partagée
    // contact@memovia.io est le canal de réponse aux prospects (pas un miroir
    // d'outil perso), et « Détecter leads » alimente directement la section Leads.
    id: 'mail',
    label: 'Mail',
    path: '/mail',
    icon: Mail,
    status: 'active',
    allowedRoles: [],
  },
  {
    id: 'financements',
    label: 'Financements',
    path: '/financements',
    icon: Trophy,
    status: 'active',
    allowedRoles: [],
  },
  {
    id: 'argent',
    label: 'Argent',
    path: '/argent',
    icon: Wallet,
    status: 'active',
    allowedRoles: [],
  },
  {
    id: 'bugs',
    label: 'Bugs',
    path: '/bugs',
    icon: Bug,
    status: 'active',
    allowedRoles: [],
  },
  {
    // Positionnement (22/08/2026, remplace Historique jugé inutile par Naoufel) :
    // la thèse, l'offre, ce qui est construit, les concurrents — l'armurerie
    // commerciale d'Emir, alignée sur POSITIONNEMENT.md du vault (18/07/2026).
    id: 'positionnement',
    label: 'Positionnement',
    path: '/positionnement',
    icon: Compass,
    status: 'active',
    allowedRoles: [],
  },
  {
    // Roadmap produit (22/08/2026) : sortie de Positionnement où elle était en dur,
    // donc morte entre deux sessions. Kanban par horizon, adossé à roadmap_items.
    id: 'roadmap-produit',
    label: 'Roadmap',
    path: '/roadmap-produit',
    icon: Map,
    status: 'active',
    allowedRoles: [],
  },
]

// Filter nav items by role
export function getNavForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => item.allowedRoles.length === 0 || item.allowedRoles.includes(role)
  )
}
