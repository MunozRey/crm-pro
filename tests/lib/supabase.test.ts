import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

describe('supabase lib', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    warnSpy.mockRestore()
  })

  it('SEC-06: console.warn fires in dev when VITE_SUPABASE_URL is absent', async () => {
    vi.stubEnv('DEV', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    await import('../../src/lib/supabase')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[CRM]'))
  })

  it('SEC-06: no console.warn when VITE_SUPABASE_URL is present and valid', async () => {
    vi.stubEnv('DEV', 'false')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'valid-key-longer-than-ten-chars')
    await import('../../src/lib/supabase')
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
