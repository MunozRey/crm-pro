import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDealsStore } from '../../src/store/dealsStore'

vi.mock('../../src/lib/supabase', () => {
  const mockEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'd-server-1', title: 'Big Contract', value: 5000, currency: 'EUR', stage: 'lead',
      probability: 20, expected_close_date: '2026-06-01', contact_id: '', company_id: '',
      assigned_to: 'user-1', priority: 'medium', source: '', notes: '', activities: [],
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
  const mockUpdate = vi.fn().mockReturnValue({
    eq: mockEq,
    then: vi.fn().mockResolvedValue({ data: null, error: null }),
  })
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

vi.mock('../../src/store/notificationsStore', () => ({
  useNotificationsStore: {
    getState: vi.fn().mockReturnValue({ notify: vi.fn() }),
  },
}))

vi.mock('../../src/store/automationsStore', () => ({
  useAutomationsStore: {
    getState: vi.fn().mockReturnValue({ triggerAutomation: vi.fn(), executeRulesForTrigger: vi.fn() }),
  },
}))

vi.mock('../../src/lib/supabaseHelpers', () => ({
  getOrgId: vi.fn().mockReturnValue('org-1'),
  sbDelete: vi.fn().mockResolvedValue({ error: null }),
}))

const emptyFilters = {
  search: '',
  stage: '',
  assignedTo: '',
  priority: '',
  valueMin: '',
  valueMax: '',
  dueDateFrom: '',
  dueDateTo: '',
}

const sampleDeal = {
  id: 'd-1',
  title: 'Big Contract',
  value: 5000,
  currency: 'EUR' as const,
  stage: 'lead' as const,
  probability: 20,
  expectedCloseDate: '2026-06-01',
  contactId: '',
  companyId: '',
  assignedTo: 'user-1',
  priority: 'medium' as const,
  source: '',
  notes: '',
  activities: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

beforeEach(() => {
  useDealsStore.setState({
    deals: [],
    filters: emptyFilters,
    selectedId: null,
    isLoading: false,
    error: null,
    viewMode: 'kanban',
  })
})

describe('dealsStore', () => {
  describe('addDeal', () => {
    it('optimistically adds a deal to the array', () => {
      const { addDeal } = useDealsStore.getState()
      const { id: _id, createdAt: _c, updatedAt: _u, ...dealData } = sampleDeal
      addDeal(dealData)
      const { deals } = useDealsStore.getState()
      expect(deals).toHaveLength(1)
      expect(deals[0].title).toBe('Big Contract')
    })
  })

  describe('updateDeal', () => {
    it('updates the matching deal in place', () => {
      useDealsStore.setState({ deals: [sampleDeal] })
      useDealsStore.getState().updateDeal('d-1', { title: 'Renamed' })
      const { deals } = useDealsStore.getState()
      expect(deals[0].title).toBe('Renamed')
    })
  })

  describe('moveDeal', () => {
    it('moves the deal to the new stage', () => {
      useDealsStore.setState({ deals: [sampleDeal] })
      useDealsStore.getState().moveDeal('d-1', 'qualified')
      const { deals } = useDealsStore.getState()
      expect(deals[0].stage).toBe('qualified')
    })
  })

  describe('getFilteredDeals', () => {
    it('filters by stage', () => {
      const d1 = { ...sampleDeal, id: 'd-1', stage: 'lead' as const }
      const d2 = { ...sampleDeal, id: 'd-2', stage: 'qualified' as const }
      useDealsStore.setState({
        deals: [d1, d2],
        filters: { ...emptyFilters, stage: 'lead' },
      })
      const result = useDealsStore.getState().getFilteredDeals()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('d-1')
    })

    it('filters by search term on title', () => {
      const d1 = { ...sampleDeal, id: 'd-1', title: 'Big Contract' }
      const d2 = { ...sampleDeal, id: 'd-2', title: 'Small Project' }
      useDealsStore.setState({
        deals: [d1, d2],
        filters: { ...emptyFilters, search: 'Big' },
      })
      const result = useDealsStore.getState().getFilteredDeals()
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Big Contract')
    })
  })
})
