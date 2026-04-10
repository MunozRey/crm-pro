import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Deal, DealFilters, DealStage, QuoteItem } from '../types'
import { seedDeals } from '../utils/seedData'
import { useAuditStore } from './auditStore'
import { useNotificationsStore } from './notificationsStore'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getErrorMessage, getOrgId, runSupabaseWrite, sbDelete } from '../lib/supabaseHelpers'
import { useAuthStore } from './authStore'
import { useAutomationsStore } from './automationsStore'

// ── Snake ↔ Camel mappers ───────────────────────────────────────────────────

function rowToDeal(row: Record<string, unknown>): Deal {
  const assignedTo = row.assigned_to as string | null
  const users = useAuthStore.getState().users
  const assignedToName = assignedTo
    ? (users.find((u) => u.id === assignedTo)?.name ?? assignedTo)
    : ''

  return {
    id: row.id as string,
    title: (row.title as string) ?? '',
    value: (row.value as number) ?? 0,
    currency: (row.currency as Deal['currency']) ?? 'EUR',
    stage: (row.stage as Deal['stage']) ?? 'lead',
    probability: (row.probability as number) ?? 0,
    expectedCloseDate: (row.expected_close_date as string) ?? '',
    contactId: (row.contact_id as string) ?? '',
    companyId: (row.company_id as string) ?? '',
    assignedTo: assignedToName,
    priority: (row.priority as Deal['priority']) ?? 'medium',
    source: (row.source as string) ?? '',
    notes: (row.notes as string) ?? '',
    activities: (row.activities as string[]) ?? [],
    quoteItems: (row.quote_items as QuoteItem[]) ?? undefined,
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? '',
  }
}

