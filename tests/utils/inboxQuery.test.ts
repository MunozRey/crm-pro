import { describe, expect, it } from 'vitest'
import { buildInboxQueryMatcher } from '../../src/utils/inboxQuery'

describe('buildInboxQueryMatcher', () => {
  it('matches by subject token', () => {
    const matcher = buildInboxQueryMatcher('subject:proposal')
    expect(
      matcher({
        from: 'Alice <alice@acme.com>',
        to: ['bob@crm.com'],
        subject: 'Proposal Q2',
        snippet: 'Latest pricing update',
        body: '',
        unread: false,
        hasAttachment: false,
        tracked: false,
        opened: false,
        clicked: false,
        mine: false,
      }),
    ).toBe(true)
  })

  it('supports combined tokens and free text', () => {
    const matcher = buildInboxQueryMatcher('from:acme has:attachment pricing')
    expect(
      matcher({
        from: 'Alice <alice@acme.com>',
        to: ['ops@crm.com'],
        subject: 'Q2 Update',
        snippet: 'Attached pricing sheet',
        body: 'Please review',
        unread: true,
        hasAttachment: true,
        tracked: false,
        opened: false,
        clicked: false,
        mine: false,
      }),
    ).toBe(true)
  })

  it('rejects when operator condition is not met', () => {
    const matcher = buildInboxQueryMatcher('is:unread')
    expect(
      matcher({
        from: 'Alice <alice@acme.com>',
        to: ['ops@crm.com'],
        subject: 'Q2 Update',
        snippet: 'Attached pricing sheet',
        body: 'Please review',
        unread: false,
        hasAttachment: true,
        tracked: false,
        opened: false,
        clicked: false,
        mine: false,
      }),
    ).toBe(false)
  })
})
