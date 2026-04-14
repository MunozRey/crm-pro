import { createDefaultNavigationPreferences, DEFAULT_ITEM_ORDER_BY_SECTION, SIDEBAR_SECTION_IDS } from '../config/navigationDefaults'
import type { NavigationPreferences, SidebarBuiltinItemId, SidebarSectionId } from '../types/navigation'

const ALL_BUILTIN_IDS = new Set<SidebarBuiltinItemId>([
  ...DEFAULT_ITEM_ORDER_BY_SECTION.main,
  ...DEFAULT_ITEM_ORDER_BY_SECTION.sales,
  ...DEFAULT_ITEM_ORDER_BY_SECTION.comms,
  ...DEFAULT_ITEM_ORDER_BY_SECTION.config,
])

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

export function sanitizeNavigationPreferences(input: unknown): NavigationPreferences {
  const fallback = createDefaultNavigationPreferences()
  if (!input || typeof input !== 'object') return fallback
  const raw = input as Partial<NavigationPreferences>

  const sectionOrder = unique((raw.sectionOrder ?? []).filter((id): id is SidebarSectionId => SIDEBAR_SECTION_IDS.includes(id as SidebarSectionId)))
  const completedSectionOrder = [...sectionOrder, ...SIDEBAR_SECTION_IDS.filter((id) => !sectionOrder.includes(id))]

  const hiddenSections = unique((raw.hiddenSections ?? []).filter((id): id is SidebarSectionId => SIDEBAR_SECTION_IDS.includes(id as SidebarSectionId)))
  const hiddenBuiltinItems = unique((raw.hiddenBuiltinItems ?? []).filter((id): id is SidebarBuiltinItemId => ALL_BUILTIN_IDS.has(id as SidebarBuiltinItemId)))

  const itemOrderBySection = { ...fallback.itemOrderBySection }
  for (const sectionId of SIDEBAR_SECTION_IDS) {
    const rawSectionOrder = raw.itemOrderBySection?.[sectionId] ?? []
    const valid = unique(rawSectionOrder.filter((id): id is SidebarBuiltinItemId => ALL_BUILTIN_IDS.has(id as SidebarBuiltinItemId)))
    const defaults = DEFAULT_ITEM_ORDER_BY_SECTION[sectionId]
    itemOrderBySection[sectionId] = [...valid, ...defaults.filter((id) => !valid.includes(id))]
  }

  return {
    version: 1,
    sectionOrder: completedSectionOrder,
    hiddenSections,
    hiddenBuiltinItems,
    itemOrderBySection,
    customGroups: Array.isArray(raw.customGroups) ? raw.customGroups.filter((g) => g && typeof g.id === 'string' && typeof g.label === 'string') : [],
  }
}
