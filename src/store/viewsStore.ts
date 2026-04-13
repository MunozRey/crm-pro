import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { SmartView, SmartViewFilter, CustomFieldEntityType, InboxSavedView, InboxAdvancedFilters } from '../types'

// ─── Seed Views ──────────────────────────────────────────────────────────────

const now = new Date().toISOString()

const SEED_VIEWS: SmartView[] = [
  {
    id: 'sv-01', name: 'Prospectos activos', nameKey: 'sv01', entityType: 'contact',
    filters: [{ field: 'status', operator: 'eq', value: 'prospect' }],
    sortField: 'updatedAt', sortDirection: 'desc',
    isPinned: true, icon: 'flame', color: 'orange',
    createdBy: 'David Muñoz', createdAt: now, updatedAt: now,
  },
  {
    id: 'sv-02', name: 'Clientes activos', nameKey: 'sv02', entityType: 'contact',
    filters: [{ field: 'status', operator: 'eq', value: 'customer' }],
    sortField: 'lastName', sortDirection: 'asc',
    isPinned: true, icon: 'users', color: 'emerald',
    createdBy: 'David Muñoz', createdAt: now, updatedAt: now,
  },
  {
    id: 'sv-03', name: 'Deals en negociación', nameKey: 'sv03', entityType: 'deal',
    filters: [{ field: 'stage', operator: 'eq', value: 'negotiation' }],
    sortField: 'value', sortDirection: 'desc',
    isPinned: true, icon: 'handshake', color: 'brand',
    createdBy: 'David Muñoz', createdAt: now, updatedAt: now,
  },
  {
    id: 'sv-04', name: 'Deals alto valor (>20k)', nameKey: 'sv04', entityType: 'deal',
    filters: [{ field: 'value', operator: 'gte', value: 20000 }],
    sortField: 'value', sortDirection: 'desc',
    isPinned: false, icon: 'trending-up', color: 'purple',
    createdBy: 'David Muñoz', createdAt: now, updatedAt: now,
  },
  {
    id: 'sv-05', name: 'Empresas SaaS', nameKey: 'sv05', entityType: 'company',
    filters: [{ field: 'industry', operator: 'eq', value: 'saas' }],
    sortField: 'name', sortDirection: 'asc',
    isPinned: true, icon: 'cloud', color: 'sky',
    createdBy: 'David Muñoz', createdAt: now, updatedAt: now,
  },
]

const LEGACY_NAMEKEY_BY_ID: Record<string, NonNullable<SmartView['nameKey']>> = {
  'sv-01': 'sv01',
  'sv-02': 'sv02',
  'sv-03': 'sv03',
  'sv-04': 'sv04',
  'sv-05': 'sv05',
}

const LEGACY_NAMEKEY_BY_NAME: Record<string, NonNullable<SmartView['nameKey']>> = {
  'prospectos activos': 'sv01',
  'prospectos ativos': 'sv01',
  'active prospects': 'sv01',
  'prospects actifs': 'sv01',
  'aktive interessenten': 'sv01',
  'prospetti attivi': 'sv01',
  'clientes activos': 'sv02',
  'clientes ativos': 'sv02',
  'active customers': 'sv02',
  'clients actifs': 'sv02',
  'aktive kunden': 'sv02',
  'clienti attivi': 'sv02',
  'deals en negociación': 'sv03',
  'negócios em negociação': 'sv03',
  'deals in negotiation': 'sv03',
  'deals en négociation': 'sv03',
  'deals in verhandlung': 'sv03',
  'deals in negoziazione': 'sv03',
  'deals alto valor (>20k)': 'sv04',
  'negócios alto valor (>20k)': 'sv04',
  'high-value deals (>20k)': 'sv04',
  'deals de grande valeur (>20k)': 'sv04',
  'hochwertige deals (>20k)': 'sv04',
  'deal di alto valore (>20k)': 'sv04',
  'empresas saas': 'sv05',
  'saas companies': 'sv05',
  'entreprises saas': 'sv05',
  'saas-unternehmen': 'sv05',
  'aziende saas': 'sv05',
}

