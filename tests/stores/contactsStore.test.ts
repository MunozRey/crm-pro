import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useContactsStore } from '../../src/store/contactsStore'

vi.mock('../../src/lib/supabase', () => {
  const mockEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'c-server-1', first_name: 'Ana', last_name: 'García', email: 'ana@test.com',
      phone: '', job_title: '', company_id: '', status: 'prospect', source: 'website',
      assigned_to: 'user-1', tags: [], notes: '', linked_deals: [], last_contacted_at: '',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      organization_id: 'org-1',
    },
    error: null,
  })
  const mockSelectForInsert = vi.fn().mockReturnValue({ single: mockSingle })
  const mockSelectForFetch = vi.fn().mockReturnValue({
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  })
  const mockInsert = vi.fn().mockReturnValue({ select: mockSelectForInsert })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
  const mockFrom = vi.fn().mockImplementation(() => ({
    select: mockSelectForFetch,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  }))
  return {
    isSupabaseConfigured: true,
    supabase: { from: mockFrom },
  }
})

vi.mock('../../src/store/auditStore', () => ({
  useAuditStore: {
    getState: vi.fn().mockReturnValue({ logAction: vi.fn() }),
  },
}))

vi.mock('../../src/lib/supabaseHelpers', () => ({
  getOrgId: vi.fn().mockReturnValue('org-1'),
  sbDelete: vi.fn().mockResolvedValue({ error: null }),
  sbBulkDelete: vi.fn().mockResolvedValue({ error: null }),
}))

const emptyFilters = {
  search: '',
  status: '',
  source: '',
  tags: [] as string[],
  assignedTo: '',
  dateFrom: '',
  dateTo: '',
}

const sampleContact = {
  id: 'c-1',
  firstName: 'Ana',
  lastName: 'García',
  email: 'ana@test.com',
  phone: '',
  jobTitle: '',
  companyId: '',
  status: 'prospect' as const,
  source: 'website' as const,
  assignedTo: 'user-1',
  tags: [],
  notes: '',
  linkedDeals: [],
  lastContactedAt: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

beforeEach(() => {
  useContactsStore.setState({
    contacts: [],
    filters: emptyFilters,
    selectedId: null,
    isLoading: false,
    error: null,
  })
})

describe('contactsStore', () => {
  describe('addContact', () => {
    it('optimistically adds a contact to the array', () => {
      const { addContact } = useContactsStore.getState()
      const { id: _id, createdAt: _c, updatedAt: _u, ...contactData } = sampleContact
      addContact(contactData)
      const { contacts } = useContactsStore.getState()
      expect(contacts).toHaveLength(1)
      expect(contacts[0].firstName).toBe('Ana')
    })
  })

  describe('updateContact', () => {
    it('updates the matching contact in place', () => {
      useContactsStore.setState({ contacts: [sampleContact] })
      useContactsStore.getState().updateContact('c-1', { firstName: 'Updated' })
      const { contacts } = useContactsStore.getState()
      expect(contacts[0].firstName).toBe('Updated')
    })
  })

  describe('deleteContact', () => {
    it('removes the contact from the array', () => {
      useContactsStore.setState({ contacts: [sampleContact] })
      useContactsStore.getState().deleteContact('c-1')
      expect(useContactsStore.getState().contacts).toHaveLength(0)
    })
  })

  describe('getFilteredContacts', () => {
    it('filters by status', () => {
      const c1 = { ...sampleContact, id: 'c-1', status: 'prospect' as const }
      const c2 = { ...sampleContact, id: 'c-2', status: 'customer' as const }
      const c3 = { ...sampleContact, id: 'c-3', status: 'churned' as const }
      useContactsStore.setState({
        contacts: [c1, c2, c3],
        filters: { ...emptyFilters, status: 'prospect' },
      })
      const result = useContactsStore.getState().getFilteredContacts()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('c-1')
    })

    it('filters by search term on name', () => {
      const c1 = { ...sampleContact, id: 'c-1', firstName: 'Ana', lastName: 'García', email: 'ana@test.com' }
      const c2 = { ...sampleContact, id: 'c-2', firstName: 'Carlos', lastName: 'López', email: 'carlos@test.com' }
      useContactsStore.setState({
        contacts: [c1, c2],
        filters: { ...emptyFilters, search: 'Ana' },
      })
      const result = useContactsStore.getState().getFilteredContacts()
      expect(result).toHaveLength(1)
      expect(result[0].firstName).toBe('Ana')
    })
  })
})
