import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { AIConversation, AIMessage, ContactEnrichment, DealEnrichment } from '../types'
import { useAuditStore } from './auditStore'

interface AIStore {
  openRouterKey: string
  selectedModel: string
  conversations: AIConversation[]
  activeConversationId: string | null
  contactEnrichments: Record<string, ContactEnrichment>
  dealEnrichments: Record<string, DealEnrichment>
  isStreaming: boolean

  setOpenRouterKey: (key: string) => void
  setSelectedModel: (model: string) => void
  createConversation: (title?: string) => AIConversation
  deleteConversation: (id: string) => void
  setActiveConversation: (id: string | null) => void
  addMessage: (conversationId: string, message: Omit<AIMessage, 'timestamp'>) => void
  setStreaming: (v: boolean) => void
  saveContactEnrichment: (contactId: string, enrichment: ContactEnrichment) => void
  saveDealEnrichment: (dealId: string, enrichment: DealEnrichment) => void
  getActiveConversation: () => AIConversation | null
}

export const useAIStore = create<AIStore>()(
  persist(
    (set, get) => ({
      openRouterKey: '',
      selectedModel: 'claude-opus-4-6',
      conversations: [],
      activeConversationId: null,
      contactEnrichments: {},
      dealEnrichments: {},
      isStreaming: false,

      setOpenRouterKey: (key) => set({ openRouterKey: key }),
      setSelectedModel: (model) => set({ selectedModel: model }),

      createConversation: (title) => {
        const conv: AIConversation = {
          id: uuid(),
          title: title ?? `Conversación ${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeConversationId: conv.id,
        }))
        return conv
      },

      deleteConversation: (id) =>
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
          activeConversationId: s.activeConversationId === id ? null : s.activeConversationId,
        })),

      setActiveConversation: (id) => set({ activeConversationId: id }),

      addMessage: (conversationId, message) => {
        const msg: AIMessage = { ...message, timestamp: new Date().toISOString() }
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [...c.messages, msg], updatedAt: new Date().toISOString() }
              : c,
          ),
        }))
      },

      setStreaming: (v) => set({ isStreaming: v }),

      saveContactEnrichment: (contactId, enrichment) => {
        set((s) => ({ contactEnrichments: { ...s.contactEnrichments, [contactId]: enrichment } }))
        useAuditStore.getState().logAction('enrichment_completed', 'contact', contactId, '', 'Enriquecimiento de contacto completado')
      },

      saveDealEnrichment: (dealId, enrichment) => {
        set((s) => ({ dealEnrichments: { ...s.dealEnrichments, [dealId]: enrichment } }))
        useAuditStore.getState().logAction('enrichment_completed', 'deal', dealId, '', 'Enriquecimiento de deal completado')
      },

      getActiveConversation: () => {
        const { conversations, activeConversationId } = get()
        return conversations.find((c) => c.id === activeConversationId) ?? null
      },
    }),
    {
      name: 'crm_ai',
      partialize: (s) => ({
        openRouterKey: s.openRouterKey,
        selectedModel: s.selectedModel,
        conversations: s.conversations.slice(0, 20), // keep last 20
        contactEnrichments: s.contactEnrichments,
        dealEnrichments: s.dealEnrichments,
      }),
    },
  ),
)
