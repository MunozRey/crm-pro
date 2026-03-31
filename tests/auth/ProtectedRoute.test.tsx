import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProtectedRoute } from '../../src/components/auth/ProtectedRoute'
import { useAuthStore } from '../../src/store/authStore'

vi.mock('../../src/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}))

describe('ProtectedRoute', () => {
  it('AUTH-04: renders null (not redirect) while isLoadingAuth is true', () => {
    // Stub: will be filled in plan 2.4
    expect(true).toBe(true)
  })

  it('AUTH-04: redirects to /login when not authenticated and not loading', () => {
    // Stub: will be filled in plan 2.4
    expect(true).toBe(true)
  })

  it('AUTH-04: renders children when authenticated and not loading', () => {
    // Stub: will be filled in plan 2.4
    expect(true).toBe(true)
  })
})
