import type { NavigationPreferences, SidebarBuiltinItemId, SidebarSectionId } from '../types/navigation'

export const SIDEBAR_SECTION_IDS: SidebarSectionId[] = ['main', 'sales', 'comms', 'config']

export const DEFAULT_ITEM_ORDER_BY_SECTION: Record<SidebarSectionId, SidebarBuiltinItemId[]> = {
  main: ['dashboard', 'leads', 'contacts', 'companies', 'deals', 'timeline'],
  sales: ['calendar', 'activities', 'followUps', 'goals', 'notifications', 'inbox', 'reports', 'forecast'],
  comms: ['templates', 'sequences'],
  config: ['team', 'products', 'automations', 'settings', 'audit'],
}

export function createDefaultNavigationPreferences(): NavigationPreferences {
  return {
    version: 1,
    sectionOrder: [...SIDEBAR_SECTION_IDS],
    hiddenSections: [],
    itemOrderBySection: {
      main: [...DEFAULT_ITEM_ORDER_BY_SECTION.main],
      sales: [...DEFAULT_ITEM_ORDER_BY_SECTION.sales],
      comms: [...DEFAULT_ITEM_ORDER_BY_SECTION.comms],
      config: [...DEFAULT_ITEM_ORDER_BY_SECTION.config],
    },
    hiddenBuiltinItems: [],
    customGroups: [],
  }
}
