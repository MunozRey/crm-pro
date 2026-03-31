import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
  isSupabaseConfigured: true,
}))

describe('Register', () => {
  it('AUTH-01: renders register form', async () => {
    // Stub: will be filled in plan 2.1
    expect(true).toBe(true)
  })

  it('AUTH-01: calls supabase.auth.signUp on submit', async () => {
    // Stub: will be filled in plan 2.1
    expect(true).toBe(true)
  })

  it('AUTH-02: shows email verification screen when signUp returns no session', async () => {
    // Stub: will be filled in plan 2.1
    expect(true).toBe(true)
  })

  it('AUTH-01: navigates to / when signUp returns a session immediately', async () => {
    // Stub: will be filled in plan 2.1
    expect(true).toBe(true)
  })
})
