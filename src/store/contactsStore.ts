import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Contact, ContactFilters } from '../types'
import { seedContacts } from '../utils/seedData'
import { useAuditStore } from './auditStore'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getOrgId, sbDelete, sbBulkDelete } from '../lib/supabaseHelpers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => supabase as any

// ── Snake / Camel mappers ───────────────────────────────────────────────────

function rowToContact(row: Record<string, unknown>): Contact {
  return {
    id: row.id as string,
    firstName: (row.first_name as string) ?? '',
    lastName: (row.last_name as string) ?? '',
    email: (row.email as string) ?? '',
    phone: (row.phone as string) ?? '',
    jobTitle: (row.job_title as string) ?? '',
    companyId: (row.company_id as string) ?? '',
    status: (row.status as Contact['status']) ?? 'lead',
    source: (row.source as Contact['source']) ?? 'other',
    tags: (row.tags as string[]) ?? [],
    assignedTo: (row.assigned_to as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? '',
    lastContactedAt: (row.last_contacted_at as string) ?? '',
    notes: (row.notes as string) ?? '',
    linkedDeals: (row.linked_deals as string[]) ?? [],
    avatar: (row.avatar as string) ?? undefined,
  }
}

function contactToRow(c: Partial<Contact>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (c.firstName !== undefined) row.first_name = c.firstName
  if (c.lastName !== undefined) row.last_name = c.lastName
  if (c.email !== undefined) row.email = c.email
  if (c.phone !== undefined) row.phone = c.phone
  if (c.jobTitle !== undefined) row.job_title = c.jobTitle
  if (c.companyId !== undefined) row.company_id = c.companyId
  if (c.status !== undefined) row.status = c.status
  if (c.source !== undefined) row.source = c.source
  if (c.tags !== undefined) row.tags = c.tags
  if (c.assignedTo !== undefined) row.assigned_to = c.assignedTo
  if (c.lastContactedAt !== undefined) row.last_contacted_at = c.lastContactedAt
  if (c.notes !== undefined) row.notes = c.notes
  if (c.linkedDeals !== undefined) row.linked_deals = c.linkedDeals
  if (c.avatar !== undefined) row.avatar = c.avatar
  return row
}

// ── State ───────────────────────────────────────────────────────────────────

export interface ContactsState {
  contacts: Contact[]
  filters: ContactFilters
  selectedId: string | null
  isLoading: boolean
  error: string | null

  fetchContacts: () => Promise<void>
  addContact: (contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => Contact
  updateContact: (id: string, updates: Partial<Contact>) => void
  deleteContact: (id: string) => void
  bulkDelete: (ids: string[]) => void
  setFilter: (key: keyof ContactFilters, value: string | string[]) => void
  clearFilters: () => void
  setSelectedId: (id: string | null) => void

  getById: (id: string) => Contact | undefined
  getFilteredContacts: () => Contact[]
}

const defaultFilters: ContactFilters = {
  search: '',
  status: '',
  source: '',
  tags: [],
  assignedTo: '',
  dateFrom: '',
  dateTo: '',
}

export const useContactsStore = create<ContactsState>()(
  (set, get) => ({
    contacts: [],
    filters: defaultFilters,
    selectedId: null,
    isLoading: false,
    error: null,

    fetchContacts: async () => {
      set({ isLoading: true, error: null })
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.from('contacts').select('*').order('created_at', { ascending: false })
          if (error) throw error
          set({ contacts: (data ?? []).map((r) => rowToContact(r as unknown as Record<string, unknown>)), isLoading: false })
        } else {
          set({ contacts: seedContacts, isLoading: false })
        }
      } catch (e: unknown) {
        set({ error: (e as Error).message, isLoading: false })
      }
    },

    addContact: (contactData) => {
      const now = new Date().toISOString()
      const tempId = uuidv4()
      const optimistic: Contact = { ...contactData, id: tempId, createdAt: now, updatedAt: now }
      set((s) => ({ contacts: [optimistic, ...s.contacts] }))
      useAuditStore.getState().logAction('contact_created', 'contact', tempId, contactData.firstName + ' ' + contactData.lastName, 'Contacto creado')

      if (isSupabaseConfigured && supabase) {
        const row = contactToRow(contactData)
        sb().from('contacts').insert({ ...row, organization_id: getOrgId() }).select().single()
          .then(({ data, error }: any) => {
            if (error) {
              set((s) => ({ contacts: s.contacts.filter((c) => c.id !== tempId), error: error.message }))
              return
            }
            const real = rowToContact(data as Record<string, unknown>)
            set((s) => ({ contacts: s.contacts.map((c) => c.id === tempId ? real : c) }))
          })
      }

      return optimistic
    },

    updateContact: (id, updates) => {
      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        ),
      }))
      useAuditStore.getState().logAction('contact_updated', 'contact', id, '', 'Contacto actualizado')

      if (isSupabaseConfigured && supabase) {
        const row = contactToRow(updates)
        sb().from('contacts').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)
      }
    },

    deleteContact: (id) => {
      set((state) => ({ contacts: state.contacts.filter((c) => c.id !== id) }))
      useAuditStore.getState().logAction('contact_deleted', 'contact', id, '', 'Contacto eliminado')

      if (isSupabaseConfigured && supabase) {
        sbDelete('contacts', id)
      }
    },

    bulkDelete: (ids) => {
      const idSet = new Set(ids)
      set((state) => ({ contacts: state.contacts.filter((c) => !idSet.has(c.id)) }))

      if (isSupabaseConfigured && supabase) {
        sbBulkDelete('contacts', ids)
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
      return get().contacts.find((c) => c.id === id)
    },

    getFilteredContacts: () => {
      const { contacts, filters } = get()
      return contacts.filter((c) => {
        const q = filters.search.toLowerCase()
        if (q) {
          const name = `${c.firstName} ${c.lastName}`.toLowerCase()
          const email = c.email.toLowerCase()
          if (!name.includes(q) && !email.includes(q)) return false
        }
        if (filters.status && c.status !== filters.status) return false
        if (filters.source && c.source !== filters.source) return false
        if (filters.assignedTo && c.assignedTo !== filters.assignedTo) return false
        if (filters.tags.length > 0 && !filters.tags.some((t) => c.tags.includes(t))) return false
        if (filters.dateFrom && c.createdAt < filters.dateFrom) return false
        if (filters.dateTo && c.createdAt > filters.dateTo) return false
        return true
      })
    },
  })
)
