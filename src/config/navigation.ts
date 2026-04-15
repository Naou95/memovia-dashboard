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
        label: 'Stripe & Revenus',
        path: '/stripe',
        icon: CreditCard,
        status: 'soon',
        allowedRoles: [],
      },
      {
        id: 'qonto',
        label: 'Qonto Trésorerie',
        path: '/qonto',
        icon: Landmark,
        status: 'soon',
        allowedRoles: [],
      },
      {
        id: 'contracts',
        label: 'Contrats B2B',
        path: '/contracts',
        icon: FileText,
        status: 'soon',
        allowedRoles: [],
      },
    ],
  },
  {
    id: 'growth',
    label: 'Croissance',
    items: [
      {
        id: 'crm',
        label: 'Prospection CRM',
        path: '/crm',
        icon: Users2,
        status: 'soon',
        allowedRoles: [],
      },
      {
        id: 'seo',
        label: 'SEO & Blog',
        path: '/seo',
        icon: BarChart3,
        status: 'soon',
        allowedRoles: [],
      },
    ],
  },
  {
    id: 'ops',
    label: 'Opérations',
    items: [
      {
        id: 'tasks',
        label: 'Tâches IA',
        path: '/tasks',
        icon: KanbanSquare,
        status: 'soon',
        allowedRoles: [],
      },
      {
        id: 'calendar',
        label: 'Calendrier',
        path: '/calendar',
        icon: Calendar,
        status: 'soon',
        allowedRoles: [],
      },
      {
        id: 'email',
        label: 'Email',
        path: '/email',
        icon: Mail,
        status: 'soon',
        allowedRoles: [],
      },
      {
        id: 'github',
        label: 'GitHub',
        path: '/github',
        icon: Github,
        status: 'soon',
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
        label: 'Utilisateurs',
        path: '/users',
        icon: UsersRound,
        status: 'soon',
        allowedRoles: [],
      },
      {
        id: 'realtime',
        label: 'Realtime',
        path: '/realtime',
        icon: Zap,
        status: 'soon',
        allowedRoles: [],
      },
      {
        id: 'roadmap',
        label: 'Roadmap',
        path: '/roadmap',
        icon: Map,
        status: 'soon',
        allowedRoles: [],
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      {
        id: 'admin-users',
        label: 'Gestion admins',
        path: '/admin/users',
        icon: UsersRound,
        status: 'soon',
        // Only admin_full can see admin section
        allowedRoles: ['admin_full'],
      },
      {
        id: 'copilot',
        label: 'Copilote IA',
        path: '/copilot',
        icon: Bot,
        status: 'soon',
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