function dealToRow(d: Partial<Deal>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (d.title !== undefined) row.title = d.title
  if (d.value !== undefined) row.value = d.value
  if (d.currency !== undefined) row.currency = d.currency
  if (d.stage !== undefined) row.stage = d.stage
  if (d.probability !== undefined) row.probability = d.probability
  if (d.expectedCloseDate !== undefined) row.expected_close_date = d.expectedCloseDate
  if (d.contactId !== undefined) row.contact_id = d.contactId
  if (d.companyId !== undefined) row.company_id = d.companyId
  // `assigned_to` is UUID in DB. UI currently keeps display names.
  // Only send value when it's already a UUID.
  if (d.assignedTo !== undefined && isUuid(d.assignedTo)) row.assigned_to = d.assignedTo
  if (d.priority !== undefined) row.priority = d.priority
  if (d.source !== undefined) row.source = d.source
  if (d.notes !== undefined) row.notes = d.notes
  if (d.activities !== undefined) row.activities = d.activities
  if (d.quoteItems !== undefined) row.quote_items = d.quoteItems
  return row
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

// ── State interface ─────────────────────────────────────────────────────────

interface DealsState {
  deals: Deal[]
  filters: DealFilters
  selectedId: string | null
  isLoading: boolean
  error: string | null
  viewMode: 'kanban' | 'list'

  fetchDeals: () => Promise<void>
  addDeal: (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => Deal
  updateDeal: (id: string, updates: Partial<Deal>) => void
  deleteDeal: (id: string) => void
  moveDeal: (id: string, newStage: DealStage) => void
  setFilter: (key: keyof DealFilters, value: string) => void
  clearFilters: () => void
  setSelectedId: (id: string | null) => void
  setViewMode: (mode: 'kanban' | 'list') => void

  updateQuote: (dealId: string, items: QuoteItem[]) => void

  getById: (id: string) => Deal | undefined
  getFilteredDeals: () => Deal[]
  getDealsByStage: (stage: DealStage) => Deal[]
  getPipelineValue: () => number
  getWonThisMonth: () => number
}

const defaultFilters: DealFilters = {
  search: '',
  stage: '',
  assignedTo: '',
  priority: '',
  valueMin: '',
  valueMax: '',
  dueDateFrom: '',
  dueDateTo: '',
}

export const useDealsStore = create<DealsState>()(
  (set, get) => ({
    deals: [],
    filters: defaultFilters,
    selectedId: null,
    isLoading: false,
    error: null,
    viewMode: 'kanban',

    fetchDeals: async () => {
      set({ isLoading: true, error: null })
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.from('deals').select('*').order('created_at', { ascending: false })
          if (error) throw error
          set({ deals: (data ?? []).map(rowToDeal), isLoading: false })
        } else {
          set({ deals: seedDeals, isLoading: false })
        }
      } catch (e: unknown) {
        set({ error: (e as Error).message, isLoading: false })
      }
    },

    addDeal: (dealData) => {
      const now = new Date().toISOString()
      const id = uuidv4()
      const deal: Deal = { ...dealData, id, createdAt: now, updatedAt: now }
      set((state) => ({ deals: [deal, ...state.deals] }))
      useAuditStore.getState().logAction('deal_created', 'deal', deal.id, deal.title, 'Deal creado')

      if (isSupabaseConfigured && supabase) {
        const row = dealToRow(dealData)
        const currentUserId = useAuthStore.getState().currentUser?.id
        const createdBy = currentUserId && isUuid(currentUserId) ? currentUserId : null
        ;(supabase.from('deals').insert({ ...row, created_by: createdBy, organization_id: getOrgId() } as never).select().single()
        ).then(({ data, error }: { data: Record<string, unknown> | null; error: { message: string } | null }) => {
            if (error) {
              set((s) => ({ deals: s.deals.filter((d) => d.id !== id), error: error.message }))
              return
            }
            if (!data) {
              set((s) => ({ deals: s.deals.filter((d) => d.id !== id), error: 'Empty Supabase insert response' }))
              return
            }
            const real = rowToDeal(data)
            set((s) => ({ deals: s.deals.map((d) => d.id === id ? real : d) }))
          }, (error: unknown) => {
            set((s) => ({ deals: s.deals.filter((d) => d.id !== id), error: getErrorMessage(error) }))
          })
      }

      return deal
    },

    updateDeal: (id, updates) => {
      set((state) => ({
        deals: state.deals.map((d) =>
          d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
        ),
      }))
      const deal = get().getById(id)
      useAuditStore.getState().logAction('deal_updated', 'deal', id, deal?.title ?? '', 'Deal actualizado')

      if (isSupabaseConfigured && supabase) {
        const row = dealToRow(updates)
        runSupabaseWrite(
          'dealsStore:updateDeal',
          supabase.from('deals').update({ ...row, updated_at: new Date().toISOString() } as never).eq('id', id),
          (message) => set({ error: message }),
        )
      }
    },

    deleteDeal: (id) => {
      const deal = get().getById(id)
      set((state) => ({ deals: state.deals.filter((d) => d.id !== id) }))
      useAuditStore.getState().logAction('deal_deleted', 'deal', id, deal?.title ?? '', 'Deal eliminado')

      if (isSupabaseConfigured && supabase) {
        sbDelete('deals', id).then(null, (e) => set({ error: (e as Error).message }))
      }
    },

    moveDeal: (id, newStage) => {
      const oldDeal = get().getById(id)

      // Optimistic local update
      set((state) => ({
        deals: state.deals.map((d) =>
          d.id === id
            ? { ...d, stage: newStage, updatedAt: new Date().toISOString() }
            : d
        ),
      }))

      const deal = get().getById(id)
      const title = deal?.title ?? ''
      useAuditStore.getState().logAction('deal_stage_changed', 'deal', id, title, `Movido a ${newStage}`)

      // Trigger notifications
      const notify = useNotificationsStore.getState().notify
      if (newStage === 'closed_won') {
        notify('deal_won', `Deal ganado: ${title}`, `El deal "${title}" se ha cerrado exitosamente.`, {
          entityType: 'deal', entityId: id,
        })
      } else if (newStage === 'closed_lost') {
        notify('deal_lost', `Deal perdido: ${title}`, `El deal "${title}" se ha marcado como perdido.`, {
          entityType: 'deal', entityId: id,
        })
      } else if (oldDeal && oldDeal.stage !== newStage) {
        notify('deal_stage_changed', `${title} avanzó`, `De ${oldDeal.stage} a ${newStage}`, {
          entityType: 'deal', entityId: id,
        })
      }

      // Fire pipeline automations
      if (deal) {
        const triggerType = newStage === 'closed_won'
          ? 'deal_closed_won'
          : newStage === 'closed_lost'
            ? 'deal_closed_lost'
            : 'deal_stage_changed'
        useAutomationsStore.getState().executeRulesForTrigger(triggerType, {
          deal,
          fromStage: oldDeal?.stage,
          toStage: newStage,
        })
      }

      // Fire-and-forget Supabase update
      if (isSupabaseConfigured && supabase) {
        runSupabaseWrite(
          'dealsStore:moveDeal',
          supabase.from('deals').update({ stage: newStage, updated_at: new Date().toISOString() } as never).eq('id', id),
          (message) => set({ error: message }),
        )
      }
    },

    updateQuote: (dealId, items) => {
      set((state) => ({
        deals: state.deals.map((d) =>
          d.id === dealId
            ? { ...d, quoteItems: items, updatedAt: new Date().toISOString() }
            : d
        ),
      }))

      if (isSupabaseConfigured && supabase) {
        runSupabaseWrite(
          'dealsStore:updateQuote',
          supabase.from('deals').update({ quote_items: items as unknown as Record<string, unknown>, updated_at: new Date().toISOString() } as never).eq('id', dealId),
          (message) => set({ error: message }),
        )
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

    setViewMode: (mode) => {
      set({ viewMode: mode })
    },

    getById: (id) => {
      return get().deals.find((d) => d.id === id)
    },

    getFilteredDeals: () => {
      const { deals, filters } = get()
      return deals.filter((d) => {
        const q = filters.search.toLowerCase()
        if (q && !d.title.toLowerCase().includes(q)) return false
        if (filters.stage && d.stage !== filters.stage) return false
        if (filters.assignedTo && d.assignedTo !== filters.assignedTo) return false
        if (filters.priority && d.priority !== filters.priority) return false
        if (filters.valueMin && d.value < Number(filters.valueMin)) return false
        if (filters.valueMax && d.value > Number(filters.valueMax)) return false
        if (filters.dueDateFrom && d.expectedCloseDate < filters.dueDateFrom) return false
        if (filters.dueDateTo && d.expectedCloseDate > filters.dueDateTo) return false
        return true
      })
    },

    getDealsByStage: (stage) => {
      return get().getFilteredDeals().filter((d) => d.stage === stage)
    },

    getPipelineValue: () => {
      return get()
        .deals.filter((d) => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
        .reduce((sum, d) => sum + d.value, 0)
    },

    getWonThisMonth: () => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      return get()
        .deals.filter((d) => d.stage === 'closed_won' && d.updatedAt >= monthStart)
        .reduce((sum, d) => sum + d.value, 0)
    },
  })
)
