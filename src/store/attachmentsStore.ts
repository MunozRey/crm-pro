import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { Attachment } from '../types'

interface AttachmentsStore {
  attachments: Attachment[]
  addAttachment: (data: Omit<Attachment, 'id' | 'uploadedAt'>) => Attachment
  deleteAttachment: (id: string) => void
  getAttachmentsForEntity: (entityType: Attachment['entityType'], entityId: string) => Attachment[]
  updateNotes: (id: string, notes: string) => void
}

export const useAttachmentsStore = create<AttachmentsStore>()(
  persist(
    (set, get) => ({
      attachments: [],

      addAttachment: (data) => {
        const attachment: Attachment = {
          ...data,
          id: uuidv4(),
          uploadedAt: new Date().toISOString(),
        }
        set((s) => ({ attachments: [...s.attachments, attachment] }))
        return attachment
      },

      deleteAttachment: (id) => {
        set((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) }))
      },

      getAttachmentsForEntity: (entityType, entityId) => {
        return get().attachments.filter((a) => a.entityType === entityType && a.entityId === entityId)
      },

      updateNotes: (id, notes) => {
        set((s) => ({
          attachments: s.attachments.map((a) => a.id === id ? { ...a, notes } : a),
        }))
      },
    }),
    { name: 'crm_attachments' }
  )
)
