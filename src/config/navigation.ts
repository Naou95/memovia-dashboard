import {
  LayoutDashboard,
  CreditCard,
  Landmark,
  FileText,
  Users2,
  KanbanSquare,
  Calendar,
  UsersRound,
  Zap,
  Map,
  Mail,
  Github,
  BarChart3,
  Bot,
  UserCog,
  Receipt,
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

export interface NavSection {
  id: string
  label: string
  items: NavItem[]
}

/**
 * Sidebar structure — follows the MEMOVIA dashboard plan:
 * - PRINCIPAL      → Overview
 * - FINANCE        → Stripe & Finance, Qonto Trésorerie, Contrats B2B
 * - OPÉRATIONS     → Prospection CRM, Tâches IA, Calendrier, Email Hostinger, GitHub
 * - PLATEFORME     → Utilisateurs MEMOVIA, Realtime, Roadmap & Feedback
 * - GROWTH & IA    → SEO & Blog, Copilote IA
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'main',
    label: 'Principal',
    items: [
      {
        id: 'overview',
        label: 'Overview',
        path: '/overview',
        icon: LayoutDashboard,
        status: 'active',
        allowedRoles: [],
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      {
        id: 'stripe',
        label: 'Stripe & Finance',
        path: '/stripe',
        icon: CreditCard,
        status: 'active',
        allowedRoles: [],
      },
      {
        id: 'qonto',
        label: 'Qonto Trésorerie',
        path: '/qonto',
        icon: Landmark,
        status: 'active',
        allowedRoles: ['admin_full', 'admin_bizdev'],
      },
      {
        id: 'contracts',
        label: 'Contrats B2B',
        path: '/contracts',
        icon: FileText,
        status: 'active',
        allowedRoles: [],
      },
    ],
  },
  {
    id: 'ops',
    label: 'Opérations',
    items: [
      {
        id: 'prospection',
        label: 'Prospection CRM',
        path: '/prospection',
        icon: Users2,
        status: 'active',
        allowedRoles: [],
      },
      {
        id: 'tasks',
        label: 'Tâches',
        path: '/taches',
        icon: KanbanSquare,
        status: 'active',
        allowedRoles: [],
      },
      {
        id: 'calendar',
        label: 'Calendrier',
        path: '/calendrier',
        icon: Calendar,
        status: 'active',
        allowedRoles: [],
      },
      {
        id: 'email',
        label: 'Email Hostinger',
        path: '/email-drafter',
        icon: Mail,
        status: 'active',
        allowedRoles: [],
      },
      {
        id: 'github',
        label: 'GitHub',
        path: '/github',
        icon: Github,
        status: 'active',
        allowedRoles: [],
      },
    ],
  },
  {
    id: 'platform',
    label: 'Plateforme',
    items: [
      {
        id: 'users',
        label: 'Utilisateurs MEMOVIA',
        path: '/utilisateurs',
        icon: UsersRound,
        status: 'active',
        allowedRoles: [],
      },
      {
        id: 'realtime',
        label: 'Realtime',
        path: '/realtime',
        icon: Zap,
        status: 'active',
        allowedRoles: [],
      },
      {
        id: 'roadmap',
        label: 'Roadmap & Feedback',
        path: '/roadmap',
        icon: Map,
        status: 'active',
        allowedRoles: [],
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      {
        id: 'admin-users',
        label: 'Gestion admins',
        path: '/admin',
        icon: UserCog,
        status: 'active',
        allowedRoles: ['admin_full'],
      },
    ],
  },
  {
    id: 'growth',
    label: 'Growth & IA',
    items: [
      {
        id: 'seo',
        label: 'SEO & Blog',
        path: '/seo',
        icon: BarChart3,
        status: 'active',
        allowedRoles: [],
      },
      {
        id: 'copilot',
        label: 'Copilote IA',
        path: '/copilot',
        icon: Bot,
        status: 'active',
        allowedRoles: [],
      },
      {
        id: 'api-costs',
        label: 'Coûts API',
        path: '/couts-api',
        icon: Receipt,
        status: 'active',
        allowedRoles: ['admin_full'],
      },
    ],
  },
]

// Filter nav sections by role
export function getNavForRole(role: UserRole): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        item.allowedRoles.length === 0 || item.allowedRoles.includes(role)
    ),
  })).filter((section) => section.items.length > 0)
}
