import {
  Users2,
  Calendar,
  Mail,
  Trophy,
  Wallet,
  Bug,
  History,
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
    // Mémoire d'entreprise (21/08/2026) : jalons produit datés et sourcés.
    // Dernière position exprès — consultation, pas action quotidienne.
    id: 'historique',
    label: 'Historique',
    path: '/historique',
    icon: History,
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
