import { describe, expect, it } from 'vitest'
import { injectOpenPixel, rewriteLinksForTracking } from '../../src/lib/emailTracking'

describe('emailTracking helpers', () => {
  it('rewrites links to tracking endpoint and preserves token per original URL', () => {
    const html = 'Go to https://example.com and again https://example.com'
    const result = rewriteLinksForTracking(html, 'https://supabase.test/functions/v1/track-click')

    expect(result.links).toHaveLength(1)
    expect(result.links[0]?.original_url).toBe('https://example.com')
    expect(result.htmlBody).toContain('https://supabase.test/functions/v1/track-click?token=')
  })

  it('injects pixel before closing body tag when present', () => {
    const html = '<html><body><p>Hello</p></body></html>'
    const withPixel = injectOpenPixel(html, 'https://supabase.test/functions/v1/track-open?token=abc')
    expect(withPixel).toContain('<img src="https://supabase.test/functions/v1/track-open?token=abc"')
    expect(withPixel).toContain('</body>')
  })
})
