import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}))

describe('templateStore quick replies', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('adds and removes quick replies in local mode', async () => {
    const { useTemplateStore } = await import('../../src/store/templateStore')
    const initialCount = useTemplateStore.getState().quickReplies.length

    useTemplateStore.getState().addQuickReply({
      title: 'My reply',
      body: 'Hello {{firstName}}',
    })
    expect(useTemplateStore.getState().quickReplies.length).toBe(initialCount + 1)
    const created = useTemplateStore.getState().quickReplies[0]
    expect(created?.title).toBe('My reply')

    if (created?.id) {
      useTemplateStore.getState().deleteQuickReply(created.id)
    }
    expect(useTemplateStore.getState().quickReplies.length).toBe(initialCount)
  })
})
