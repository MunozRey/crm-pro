import type { UserRole } from './auth'

export type SidebarSectionId = 'main' | 'sales' | 'comms' | 'config'
export type SidebarBuiltinItemId =
  | 'dashboard' | 'leads' | 'contacts' | 'companies' | 'deals' | 'timeline'
  | 'calendar' | 'activities' | 'followUps' | 'goals' | 'notifications' | 'inbox' | 'reports' | 'forecast'
  | 'templates' | 'sequences'
  | 'team' | 'products' | 'automations' | 'settings' | 'audit'

export type SidebarIconKey =
  | 'layout-dashboard' | 'funnel-plus' | 'users' | 'building-2' | 'kanban-square' | 'gantt-chart'
  | 'calendar-days' | 'activity' | 'user-check' | 'target' | 'bell-ring' | 'mail' | 'bar-chart-3' | 'line-chart'
  | 'file-text' | 'list-ordered' | 'users-round' | 'package' | 'workflow' | 'settings' | 'scroll-text'
  | 'bookmark' | 'flame' | 'handshake' | 'cloud' | 'trending-up'

export interface SidebarCustomItem {
  id: string
  label: string
  to?: string
  iconKey?: SidebarIconKey
  hidden?: boolean
  roleRules?: UserRole[]
  children?: SidebarCustomItem[]
}

export interface SidebarCustomGroup {
  id: string
  label: string
  iconKey?: SidebarIconKey
  order: number
  hidden?: boolean
  roleRules?: UserRole[]
  items: SidebarCustomItem[]
}

export interface NavigationPreferences {
  version: 1
  sectionOrder: SidebarSectionId[]
  hiddenSections: SidebarSectionId[]
  itemOrderBySection: Record<SidebarSectionId, SidebarBuiltinItemId[]>
  hiddenBuiltinItems: SidebarBuiltinItemId[]
  customGroups: SidebarCustomGroup[]
}
