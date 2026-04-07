import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Company, CompanyFilters } from '../types'
import { seedCompanies } from '../utils/seedData'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getOrgId, sbDelete } from '../lib/supabaseHelpers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => supabase as any

function rowToCompany(row: Record<string, unknown>): Company {
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    domain: (row.domain as string) ?? '',
    industry: (row.industry as Company['industry']) ?? 'other',
    size: (row.size as string) ?? '',
    country: (row.country as string) ?? '',
    city: (row.city as string) ?? '',
    website: (row.website as string) ?? '',
    phone: (row.phone as string) ?? '',
    status: (row.status as Company['status']) ?? 'prospect',
    revenue: (row.revenue as number) ?? undefined,
    contacts: (row.contacts as string[]) ?? [],
    deals: (row.deals as string[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    notes: (row.notes as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? '',
  }
}

function companyToRow(c: Partial<Company>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (c.name !== undefined) row.name = c.name
  if (c.domain !== undefined) row.domain = c.domain
  if (c.industry !== undefined) row.industry = c.industry
  if (c.size !== undefined) row.size = c.size
  if (c.country !== undefined) row.country = c.country
  if (c.city !== undefined) row.city = c.city
  if (c.website !== undefined) row.website = c.website
  if (c.phone !== undefined) row.phone = c.phone
  if (c.status !== undefined) row.status = c.status
  if (c.revenue !== undefined) row.revenue = c.revenue
  if (c.contacts !== undefined) row.contacts = c.contacts
  if (c.deals !== undefined) row.deals = c.deals
  if (c.tags !== undefined) row.tags = c.tags
  if (c.notes !== undefined) row.notes = c.notes
  return row
}

export interface CompaniesState {
  companies: Company[]
  filters: CompanyFilters
  selectedId: string | null
  isLoading: boolean
  error: string | null

  fetchCompanies: () => Promise<void>
  addCompany: (company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) => Company
  updateCompany: (id: string, updates: Partial<Company>) => void
  deleteCompany: (id: string) => void
  setFilter: (key: keyof CompanyFilters, value: string) => void
  clearFilters: () => void
  setSelectedId: (id: string | null) => void

  getById: (id: string) => Company | undefined
  getFilteredCompanies: () => Company[]
}

const defaultFilters: CompanyFilters = {
  search: '',
  industry: '',
  size: '',
  status: '',
  country: '',
}

export const useCompaniesStore = create<CompaniesState>()(
  (set, get) => ({
    companies: [],
    filters: defaultFilters,
    selectedId: null,
    isLoading: false,
    error: null,

    fetchCompanies: async () => {
      set({ isLoading: true, error: null })
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.from('companies').select('*').order('created_at', { ascending: false })
          if (error) throw error
          set({ companies: (data ?? []).map((r) => rowToCompany(r as unknown as Record<string, unknown>)), isLoading: false })
        } else {
          set({ companies: seedCompanies, isLoading: false })
        }
      } catch (e: unknown) {
        set({ error: (e as Error).message, isLoading: false })
      }
    },

    addCompany: (companyData) => {
      const now = new Date().toISOString()
      const id = uuidv4()
      const company: Company = { ...companyData, id, createdAt: now, updatedAt: now }
      set((state) => ({ companies: [company, ...state.companies] }))

      if (isSupabaseConfigured && supabase) {
        const row = companyToRow(companyData)
        sb().from('companies').insert({ ...row, organization_id: getOrgId() }).select().single()
          .then(({ data, error }: any) => {
            if (error) {
              set((s) => ({ companies: s.companies.filter((c) => c.id !== id), error: error.message }))
              return
            }
            const real = rowToCompany(data as Record<string, unknown>)
            set((s) => ({ companies: s.companies.map((c) => c.id === id ? real : c) }))
          })
      }

      return company
    },

    updateCompany: (id, updates) => {
      set((state) => ({
        companies: state.companies.map((c) =>
          c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        ),
      }))

      if (isSupabaseConfigured && supabase) {
        const row = companyToRow(updates)
        sb().from('companies').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)
      }
    },

    deleteCompany: (id) => {
      set((state) => ({ companies: state.companies.filter((c) => c.id !== id) }))

      if (isSupabaseConfigured && supabase) {
        sbDelete('companies', id)
      }
    },

    setFilter: (key, value) => {
      set((state) => ({ filters: { ...state.filters, [key]: value } }))
    },

    clearFilters: () => {
      set({ filters: defaultFilters })
    },

    setSelectedId: (id) => {
      set({ selectedId: id })
    },

    getById: (id) => {
      return get().companies.find((c) => c.id === id)
    },

    getFilteredCompanies: () => {
      const { companies, filters } = get()
      return companies.filter((c) => {
        const q = filters.search.toLowerCase()
        if (q && !c.name.toLowerCase().includes(q) && !c.domain.toLowerCase().includes(q)) return false
        if (filters.industry && c.industry !== filters.industry) return false
        if (filters.size && c.size !== filters.size) return false
        if (filters.status && c.status !== filters.status) return false
        if (filters.country && !c.country.toLowerCase().includes(filters.country.toLowerCase())) return false
        return true
      })
    },
  })
)
