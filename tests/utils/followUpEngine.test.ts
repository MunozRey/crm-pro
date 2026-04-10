import { describe, it, expect } from 'vitest'
import { getFollowUpReminders } from '../../src/utils/followUpEngine'
import type { Contact, Activity, Company } from '../../src/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

const baseCompany: Company = {
  id: 'company-1',
  name: 'Acme Corp',
  domain: 'acme.com',
  industry: 'saas',
  size: '50',
  country: 'ES',
  city: 'Madrid',
  website: 'https://acme.com',
  phone: '+34600000000',
  status: 'customer',
  contacts: [],
  deals: [],
  tags: [],
  notes: '',
  createdAt: daysAgo(90),
  updatedAt: daysAgo(30),
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'contact-1',
    firstName: 'Ana',
    lastName: 'García',
    email: 'ana@acme.com',
    phone: '+34600000001',
    jobTitle: 'CEO',
    companyId: 'company-1',
    status: 'prospect',
    source: 'website',
    tags: [],
    assignedTo: 'user-1',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30),
    lastContactedAt: daysAgo(30),
    notes: '',
    linkedDeals: [],
    ...overrides,
  }
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    type: 'email',
    subject: 'Initial outreach',
    description: '',
    status: 'completed',
    contactId: 'contact-1',
    createdBy: 'user-1',
    createdAt: daysAgo(1),
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getFollowUpReminders', () => {
  it('returns empty array for empty inputs', () => {
    expect(getFollowUpReminders([], [], [])).toEqual([])
  })

  it('returns no reminder when contact has recent activity (within 7 days)', () => {
    const contact = makeContact()
    const recentActivity = makeActivity({ createdAt: daysAgo(2) })
    const reminders = getFollowUpReminders([contact], [recentActivity], [baseCompany])
    expect(reminders).toHaveLength(0)
  })

  it('generates a reminder for a stale contact with no activities', () => {
    // Contact created 60 days ago, never contacted
    const staleContact = makeContact({ id: 'stale-1', createdAt: daysAgo(60), updatedAt: daysAgo(60) })
    const reminders = getFollowUpReminders([staleContact], [], [baseCompany])
    expect(reminders.length).toBeGreaterThan(0)
    expect(reminders[0].contactId).toBe('stale-1')
  })

  it('generates a reminder for a contact with stale activity (>7 days)', () => {
    const contact = makeContact()
    const staleActivity = makeActivity({ createdAt: daysAgo(20) })
    const reminders = getFollowUpReminders([contact], [staleActivity], [baseCompany])
    expect(reminders).toHaveLength(1)
    expect(reminders[0].contactId).toBe('contact-1')
  })

  it('reminder object has required shape fields', () => {
    const contact = makeContact({ id: 'shape-test', createdAt: daysAgo(30) })
    const [reminder] = getFollowUpReminders([contact], [], [baseCompany])
    expect(reminder).toHaveProperty('contactId')
    expect(reminder).toHaveProperty('contactName')
    expect(reminder).toHaveProperty('daysSinceContact')
    expect(reminder).toHaveProperty('urgency')
    expect(reminder).toHaveProperty('suggestedAction')
    expect(reminder).toHaveProperty('lastActivityDate')
  })

  it('skips churned contacts', () => {
    const churned = makeContact({ status: 'churned', createdAt: daysAgo(60) })
    const reminders = getFollowUpReminders([churned], [], [baseCompany])
    expect(reminders).toHaveLength(0)
  })

  it('assigns correct urgency for critical contact (>60 days)', () => {
    const contact = makeContact({ id: 'critical-1', createdAt: daysAgo(90), updatedAt: daysAgo(90) })
    const reminders = getFollowUpReminders([contact], [], [baseCompany])
    expect(reminders[0].urgency).toBe('critical')
  })

  it('assigns correct urgency for high contact (31-60 days)', () => {
    const contact = makeContact({ id: 'high-1', createdAt: daysAgo(40) })
    const activity = makeActivity({ contactId: 'high-1', createdAt: daysAgo(40) })
    const reminders = getFollowUpReminders([contact], [activity], [baseCompany])
    expect(reminders[0].urgency).toBe('high')
  })

  it('sorts reminders by urgency (critical first)', () => {
    const criticalContact = makeContact({ id: 'c1', createdAt: daysAgo(90) })
    const highContact = makeContact({ id: 'c2', createdAt: daysAgo(35) })
    const highActivity = makeActivity({ contactId: 'c2', createdAt: daysAgo(35) })
    const reminders = getFollowUpReminders(
      [highContact, criticalContact],
      [highActivity],
      [baseCompany]
    )
    expect(reminders[0].urgency).toBe('critical')
    expect(reminders[1].urgency).toBe('high')
  })

  it('includes company name when company exists', () => {
    const contact = makeContact({ companyId: 'company-1', createdAt: daysAgo(30) })
    const [reminder] = getFollowUpReminders([contact], [], [baseCompany])
    expect(reminder.companyName).toBe('Acme Corp')
  })

  it('falls back to empty string when company not found', () => {
    const contact = makeContact({ companyId: 'unknown-company', createdAt: daysAgo(30) })
    const [reminder] = getFollowUpReminders([contact], [], [baseCompany])
    expect(reminder.companyName).toBe('')
  })
})
