import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { CustomFieldDefinition, CustomFieldEntityType, CustomFieldValue } from '../types'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getOrgId } from '../lib/supabaseHelpers'

// ─── Seed Definitions ────────────────────────────────────────────────────────

const _now = new Date().toISOString()

const SEED_DEFINITIONS: CustomFieldDefinition[] = [
  { id: 'cf-c-01', entityType: 'contact', label: 'LinkedIn URL', fieldType: 'url', placeholder: 'https://linkedin.com/in/...', required: false, order: 1, isActive: true, createdAt: _now, updatedAt: _now },
  { id: 'cf-c-02', entityType: 'contact', label: 'Departamento', fieldType: 'select', options: ['Ventas', 'Marketing', 'Tecnología', 'Finanzas', 'RRHH', 'Dirección', 'Operaciones', 'Otro'], required: false, order: 2, isActive: true, createdAt: _now, updatedAt: _now },
  { id: 'cf-c-03', entityType: 'contact', label: 'NIF / CIF', fieldType: 'text', placeholder: 'B12345678', required: false, order: 3, isActive: true, createdAt: _now, updatedAt: _now },
  { id: 'cf-c-04', entityType: 'contact', label: 'Fecha de cumpleaños', fieldType: 'date', required: false, order: 4, isActive: true, createdAt: _now, updatedAt: _now },
  { id: 'cf-e-01', entityType: 'company', label: 'Año de fundación', fieldType: 'number', placeholder: '2020', required: false, order: 1, isActive: true, createdAt: _now, updatedAt: _now },
  { id: 'cf-e-02', entityType: 'company', label: 'Tecnologías', fieldType: 'multiselect', options: ['React', 'Angular', 'Vue', 'Node.js', 'Python', 'Java', '.NET', 'AWS', 'Azure', 'GCP', 'Kubernetes'], required: false, order: 2, isActive: true, createdAt: _now, updatedAt: _now },
  { id: 'cf-e-03', entityType: 'company', label: 'Página LinkedIn', fieldType: 'url', placeholder: 'https://linkedin.com/company/...', required: false, order: 3, isActive: true, createdAt: _now, updatedAt: _now },
  { id: 'cf-d-01', entityType: 'deal', label: 'Competidor principal', fieldType: 'text', placeholder: 'Nombre del competidor', required: false, order: 1, isActive: true, createdAt: _now, updatedAt: _now },
  { id: 'cf-d-02', entityType: 'deal', label: 'Tipo de proyecto', fieldType: 'select', options: ['Nuevo', 'Migración', 'Ampliación', 'Renovación', 'Consultoría'], required: false, order: 2, isActive: true, createdAt: _now, updatedAt: _now },
  { id: 'cf-d-03', entityType: 'deal', label: 'Requiere aprobación legal', fieldType: 'checkbox', required: false, order: 3, isActive: true, createdAt: _now, updatedAt: _now },
  { id: 'cf-d-04', entityType: 'deal', label: 'Presupuesto aprobado', fieldType: 'currency', placeholder: '0.00', required: false, order: 4, isActive: true, createdAt: _now, updatedAt: _now },
]

// ─── Store ───────────────────────────────────────────────────────────────────

interface CustomFieldsStore {
  definitions: CustomFieldDefinition[]
  values: Record<string, CustomFieldValue[]>
  isLoading: boolean
  error: string | null
  fetchCustomFields: () => Promise<void>
  addDefinition: (def: Omit<CustomFieldDefinition, 'id' | 'order' | 'createdAt' | 'updatedAt'>) => void
  updateDefinition: (id: string, updates: Partial<CustomFieldDefinition>) => void
  deleteDefinition: (id: string) => void
  reorderDefinitions: (entityType: CustomFieldEntityType, orderedIds: string[]) => void
  setFieldValue: (entityId: string, fieldId: string, value: CustomFieldValue['value']) => void
  getFieldValues: (entityId: string) => CustomFieldValue[]
  getFieldValue: (entityId: string, fieldId: string) => CustomFieldValue['value']
  deleteEntityValues: (entityId: string) => void
  getDefinitionsForEntity: (entityType: CustomFieldEntityType) => CustomFieldDefinition[]
  getActiveDefinitionsForEntity: (entityType: CustomFieldEntityType) => CustomFieldDefinition[]
}

