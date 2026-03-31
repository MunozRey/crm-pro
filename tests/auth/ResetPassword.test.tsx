import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
  },
  isSupabaseConfigured: true,
}))

describe('ResetPassword', () => {
  it('AUTH-03: calls updateUser with new password on submit', async () => {
    // Stub: will be filled in plan 2.3
    expect(true).toBe(true)
  })

  it('AUTH-03: shows error when passwords do not match', async () => {
    // Stub: will be filled in plan 2.3
    expect(true).toBe(true)
  })
})