function normalizeViewName(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeSeedViewLocalization(views: SmartView[]): SmartView[] {
  return views.map((view) => {
    if (view.nameKey) return view
    const migratedKey = LEGACY_NAMEKEY_BY_ID[view.id]
      ?? LEGACY_NAMEKEY_BY_NAME[normalizeViewName(view.name)]
    if (!migratedKey) return view
    return { ...view, nameKey: migratedKey }
  })
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface ViewsStore {
  views: SmartView[]
  inboxViews: InboxSavedView[]
  activeViewId: Record<CustomFieldEntityType, string | null>

  addView: (view: Omit<SmartView, 'id' | 'createdAt' | 'updatedAt'>) => SmartView
  updateView: (id: string, updates: Partial<SmartView>) => void
  deleteView: (id: string) => void
  togglePin: (id: string) => void
  setActiveView: (entityType: CustomFieldEntityType, viewId: string | null) => void

  getViewsForEntity: (entityType: CustomFieldEntityType) => SmartView[]
  getPinnedViews: (entityType: CustomFieldEntityType) => SmartView[]
  getActiveView: (entityType: CustomFieldEntityType) => SmartView | null
  addInboxView: (name: string, query: string, filters: InboxAdvancedFilters) => InboxSavedView
  updateInboxView: (id: string, updates: Partial<Pick<InboxSavedView, 'name' | 'query' | 'filters'>>) => void
  deleteInboxView: (id: string) => void
}

export const useViewsStore = create<ViewsStore>()(
  persist(
    (set, get) => ({
      views: [],
      inboxViews: [],
      activeViewId: { contact: null, company: null, deal: null },

      addView: (viewData) => {
        const ts = new Date().toISOString()
        const view: SmartView = { ...viewData, id: uuidv4(), createdAt: ts, updatedAt: ts }
        set((s) => ({ views: [...s.views, view] }))
        return view
      },

      updateView: (id, updates) => {
        set((s) => ({
          views: s.views.map((v) =>
            v.id === id ? { ...v, ...updates, updatedAt: new Date().toISOString() } : v
          ),
        }))
      },

      deleteView: (id) => {
        const view = get().views.find((v) => v.id === id)
        set((s) => {
          const newActive = { ...s.activeViewId }
          if (view && newActive[view.entityType] === id) {
            newActive[view.entityType] = null
          }
          return { views: s.views.filter((v) => v.id !== id), activeViewId: newActive }
        })
      },

      togglePin: (id) => {
        set((s) => ({
          views: s.views.map((v) =>
            v.id === id ? { ...v, isPinned: !v.isPinned, updatedAt: new Date().toISOString() } : v
          ),
        }))
      },

      setActiveView: (entityType, viewId) => {
        set((s) => ({ activeViewId: { ...s.activeViewId, [entityType]: viewId } }))
      },

      getViewsForEntity: (entityType) => {
        return get().views.filter((v) => v.entityType === entityType)
      },

      getPinnedViews: (entityType) => {
        return get().views.filter((v) => v.entityType === entityType && v.isPinned)
      },

      getActiveView: (entityType) => {
        const id = get().activeViewId[entityType]
        return id ? get().views.find((v) => v.id === id) ?? null : null
      },

      addInboxView: (name, query, filters) => {
        const ts = new Date().toISOString()
        const view: InboxSavedView = {
          id: uuidv4(),
          name: name.trim(),
          query,
          filters,
          createdAt: ts,
          updatedAt: ts,
        }
        set((s) => ({ inboxViews: [...s.inboxViews, view] }))
        return view
      },

      updateInboxView: (id, updates) => {
        set((s) => ({
          inboxViews: s.inboxViews.map((view) => (
            view.id === id ? { ...view, ...updates, updatedAt: new Date().toISOString() } : view
          )),
        }))
      },

      deleteInboxView: (id) => {
        set((s) => ({ inboxViews: s.inboxViews.filter((view) => view.id !== id) }))
      },
    }),
    {
      name: 'crm_views',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (state.views.length === 0) {
          state.views = SEED_VIEWS
          return
        }
        state.views = normalizeSeedViewLocalization(state.views)
      },
    }
  )
)
