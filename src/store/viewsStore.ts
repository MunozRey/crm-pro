import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { SmartView, SmartViewFilter, CustomFieldEntityType } from '../types'

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

// ─── Store ───────────────────────────────────────────────────────────────────

interface ViewsStore {
  views: SmartView[]
  activeViewId: Record<CustomFieldEntityType, string | null>

  addView: (view: Omit<SmartView, 'id' | 'createdAt' | 'updatedAt'>) => SmartView
  updateView: (id: string, updates: Partial<SmartView>) => void
  deleteView: (id: string) => void
  togglePin: (id: string) => void
  setActiveView: (entityType: CustomFieldEntityType, viewId: string | null) => void

  getViewsForEntity: (entityType: CustomFieldEntityType) => SmartView[]
  getPinnedViews: (entityType: CustomFieldEntityType) => SmartView[]
  getActiveView: (entityType: CustomFieldEntityType) => SmartView | null
}

export const useViewsStore = create<ViewsStore>()(
  persist(
    (set, get) => ({
      views: [],
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
    }),
    {
      name: 'crm_views',
      onRehydrateStorage: () => (state) => {
        if (state && state.views.length === 0) {
          state.views = SEED_VIEWS
        }
      },
    }
  )
)
