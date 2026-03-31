import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    },
  },
  isSupabaseConfigured: true,
}))

describe('Login', () => {
  it('AUTH-01: calls signInWithPassword with email and password on submit', async () => {
    // Stub: will be filled in plan 2.2
    expect(true).toBe(true)
  })

  it('AUTH-01: shows error message when signIn returns an error', async () => {
    // Stub: will be filled in plan 2.2
    expect(true).toBe(true)
  })
})
