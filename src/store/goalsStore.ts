import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { SalesGoal } from '../types'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getOrgId, sbDelete } from '../lib/supabaseHelpers'
import { useAuthStore } from './authStore'

interface GoalsState {
  goals: SalesGoal[]
  isLoading: boolean
  error: string | null
  fetchGoals: () => Promise<void>
  addGoal: (goal: Omit<SalesGoal, 'id'>) => Promise<{ goal?: SalesGoal; error?: string }>
  updateGoal: (id: string, updates: Partial<SalesGoal>) => void
  deleteGoal: (id: string) => void
  getActiveGoals: () => SalesGoal[]
}

const seedGoals: SalesGoal[] = [
  { id: 'goal-001', userId: 'u1', type: 'revenue', target: 50000, current: 32500, period: 'monthly', startDate: '2026-03-01', endDate: '2026-03-31' },
  { id: 'goal-002', userId: 'u1', type: 'deals_closed', target: 8, current: 5, period: 'monthly', startDate: '2026-03-01', endDate: '2026-03-31' },
  { id: 'goal-003', userId: 'u1', type: 'activities', target: 60, current: 42, period: 'monthly', startDate: '2026-03-01', endDate: '2026-03-31' },
  { id: 'goal-004', userId: 'u1', type: 'contacts_added', target: 20, current: 14, period: 'monthly', startDate: '2026-03-01', endDate: '2026-03-31' },
]

function rowToGoal(r: Record<string, unknown>): SalesGoal {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    type: r.type as SalesGoal['type'],
    target: r.target as number,
    current: r.current as number,
    period: r.period as SalesGoal['period'],
    startDate: r.start_date as string,
    endDate: r.end_date as string,
  }
}

export const useGoalsStore = create<GoalsState>()((set, get) => ({
  goals: seedGoals,
  isLoading: false,
  error: null,

  fetchGoals: async () => {
    if (!isSupabaseConfigured || !supabase) {
      set({ goals: seedGoals })
      return
    }
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await (supabase as any).from('sales_goals').select('*').order('created_at', { ascending: false })
      if (error) throw error
      set({ goals: (data ?? []).map(rowToGoal), isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  addGoal: async (goalData) => {
    const currentUserId = useAuthStore.getState().currentUser?.id
    const effectiveUserId = goalData.userId || currentUserId || 'unknown-user'
    const goal: SalesGoal = { ...goalData, id: uuidv4() }
    goal.userId = effectiveUserId
    set((s) => ({ goals: [...s.goals, goal] }))
    if (isSupabaseConfigured && supabase) {
      const { error } = await (supabase as any).from('sales_goals').insert({
        id: goal.id, user_id: goal.userId, type: goal.type,
        target: goal.target, current: goal.current, period: goal.period,
        start_date: goal.startDate, end_date: goal.endDate,
        organization_id: getOrgId(),
      })
      if (error) {
        console.error('[goalsStore] insert error', error)
        set((s) => ({ goals: s.goals.filter((g) => g.id !== goal.id), error: error.message }))
        return { error: error.message as string }
      }
    }
    return { goal }
  },

  updateGoal: (id, updates) => {
    set((s) => ({ goals: s.goals.map((g) => g.id === id ? { ...g, ...updates } : g) }))
    if (isSupabaseConfigured && supabase) {
      const row: Record<string, unknown> = {}
      if (updates.userId !== undefined) row.user_id = updates.userId
      if (updates.type !== undefined) row.type = updates.type
      if (updates.target !== undefined) row.target = updates.target
      if (updates.current !== undefined) row.current = updates.current
      if (updates.period !== undefined) row.period = updates.period
      if (updates.startDate !== undefined) row.start_date = updates.startDate
      if (updates.endDate !== undefined) row.end_date = updates.endDate
      ;(supabase as any).from('sales_goals').update(row).eq('id', id)
        .then(({ error }: any) => { if (error) console.error('[goalsStore] update error', error) })
    }
  },

  deleteGoal: (id) => {
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }))
    if (isSupabaseConfigured && supabase) {
      sbDelete('sales_goals', id).catch((e) => console.error('[goalsStore] delete error', e))
    }
  },

  getActiveGoals: () => {
    const now = new Date().toISOString().split('T')[0]
    return get().goals.filter((g) => g.startDate <= now && g.endDate >= now)
  },
}))
