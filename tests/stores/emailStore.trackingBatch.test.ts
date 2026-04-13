import { beforeEach, describe, expect, it, vi } from 'vitest'

const recomputeLeadScore = vi.fn().mockResolvedValue(undefined)
const leadEventInsert = vi.fn().mockResolvedValue({ data: null, error: null })
const rpcMock = vi.fn().mockResolvedValue({ data: { success: true }, error: null })

const trackedEvents = [
  { id: 'evt-1', email_id: 'mail-1', event_type: 'open', created_at: '2026-04-13T10:00:00.000Z' },
  { id: 'evt-2', email_id: 'mail-1', event_type: 'click', created_at: '2026-04-13T10:05:00.000Z' },
]

const fromMock = vi.fn((table: string) => {
  if (table === 'email_tracking_events') {
    return {
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: trackedEvents, error: null }),
        }),
      }),
    }
  }

  if (table === 'leads') {
    return {
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [{ id: 'lead-1', email: 'lead@acme.com' }],
          error: null,
        }),
      }),
    }
  }

  if (table === 'lead_events') {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
      insert: leadEventInsert,
    }
  }

  return {
    select: vi.fn(),
    insert: vi.fn(),
  }
})

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: fromMock, rpc: rpcMock },
}))

vi.mock('../../src/lib/supabaseHelpers', () => ({
  getOrgId: vi.fn().mockReturnValue('org-1'),
  runSupabaseWrite: vi.fn(),
}))

vi.mock('../../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn().mockReturnValue({ currentUser: { id: 'user-1' } }),
  },
}))

vi.mock('../../src/store/leadsStore', () => ({
  useLeadsStore: {
    getState: vi.fn().mockReturnValue({ recomputeLeadScore }),
  },
}))

describe('emailStore tracking ingestion', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { useEmailStore } = await import('../../src/store/emailStore')
    useEmailStore.setState({
      emails: [{
        id: 'mail-1',
        from: 'rep@acme.com',
        to: ['lead@acme.com'],
        subject: 'Follow up',
        body: 'Hello',
        status: 'sent',
        ownerUserId: 'user-1',
        trackingEnabled: true,
        createdAt: '2026-04-13T09:00:00.000Z',
      }],
    })
  })

  it('recomputes score once per lead when multiple tracking events arrive', async () => {
    const { useEmailStore } = await import('../../src/store/emailStore')
    await useEmailStore.getState().refreshTrackingMetrics()

    expect(leadEventInsert).toHaveBeenCalledTimes(2)
    expect(recomputeLeadScore).toHaveBeenCalledTimes(1)
    expect(recomputeLeadScore).toHaveBeenCalledWith('lead-1', { reason: 'tracking_event_ingested' })
  })

  it('ignores tracking events from emails owned by another user', async () => {
    const { useEmailStore } = await import('../../src/store/emailStore')
    useEmailStore.setState({
      emails: [
        {
          id: 'mail-1',
          from: 'rep@acme.com',
          to: ['lead@acme.com'],
          subject: 'Owned',
          body: 'Hello',
          status: 'sent',
          ownerUserId: 'user-1',
          trackingEnabled: true,
          createdAt: '2026-04-13T09:00:00.000Z',
        },
        {
          id: 'mail-2',
          from: 'rep2@acme.com',
          to: ['lead@acme.com'],
          subject: 'Foreign',
          body: 'Hello',
          status: 'sent',
          ownerUserId: 'user-2',
          trackingEnabled: true,
          createdAt: '2026-04-13T09:01:00.000Z',
        },
      ],
    })

    fromMock.mockImplementation((table: string) => {
      if (table === 'email_tracking_events') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: 'evt-1', email_id: 'mail-1', event_type: 'open', created_at: '2026-04-13T10:00:00.000Z' },
                  { id: 'evt-2', email_id: 'mail-2', event_type: 'click', created_at: '2026-04-13T10:05:00.000Z' },
                ],
                error: null,
              }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ id: 'lead-1', email: 'lead@acme.com' }],
            error: null,
          }),
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
        insert: leadEventInsert,
      }
    })

    await useEmailStore.getState().refreshTrackingMetrics()

    expect(leadEventInsert).toHaveBeenCalledTimes(1)
    expect(recomputeLeadScore).toHaveBeenCalledTimes(1)
  })

  it('claims legacy tracked emails via rpc backfill for current user', async () => {
    const { useEmailStore } = await import('../../src/store/emailStore')
    useEmailStore.setState({
      emails: [
        {
          id: 'legacy-mail-1',
          from: 'rep@acme.com',
          to: ['lead@acme.com'],
          subject: 'Legacy owned',
          body: 'Hello',
          status: 'sent',
          trackingEnabled: true,
          createdAt: '2026-04-13T09:00:00.000Z',
        },
      ],
    })

    fromMock.mockImplementation((table: string) => {
      if (table === 'email_tracking_events') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: 'evt-legacy-1', email_id: 'legacy-mail-1', event_type: 'open', created_at: '2026-04-13T10:00:00.000Z' },
                ],
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'leads') {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'lead-1', email: 'lead@acme.com' }],
              error: null,
            }),
          }),
        }
      }
      if (table === 'lead_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
          insert: leadEventInsert,
        }
      }
      return { select: vi.fn(), insert: vi.fn() }
    })

    await useEmailStore.getState().refreshTrackingMetrics()

    expect(rpcMock).toHaveBeenCalledWith('backfill_email_tracking_user', {
      p_email_ids: ['legacy-mail-1'],
    })
  })
})
