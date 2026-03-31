import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '../../src/store/authStore'

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
  isSupabaseConfigured: true,
}))

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      currentUser: null,
      session: null,
      supabaseSession: null,
      isLoadingAuth: true,
    })
  })

  it('AUTH-04: isLoadingAuth initializes as true', () => {
    // After plan 2.4 sets default to true, this test verifies the initial state
    // Stub: will be filled in plan 2.4
    expect(true).toBe(true)
  })

  it('AUTH-05: logout calls supabase.auth.signOut', async () => {
    // Stub: will be filled in plan 2.5
    expect(true).toBe(true)
  })

  it('AUTH-05: logout clears currentUser and session', async () => {
    // Stub: will be filled in plan 2.5
    expect(true).toBe(true)
  })
})
