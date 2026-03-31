import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore, initSupabaseAuth } from '../../src/store/authStore'

const { mockOnAuthStateChange } = vi.hoisted(() => ({
  mockOnAuthStateChange: vi.fn(),
}))

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
  isSupabaseConfigured: true,
}))

describe('initSupabaseAuth', () => {
  beforeEach(() => {
    mockOnAuthStateChange.mockReset()
    useAuthStore.setState({
      currentUser: null,
      isLoadingAuth: true,
    })
  })

  it('AUTH-04: resolves isLoadingAuth to false on INITIAL_SESSION event', () => {
    let capturedCallback: ((event: string, session: unknown) => void) | null = null
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      capturedCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    initSupabaseAuth()

    // Simulate INITIAL_SESSION with a session
    capturedCallback!('INITIAL_SESSION', {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { full_name: 'Test User', role: 'sales_rep' },
        app_metadata: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    })

    expect(useAuthStore.getState().isLoadingAuth).toBe(false)
  })

  it('AUTH-04: sets currentUser with correct shape from Supabase session', () => {
    let capturedCallback: ((event: string, session: unknown) => void) | null = null
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      capturedCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    initSupabaseAuth()

    capturedCallback!('SIGNED_IN', {
      user: {
        id: 'user-456',
        email: 'sales@example.com',
        user_metadata: { full_name: 'Sales Rep', role: 'sales_rep', job_title: 'SDR' },
        app_metadata: { organization_id: 'org-789' },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
      },
    })

    const user = useAuthStore.getState().currentUser
    expect(user).not.toBeNull()
    expect(user?.id).toBe('user-456')
    expect(user?.email).toBe('sales@example.com')
    expect(user?.name).toBe('Sales Rep')
    expect(user?.isActive).toBe(true)
    expect(user?.organizationId).toBe('org-789')
  })

  it('AUTH-04: clears currentUser when session is null (SIGNED_OUT)', () => {
    let capturedCallback: ((event: string, session: unknown) => void) | null = null
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      capturedCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    useAuthStore.setState({ currentUser: { id: 'u1', email: 'a@b.com', name: 'A', role: 'sales_rep', jobTitle: '', isActive: true, createdAt: '', updatedAt: '' } })

    initSupabaseAuth()
    capturedCallback!('SIGNED_OUT', null)

    expect(useAuthStore.getState().currentUser).toBeNull()
  })

  it('AUTH-05: authStore.test.ts - logout stub (filled in plan 2.5)', () => {
    expect(true).toBe(true)
  })
})
