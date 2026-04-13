import { beforeEach, describe, expect, it, vi } from 'vitest'

const listGmailThreadsMock = vi.fn()
const getGmailProfileMock = vi.fn()

vi.mock('../../src/services/gmailService', () => ({
  listGmailThreads: listGmailThreadsMock,
  getGmailProfile: getGmailProfileMock,
  sendGmailEmail: vi.fn(),
}))

vi.mock('../../src/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}))

vi.mock('../../src/lib/supabaseHelpers', () => ({
  getOrgId: vi.fn(),
  runSupabaseWrite: vi.fn(),
}))

vi.mock('../../src/store/authStore', () => ({
  useAuthStore: { getState: vi.fn().mockReturnValue({ currentUser: { id: 'u-1' } }) },
}))

vi.mock('../../src/store/leadsStore', () => ({
  useLeadsStore: { getState: vi.fn().mockReturnValue({ recomputeLeadScore: vi.fn() }) },
}))

describe('emailStore sync state', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { useEmailStore } = await import('../../src/store/emailStore')
    useEmailStore.setState({
      gmailAddress: null,
      syncState: 'idle',
      lastSyncErrorAt: null,
      lastSyncErrorMessage: null,
      threads: [],
      threadsError: null,
    })
  })

  it('marks sync as healthy on successful load', async () => {
    getGmailProfileMock.mockResolvedValue({ emailAddress: 'rep@acme.com' })
    listGmailThreadsMock.mockResolvedValue({
      threads: [{ id: 'th-1', snippet: 'a', historyId: 'h1', messages: [] }],
      nextPageToken: null,
      historyId: 'h1',
    })
    const { useEmailStore } = await import('../../src/store/emailStore')
    await useEmailStore.getState().loadThreads('token')

    const state = useEmailStore.getState()
    expect(state.syncState).toBe('healthy')
    expect(state.lastSyncErrorMessage).toBeNull()
  })

  it('marks sync as error on failed load', async () => {
    getGmailProfileMock.mockResolvedValue({ emailAddress: 'rep@acme.com' })
    listGmailThreadsMock.mockRejectedValue(new Error('rate limited'))
    const { useEmailStore } = await import('../../src/store/emailStore')
    await useEmailStore.getState().loadThreads('token')

    const state = useEmailStore.getState()
    expect(state.syncState).toBe('error')
    expect(state.lastSyncErrorMessage).toContain('rate limited')
    expect(state.lastSyncErrorAt).toBeTruthy()
  })
})
