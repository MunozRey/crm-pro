import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { EmailSequence, SequenceEnrollment, EnrollmentStatus } from '../types'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getOrgId, sbDelete } from '../lib/supabaseHelpers'

// ─── Seed data ───────────────────────────────────────────────────────────────

const seedSequences: EmailSequence[] = [
  {
    id: 'seq-001',
    name: 'Outreach Inicial',
    description: 'Secuencia de prospección para nuevos leads.',
    steps: [
      { id: 'step-001-1', order: 0, type: 'email', delayDays: 0, subject: 'Encantado de conectar, {{firstName}}', bodyTemplate: 'Hola {{firstName}},\n\nMe gustaría explorar si podemos colaborar.\n\nUn saludo,\nDavid' },
      { id: 'step-001-2', order: 1, type: 'email', delayDays: 3, subject: 'Seguimiento — {{firstName}}', bodyTemplate: 'Hola {{firstName}},\n\nSolo quería hacer seguimiento.\n\nUn saludo,\nDavid' },
      { id: 'step-001-3', order: 2, type: 'call_task', delayDays: 7, taskDescription: 'Llamar al contacto para agendar una demo.' },
    ],
    createdBy: 'u1', createdAt: '2025-01-10T09:00:00Z', isActive: true, enrolledCount: 0,
  },
  {
    id: 'seq-002',
    name: 'Re-engagement',
    description: 'Recuperar contactos que llevan más de 60 días sin responder.',
    steps: [
      { id: 'step-002-1', order: 0, type: 'email', delayDays: 0, subject: '¿Sigues interesado, {{firstName}}?', bodyTemplate: 'Hola {{firstName}},\n\nQuería retomar el contacto.\n\nUn saludo,\nDavid' },
      { id: 'step-002-2', order: 1, type: 'email', delayDays: 5, subject: 'Último intento, {{firstName}}', bodyTemplate: 'Hola {{firstName}},\n\nEste será mi último email.\n\n¡Mucho éxito!\nDavid' },
    ],
    createdBy: 'u1', createdAt: '2025-01-15T09:00:00Z', isActive: true, enrolledCount: 0,
  },
]

// ─── Store interface ─────────────────────────────────────────────────────────

