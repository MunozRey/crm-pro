import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Activity, ActivityFilters } from '../types'
import { seedActivities } from '../utils/seedData'
import { useAuditStore } from './auditStore'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getOrgId, sbDelete } from '../lib/supabaseHelpers'

// ── Snake ↔ Camel mappers ───────────────────────────────────────────────────

function rowToActivity(row: Record<string, unknown>): Activity {
  return {
    id: row.id as string,
    type: (row.type as Activity['type']) ?? 'task',
    subject: (row.subject as string) ?? '',
    description: (row.description as string) ?? '',
    outcome: (row.outcome as string) ?? undefined,
    dueDate: (row.due_date as string) ?? undefined,
    completedAt: (row.completed_at as string) ?? undefined,
    status: (row.status as Activity['status']) ?? 'pending',
    contactId: (row.contact_id as string) ?? undefined,
    companyId: (row.company_id as string) ?? undefined,
    dealId: (row.deal_id as string) ?? undefined,
    createdBy: (row.created_by as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
  }
}

function activityToRow(a: Partial<Activity>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (a.type !== undefined) row.type = a.type
  if (a.subject !== undefined) row.subject = a.subject
  if (a.description !== undefined) row.description = a.description
  if (a.outcome !== undefined) row.outcome = a.outcome
  if (a.dueDate !== undefined) row.due_date = a.dueDate
  if (a.completedAt !== undefined) row.completed_at = a.completedAt
  if (a.status !== undefined) row.status = a.status
  if (a.contactId !== undefined) row.contact_id = a.contactId
  if (a.companyId !== undefined) row.company_id = a.companyId
  if (a.dealId !== undefined) row.deal_id = a.dealId
  if (a.createdBy !== undefined) row.created_by = a.createdBy
  return row
}

// ── State interface ─────────────────────────────────────────────────────────

export interface ActivitiesState {
  activities: Activity[]
  filters: ActivityFilters
  selectedId: string | null
  isLoading: boolean
  error: string | null

  fetchActivities: () => Promise<void>
  addActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => Activity
  updateActivity: (id: string, updates: Partial<Activity>) => void
  deleteActivity: (id: string) => void
  completeActivity: (id: string, outcome?: string) => void
  setFilter: (key: keyof ActivityFilters, value: string) => void
  clearFilters: () => void
  setSelectedId: (id: string | null) => void

  getById: (id: string) => Activity | undefined
  getFilteredActivities: () => Activity[]
  getActivitiesForContact: (contactId: string) => Activity[]
  getActivitiesForDeal: (dealId: string) => Activity[]
  getActivitiesForCompany: (companyId: string) => Activity[]
  getPendingActivities: () => Activity[]
  getOverdueActivities: () => Activity[]
}

const defaultFilters: ActivityFilters = {
  search: '',
  type: '',
  status: '',
  contactId: '',
  dealId: '',
  dateFrom: '',
  dateTo: '',
}

export const useActivitiesStore = create<ActivitiesState>()(
  (set, get) => ({
    activities: [],
    filters: defaultFilters,
    selectedId: null,
    isLoading: false,
    error: null,

    fetchActivities: async () => {
      set({ isLoading: true, error: null })
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.from('activities').select('*').order('created_at', { ascending: false })
          if (error) throw error
          set({ activities: (data ?? []).map(rowToActivity), isLoading: false })
        } else {
          set({ activities: seedActivities, isLoading: false })
        }
      } catch (e: unknown) {
        set({ error: (e as Error).message, isLoading: false })
      }
    },

    addActivity: (activityData) => {
      const now = new Date().toISOString()
      const id = uuidv4()
      const activity: Activity = { ...activityData, id, createdAt: now }
      set((state) => ({ activities: [activity, ...state.activities] }))
      useAuditStore.getState().logAction('activity_created', 'activity', activity.id, activity.subject, 'Actividad creada')

      if (isSupabaseConfigured && supabase) {
        const row = activityToRow(activityData)
        ;((supabase as any).from('activities').insert({ ...row, organization_id: getOrgId() }).select().single()
        ).then(({ data, error }: any) => {
            if (error) {
              set((s: any) => ({ activities: s.activities.filter((a: any) => a.id !== id), error: error.message }))
              return
            }
            const real = rowToActivity(data as Record<string, unknown>)
            set((s: any) => ({ activities: s.activities.map((a: any) => a.id === id ? real : a) }))
          }).catch(() => {
            set((s: any) => ({ activities: s.activities.filter((a: any) => a.id !== id) }))
          })
      }

      return activity
    },

    updateActivity: (id, updates) => {
      set((state) => ({
        activities: state.activities.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
      }))

      if (isSupabaseConfigured && supabase) {
        const row = activityToRow(updates)
        ;(supabase as any).from('activities').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)
      }
    },

    deleteActivity: (id) => {
      const activity = get().getById(id)
      set((state) => ({ activities: state.activities.filter((a) => a.id !== id) }))
      useAuditStore.getState().logAction('activity_deleted', 'activity', id, activity?.subject ?? '', 'Actividad eliminada')

      if (isSupabaseConfigured && supabase) {
        sbDelete('activities', id).then(null, (e) => set({ error: (e as Error).message }))
      }
    },

    completeActivity: (id, outcome) => {
      const now = new Date().toISOString()
      set((state) => ({
        activities: state.activities.map((a) =>
          a.id === id
            ? { ...a, status: 'completed' as const, completedAt: now, ...(outcome ? { outcome } : {}) }
            : a
        ),
      }))
      const activity = get().getById(id)
      useAuditStore.getState().logAction('activity_completed', 'activity', id, activity?.subject ?? '', 'Actividad completada')

      if (isSupabaseConfigured && supabase) {
        const updates: Record<string, unknown> = { status: 'completed', completed_at: now, updated_at: now }
        if (outcome) updates.outcome = outcome
        ;(supabase as any).from('activities').update(updates).eq('id', id)
      }
    },

    setFilter: (key, value) => {
      set((state) => ({ filters: { ...state.filters, [key]: value } }))
    },

    clearFilters: () => {
      set({ filters: defaultFilters })
    },

    setSelectedId: (id) => {
      set({ selectedId: id })
    },

    getById: (id) => {
      return get().activities.find((a) => a.id === id)
    },

    getFilteredActivities: () => {
      const { activities, filters } = get()
      return activities.filter((a) => {
        const q = filters.search.toLowerCase()
        if (q && !a.subject.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false
        if (filters.type && a.type !== filters.type) return false
        if (filters.status && a.status !== filters.status) return false
        if (filters.contactId && a.contactId !== filters.contactId) return false
        if (filters.dealId && a.dealId !== filters.dealId) return false
        if (filters.dateFrom && a.createdAt < filters.dateFrom) return false
        if (filters.dateTo && a.createdAt > filters.dateTo) return false
        return true
      })
    },

    getActivitiesForContact: (contactId) => {
      return get().activities.filter((a) => a.contactId === contactId)
    },

    getActivitiesForDeal: (dealId) => {
      return get().activities.filter((a) => a.dealId === dealId)
    },

    getActivitiesForCompany: (companyId) => {
      return get().activities.filter((a) => a.companyId === companyId)
    },

    getPendingActivities: () => {
      return get().activities.filter((a) => a.status === 'pending')
    },

    getOverdueActivities: () => {
      const now = new Date().toISOString().split('T')[0]
      return get().activities.filter(
        (a) => a.status === 'pending' && a.dueDate && a.dueDate < now
      )
    },
  })
)
