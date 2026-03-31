import { describe, it, expect, vi, afterEach } from 'vitest'

describe('supabase lib', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('SEC-06: console.warn fires in dev when VITE_SUPABASE_URL is absent', async () => {
    // Stub: will be filled in plan 2.1
    // This test re-imports supabase.ts with DEV=true and no env vars set
    expect(true).toBe(true)
  })

  it('SEC-06: no console.warn when VITE_SUPABASE_URL is present and valid', async () => {
    // Stub: will be filled in plan 2.1
    expect(true).toBe(true)
  })
})