export const useCustomFieldsStore = create<CustomFieldsStore>()((set, get) => ({
  definitions: SEED_DEFINITIONS,
  values: {},
  isLoading: false,
  error: null,

  fetchCustomFields: async () => {
    if (!isSupabaseConfigured || !supabase) {
      set({ definitions: SEED_DEFINITIONS, values: {} })
      return
    }
    set({ isLoading: true, error: null })
    try {
      const [defRes, valRes] = await Promise.all([
        (supabase as any).from('custom_field_definitions').select('*').order('order', { ascending: true }),
        (supabase as any).from('custom_field_values').select('*'),
      ])
      if (defRes.error) throw defRes.error
      if (valRes.error) throw valRes.error

      const definitions: CustomFieldDefinition[] = (defRes.data ?? []).map((r: any) => ({
        id: r.id, entityType: r.entity_type, label: r.label, fieldType: r.field_type,
        placeholder: r.placeholder, required: r.required, order: r.order,
        isActive: r.is_active, options: r.options, createdAt: r.created_at, updatedAt: r.updated_at,
      }))

      const values: Record<string, CustomFieldValue[]> = {}
      for (const r of (valRes.data ?? [])) {
        if (!values[r.entity_id]) values[r.entity_id] = []
        values[r.entity_id].push({ fieldId: r.field_id, value: r.value })
      }

      set({ definitions: definitions.length > 0 ? definitions : SEED_DEFINITIONS, values, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  addDefinition: (defData) => {
    const ts = new Date().toISOString()
    const existing = get().definitions.filter((d) => d.entityType === defData.entityType)
    const def: CustomFieldDefinition = { ...defData, id: uuidv4(), order: existing.length + 1, createdAt: ts, updatedAt: ts }
    set((s) => ({ definitions: [...s.definitions, def] }))
    if (isSupabaseConfigured && supabase) {
      ;(supabase as any).from('custom_field_definitions').insert({
        id: def.id, entity_type: def.entityType, label: def.label, field_type: def.fieldType,
        placeholder: def.placeholder, required: def.required, order: def.order,
        is_active: def.isActive, options: def.options, organization_id: getOrgId(),
      }).then(({ error }: any) => { if (error) console.error('[customFieldsStore] def insert error', error) })
    }
  },

  updateDefinition: (id, updates) => {
    set((s) => ({
      definitions: s.definitions.map((d) => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d),
    }))
    if (isSupabaseConfigured && supabase) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (updates.label !== undefined) row.label = updates.label
      if (updates.fieldType !== undefined) row.field_type = updates.fieldType
      if (updates.placeholder !== undefined) row.placeholder = updates.placeholder
      if (updates.required !== undefined) row.required = updates.required
      if (updates.isActive !== undefined) row.is_active = updates.isActive
      if (updates.options !== undefined) row.options = updates.options
      if (updates.order !== undefined) row.order = updates.order
      ;(supabase as any).from('custom_field_definitions').update(row).eq('id', id)
        .then(({ error }: any) => { if (error) console.error('[customFieldsStore] def update error', error) })
    }
  },

  deleteDefinition: (id) => {
    set((s) => {
      const newValues = { ...s.values }
      for (const entityId of Object.keys(newValues)) {
        newValues[entityId] = newValues[entityId].filter((v) => v.fieldId !== id)
      }
      return { definitions: s.definitions.filter((d) => d.id !== id), values: newValues }
    })
    if (isSupabaseConfigured && supabase) {
      ;(supabase as any).from('custom_field_definitions').delete().eq('id', id)
        .then(({ error }: any) => { if (error) console.error('[customFieldsStore] def delete error', error) })
    }
  },

  reorderDefinitions: (entityType, orderedIds) => {
    set((s) => ({
      definitions: s.definitions.map((d) => {
        if (d.entityType !== entityType) return d
        const idx = orderedIds.indexOf(d.id)
        return idx >= 0 ? { ...d, order: idx + 1 } : d
      }),
    }))
    if (isSupabaseConfigured && supabase) {
      orderedIds.forEach((id, idx) => {
        ;(supabase as any).from('custom_field_definitions').update({ order: idx + 1 }).eq('id', id)
          .then(({ error }: any) => { if (error) console.error('[customFieldsStore] reorder error', error) })
      })
    }
  },

  setFieldValue: (entityId, fieldId, value) => {
    set((s) => {
      const existing = s.values[entityId] || []
      const idx = existing.findIndex((v) => v.fieldId === fieldId)
      const updated = idx >= 0
        ? existing.map((v, i) => (i === idx ? { fieldId, value } : v))
        : [...existing, { fieldId, value }]
      return { values: { ...s.values, [entityId]: updated } }
    })
    if (isSupabaseConfigured && supabase) {
      ;(supabase as any).from('custom_field_values').upsert(
        { entity_id: entityId, field_id: fieldId, value, organization_id: getOrgId() },
        { onConflict: 'entity_id,field_id' }
      ).then(({ error }: any) => { if (error) console.error('[customFieldsStore] value upsert error', error) })
    }
  },

  getFieldValues: (entityId) => get().values[entityId] || [],

  getFieldValue: (entityId, fieldId) => {
    const vals = get().values[entityId] || []
    return vals.find((v) => v.fieldId === fieldId)?.value ?? null
  },

  deleteEntityValues: (entityId) => {
    set((s) => {
      const newValues = { ...s.values }
      delete newValues[entityId]
      return { values: newValues }
    })
    if (isSupabaseConfigured && supabase) {
      ;(supabase as any).from('custom_field_values').delete().eq('entity_id', entityId)
        .then(({ error }: any) => { if (error) console.error('[customFieldsStore] deleteEntityValues error', error) })
    }
  },

  getDefinitionsForEntity: (entityType) =>
    get().definitions.filter((d) => d.entityType === entityType).sort((a, b) => a.order - b.order),

  getActiveDefinitionsForEntity: (entityType) =>
    get().definitions.filter((d) => d.entityType === entityType && d.isActive).sort((a, b) => a.order - b.order),
}))
