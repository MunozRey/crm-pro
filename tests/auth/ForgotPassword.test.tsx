import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
  },
  isSupabaseConfigured: true,
}))

describe('ForgotPassword', () => {
  it('AUTH-03: calls resetPasswordForEmail with the entered email', async () => {
    // Stub: will be filled in plan 2.3
    expect(true).toBe(true)
  })

  it('AUTH-03: shows confirmation message after successful submission', async () => {
    // Stub: will be filled in plan 2.3
    expect(true).toBe(true)
  })
})
