import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}))

describe('goalsStore', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('creates a goal in local mode', async () => {
    const { useGoalsStore } = await import('../../src/store/goalsStore')
    const initial = useGoalsStore.getState().goals.length

    const result = await useGoalsStore.getState().addGoal({
      userId: 'u-test',
      type: 'revenue',
      target: 1000,
      current: 0,
      period: 'monthly',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    })

    expect(result.error).toBeUndefined()
    expect(result.goal?.id).toBeDefined()
    expect(useGoalsStore.getState().goals.length).toBe(initial + 1)
  })
})
