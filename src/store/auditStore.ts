import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { AuditAction, AuditEntry } from '../types'
import { useAuthStore } from './authStore'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getOrgId } from '../lib/supabaseHelpers'

const MAX_ENTRIES = 500

interface AuditStore {
  entries: AuditEntry[]
  isLoading: boolean
  error: string | null
  fetchEntries: () => Promise<void>
  logAction: (
    action: AuditAction,
    entityType: AuditEntry['entityType'],
    entityId: string,
    entityName: string,
    details: string
  ) => void
  getByEntity: (entityType: AuditEntry['entityType'], entityId: string) => AuditEntry[]
  getRecent: (limit: number) => AuditEntry[]
  clear: () => void
}

export const useAuditStore = create<AuditStore>()((set, get) => ({
  entries: [],
  isLoading: false,
  error: null,

  fetchEntries: async () => {
    if (!isSupabaseConfigured || !supabase) return
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await (supabase as any)
        .from('audit_log').select('*').order('created_at', { ascending: false }).limit(MAX_ENTRIES)
      if (error) throw error
      const entries: AuditEntry[] = (data ?? []).map((r: any) => ({
        id: r.id, action: r.action, entityType: r.entity_type,
        entityId: r.entity_id, entityName: r.entity_name,
        details: r.details, userId: r.user_id,
        timestamp: r.created_at,
      }))
      set({ entries, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  logAction: (action, entityType, entityId, entityName, details) => {
    const entry: AuditEntry = {
      id: uuidv4(), action, entityType, entityId, entityName, details,
      userId: useAuthStore.getState().currentUser?.name || 'Sistema',
      timestamp: new Date().toISOString(),
    }
    set((s) => {
      const updated = [entry, ...s.entries]
      return { entries: updated.slice(0, MAX_ENTRIES) }
    })
    if (isSupabaseConfigured && supabase) {
      ;(supabase as any).from('audit_log').insert({
        id: entry.id, action: entry.action, entity_type: entry.entityType,
        entity_id: entry.entityId, entity_name: entry.entityName,
        details: entry.details, user_id: entry.userId,
        organization_id: getOrgId(),
      }).then(({ error }: any) => { if (error) console.error('[auditStore] insert error', error) })
    }
  },

  getByEntity: (entityType, entityId) =>
    get().entries.filter((e) => e.entityType === entityType && e.entityId === entityId),

  getRecent: (limit) => get().entries.slice(0, limit),

  clear: () => { set({ entries: [] }) },
}))
