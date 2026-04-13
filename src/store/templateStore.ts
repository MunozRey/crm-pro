import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { EmailTemplate } from '../types'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getOrgId, sbDelete } from '../lib/supabaseHelpers'
import { useAuthStore } from './authStore'

interface TemplateStore {
  templates: EmailTemplate[]
  quickReplies: Array<{ id: string; title: string; body: string; createdAt: string; updatedAt: string }>
  isLoading: boolean
  error: string | null
  fetchTemplates: () => Promise<void>
  fetchQuickReplies: () => Promise<void>
  addTemplate: (template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => EmailTemplate
  updateTemplate: (id: string, updates: Partial<EmailTemplate>) => void
  deleteTemplate: (id: string) => void
  addQuickReply: (input: { title: string; body: string }) => void
  updateQuickReply: (id: string, updates: { title?: string; body?: string }) => void
  deleteQuickReply: (id: string) => void
  incrementUsage: (id: string) => void
  getByCategory: (category: EmailTemplate['category']) => EmailTemplate[]
}

const seedTemplates: EmailTemplate[] = [
  { id: 'tpl-001', name: 'Primer contacto', subject: 'Encantado de conectar, {{firstName}}', body: 'Hola {{firstName}},\n\nMi nombre es David Muñoz. Me gustaría explorar si podríamos colaborar.\n\nUn saludo,\nDavid Muñoz', category: 'intro', variables: ['{{firstName}}', '{{company}}'], createdAt: '2025-01-15T10:00:00Z', updatedAt: '2025-01-15T10:00:00Z', usageCount: 24 },
  { id: 'tpl-002', name: 'Seguimiento reunión', subject: 'Resumen de nuestra reunión - {{dealTitle}}', body: 'Hola {{firstName}},\n\nGracias por tu tiempo. Te enviaré la propuesta en los próximos días.\n\nUn saludo,\nDavid Muñoz', category: 'follow_up', variables: ['{{firstName}}', '{{company}}', '{{dealTitle}}'], createdAt: '2025-01-20T10:00:00Z', updatedAt: '2025-01-20T10:00:00Z', usageCount: 18 },
  { id: 'tpl-003', name: 'Envío de propuesta', subject: 'Propuesta comercial - {{dealTitle}}', body: 'Hola {{firstName}},\n\nAdjunto encontrarás la propuesta comercial para {{dealTitle}}.\n\nUn saludo,\nDavid Muñoz', category: 'proposal', variables: ['{{firstName}}', '{{company}}', '{{dealTitle}}', '{{dealValue}}'], createdAt: '2025-02-01T10:00:00Z', updatedAt: '2025-02-01T10:00:00Z', usageCount: 12 },
  { id: 'tpl-004', name: 'Cierre de deal', subject: 'Siguientes pasos para cerrar {{dealTitle}}', body: 'Hola {{firstName}},\n\nQuería hacer seguimiento sobre la propuesta de {{dealTitle}}.\n\nUn saludo,\nDavid Muñoz', category: 'closing', variables: ['{{firstName}}', '{{company}}', '{{dealTitle}}'], createdAt: '2025-02-10T10:00:00Z', updatedAt: '2025-02-10T10:00:00Z', usageCount: 8 },
  { id: 'tpl-005', name: 'Nurturing - Contenido de valor', subject: '{{firstName}}, un recurso que puede interesarte', body: 'Hola {{firstName}},\n\nHemos publicado un estudio relevante para {{company}}.\n\nUn saludo,\nDavid Muñoz', category: 'nurture', variables: ['{{firstName}}', '{{company}}'], createdAt: '2025-02-15T10:00:00Z', updatedAt: '2025-02-15T10:00:00Z', usageCount: 15 },
]

export const useTemplateStore = create<TemplateStore>()((set, get) => ({
  templates: seedTemplates,
  quickReplies: [
    {
      id: 'qr-1',
      title: 'Quick follow-up',
      body: 'Hi {{firstName}},\n\nJust checking in on this.\n\nBest regards,',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
    {
      id: 'qr-2',
      title: 'Meeting summary',
      body: 'Thanks for your time today.\n\nAs discussed, here are the next steps:\n1) \n2) \n3) \n\nBest,',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
  ],
  isLoading: false,
  error: null,

  fetchTemplates: async () => {
    if (!isSupabaseConfigured || !supabase) {
      set({ templates: seedTemplates })
      return
    }
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await (supabase as any).from('email_templates').select('*').order('created_at', { ascending: false })
      if (error) throw error
      const templates: EmailTemplate[] = (data ?? []).map((r: any) => ({
        id: r.id, name: r.name, subject: r.subject, body: r.body,
        category: r.category, variables: r.variables ?? [],
        createdAt: r.created_at, updatedAt: r.updated_at, usageCount: r.usage_count ?? 0,
      }))
      set({ templates: templates.length > 0 ? templates : seedTemplates, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  fetchQuickReplies: async () => {
    if (!isSupabaseConfigured || !supabase) return
    try {
      const { data, error } = await (supabase as any)
        .from('quick_replies')
        .select('id,title,body,created_at,updated_at')
        .order('updated_at', { ascending: false })
      if (error) throw error
      set({
        quickReplies: (data ?? []).map((row: any) => ({
          id: row.id,
          title: row.title,
          body: row.body,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      })
    } catch {
      // Keep local fallback replies.
    }
  },

  addTemplate: (template) => {
    const ts = new Date().toISOString()
    const newTemplate: EmailTemplate = { ...template, id: uuidv4(), createdAt: ts, updatedAt: ts, usageCount: 0 }
    set((s) => ({ templates: [...s.templates, newTemplate] }))
    if (isSupabaseConfigured && supabase) {
      ;(supabase as any).from('email_templates').insert({
        id: newTemplate.id, name: newTemplate.name, subject: newTemplate.subject,
        body: newTemplate.body, category: newTemplate.category, variables: newTemplate.variables,
        usage_count: 0, organization_id: getOrgId(),
      }).then(({ error }: any) => { if (error) console.error('[templateStore] insert error', error) })
    }
    return newTemplate
  },

  updateTemplate: (id, updates) => {
    set((s) => ({
      templates: s.templates.map((t) => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t),
    }))
    if (isSupabaseConfigured && supabase) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (updates.name !== undefined) row.name = updates.name
      if (updates.subject !== undefined) row.subject = updates.subject
      if (updates.body !== undefined) row.body = updates.body
      if (updates.category !== undefined) row.category = updates.category
      if (updates.variables !== undefined) row.variables = updates.variables
      ;(supabase as any).from('email_templates').update(row).eq('id', id)
        .then(({ error }: any) => { if (error) console.error('[templateStore] update error', error) })
    }
  },

  deleteTemplate: (id) => {
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }))
    if (isSupabaseConfigured && supabase) {
      sbDelete('email_templates', id).catch((e) => console.error('[templateStore] delete error', e))
    }
  },

  addQuickReply: (input) => {
    const ts = new Date().toISOString()
    const item = { id: uuidv4(), title: input.title.trim(), body: input.body, createdAt: ts, updatedAt: ts }
    set((s) => ({ quickReplies: [item, ...s.quickReplies] }))
    if (isSupabaseConfigured && supabase) {
      const currentUserId = useAuthStore.getState().currentUser?.id
      if (!currentUserId) return
      ;(supabase as any).from('quick_replies').insert({
        id: item.id,
        user_id: currentUserId,
        title: item.title,
        body: item.body,
        organization_id: getOrgId(),
      })
    }
  },

  updateQuickReply: (id, updates) => {
    const updatedAt = new Date().toISOString()
    set((s) => ({
      quickReplies: s.quickReplies.map((reply) => (
        reply.id === id
          ? {
              ...reply,
              title: updates.title?.trim() ?? reply.title,
              body: updates.body ?? reply.body,
              updatedAt,
            }
          : reply
      )),
    }))
    if (isSupabaseConfigured && supabase) {
      const patch: Record<string, unknown> = { updated_at: updatedAt }
      if (updates.title !== undefined) patch.title = updates.title.trim()
      if (updates.body !== undefined) patch.body = updates.body
      ;(supabase as any).from('quick_replies').update(patch).eq('id', id)
    }
  },

  deleteQuickReply: (id) => {
    set((s) => ({ quickReplies: s.quickReplies.filter((reply) => reply.id !== id) }))
    if (isSupabaseConfigured && supabase) {
      ;(supabase as any).from('quick_replies').delete().eq('id', id)
    }
  },

  incrementUsage: (id) => {
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === id ? { ...t, usageCount: t.usageCount + 1, updatedAt: new Date().toISOString() } : t
      ),
    }))
    if (isSupabaseConfigured && supabase) {
      const t = get().templates.find((x) => x.id === id)
      if (t) {
        ;(supabase as any).from('email_templates').update({ usage_count: t.usageCount }).eq('id', id)
          .then(({ error }: any) => { if (error) console.error('[templateStore] usage error', error) })
      }
    }
  },

  getByCategory: (category) => get().templates.filter((t) => t.category === category),
}))