export interface SequencesStore {
  sequences: EmailSequence[]
  enrollments: SequenceEnrollment[]
  isLoading: boolean
  error: string | null
  fetchSequences: () => Promise<void>
  createSequence: (data: Omit<EmailSequence, 'id' | 'createdAt' | 'enrolledCount'>) => EmailSequence
  updateSequence: (id: string, updates: Partial<EmailSequence>) => void
  deleteSequence: (id: string) => void
  enrollContact: (sequenceId: string, contactId: string, contactName: string) => SequenceEnrollment
  pauseEnrollment: (enrollmentId: string) => void
  resumeEnrollment: (enrollmentId: string) => void
  completeEnrollment: (enrollmentId: string) => void
  unenrollContact: (enrollmentId: string) => void
  getEnrollmentsForContact: (contactId: string) => SequenceEnrollment[]
  getEnrollmentsForSequence: (sequenceId: string) => SequenceEnrollment[]
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useSequencesStore = create<SequencesStore>()((set, get) => ({
  sequences: seedSequences,
  enrollments: [],
  isLoading: false,
  error: null,

  fetchSequences: async () => {
    if (!isSupabaseConfigured || !supabase) {
      set({ sequences: seedSequences, enrollments: [] })
      return
    }
    set({ isLoading: true, error: null })
    try {
      const [seqRes, enrRes] = await Promise.all([
        (supabase as any).from('email_sequences').select('*').order('created_at', { ascending: false }),
        (supabase as any).from('sequence_enrollments').select('*').order('enrolled_at', { ascending: false }),
      ])
      if (seqRes.error) throw seqRes.error
      if (enrRes.error) throw enrRes.error
      const sequences: EmailSequence[] = (seqRes.data ?? []).map((r: any) => ({
        id: r.id, name: r.name, description: r.description,
        steps: r.steps ?? [], createdBy: r.created_by, createdAt: r.created_at,
        isActive: r.is_active, enrolledCount: r.enrolled_count ?? 0,
      }))
      const enrollments: SequenceEnrollment[] = (enrRes.data ?? []).map((r: any) => ({
        id: r.id, sequenceId: r.sequence_id, contactId: r.contact_id,
        contactName: r.contact_name, currentStep: r.current_step, status: r.status,
        enrolledAt: r.enrolled_at, nextStepAt: r.next_step_at, completedAt: r.completed_at,
      }))
      set({ sequences, enrollments, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  createSequence: (data) => {
    const now = new Date().toISOString()
    const newSeq: EmailSequence = { ...data, id: uuidv4(), createdAt: now, enrolledCount: 0 }
    set((s) => ({ sequences: [...s.sequences, newSeq] }))
    if (isSupabaseConfigured && supabase) {
      ;(supabase as any).from('email_sequences').insert({
        id: newSeq.id, name: newSeq.name, description: newSeq.description,
        steps: newSeq.steps, created_by: newSeq.createdBy, is_active: newSeq.isActive,
        enrolled_count: 0, organization_id: getOrgId(),
      }).then(({ error }: any) => { if (error) console.error('[sequencesStore] insert error', error) })
    }
    return newSeq
  },

  updateSequence: (id, updates) => {
    set((s) => ({ sequences: s.sequences.map((seq) => seq.id === id ? { ...seq, ...updates } : seq) }))
    if (isSupabaseConfigured && supabase) {
      const row: Record<string, unknown> = {}
      if (updates.name !== undefined) row.name = updates.name
      if (updates.description !== undefined) row.description = updates.description
      if (updates.steps !== undefined) row.steps = updates.steps
      if (updates.isActive !== undefined) row.is_active = updates.isActive
      if (updates.enrolledCount !== undefined) row.enrolled_count = updates.enrolledCount
      ;(supabase as any).from('email_sequences').update(row).eq('id', id)
        .then(({ error }: any) => { if (error) console.error('[sequencesStore] update error', error) })
    }
  },

  deleteSequence: (id) => {
    set((s) => ({
      sequences: s.sequences.filter((seq) => seq.id !== id),
      enrollments: s.enrollments.filter((e) => e.sequenceId !== id),
    }))
    if (isSupabaseConfigured && supabase) {
      sbDelete('email_sequences', id).catch((e) => console.error('[sequencesStore] delete error', e))
    }
  },

  enrollContact: (sequenceId, contactId, contactName) => {
    const sequence = get().sequences.find((s) => s.id === sequenceId)
    const now = new Date().toISOString()
    const firstStep = sequence?.steps.find((s) => s.order === 0)
    let nextStepAt: string | undefined
    if (firstStep) {
      const d = new Date()
      d.setDate(d.getDate() + (firstStep.delayDays ?? 0))
      nextStepAt = d.toISOString()
    }
    const enrollment: SequenceEnrollment = {
      id: uuidv4(), sequenceId, contactId, contactName,
      currentStep: 0, status: 'active', enrolledAt: now, nextStepAt,
    }
    set((s) => ({
      enrollments: [...s.enrollments, enrollment],
      sequences: s.sequences.map((seq) => seq.id === sequenceId ? { ...seq, enrolledCount: seq.enrolledCount + 1 } : seq),
    }))
    if (isSupabaseConfigured && supabase) {
      ;(supabase as any).from('sequence_enrollments').insert({
        id: enrollment.id, sequence_id: sequenceId, contact_id: contactId,
        contact_name: contactName, current_step: 0, status: 'active',
        enrolled_at: now, next_step_at: nextStepAt, organization_id: getOrgId(),
      }).then(({ error }: any) => { if (error) console.error('[sequencesStore] enroll error', error) })
    }
    return enrollment
  },

  pauseEnrollment: (enrollmentId) => {
    set((s) => ({ enrollments: s.enrollments.map((e) => e.id === enrollmentId ? { ...e, status: 'paused' as EnrollmentStatus } : e) }))
    if (isSupabaseConfigured && supabase) {
      ;(supabase as any).from('sequence_enrollments').update({ status: 'paused' }).eq('id', enrollmentId)
        .then(({ error }: any) => { if (error) console.error('[sequencesStore] pause error', error) })
    }
  },

  resumeEnrollment: (enrollmentId) => {
    set((s) => ({ enrollments: s.enrollments.map((e) => e.id === enrollmentId ? { ...e, status: 'active' as EnrollmentStatus } : e) }))
    if (isSupabaseConfigured && supabase) {
      ;(supabase as any).from('sequence_enrollments').update({ status: 'active' }).eq('id', enrollmentId)
        .then(({ error }: any) => { if (error) console.error('[sequencesStore] resume error', error) })
    }
  },

  completeEnrollment: (enrollmentId) => {
    const now = new Date().toISOString()
    set((s) => ({ enrollments: s.enrollments.map((e) => e.id === enrollmentId ? { ...e, status: 'completed' as EnrollmentStatus, completedAt: now } : e) }))
    if (isSupabaseConfigured && supabase) {
      ;(supabase as any).from('sequence_enrollments').update({ status: 'completed', completed_at: now }).eq('id', enrollmentId)
        .then(({ error }: any) => { if (error) console.error('[sequencesStore] complete error', error) })
    }
  },

  unenrollContact: (enrollmentId) => {
    set((s) => ({ enrollments: s.enrollments.filter((e) => e.id !== enrollmentId) }))
    if (isSupabaseConfigured && supabase) {
      sbDelete('sequence_enrollments', enrollmentId).catch((e) => console.error('[sequencesStore] unenroll error', e))
    }
  },

  getEnrollmentsForContact: (contactId) => get().enrollments.filter((e) => e.contactId === contactId),
  getEnrollmentsForSequence: (sequenceId) => get().enrollments.filter((e) => e.sequenceId === sequenceId),
}))
