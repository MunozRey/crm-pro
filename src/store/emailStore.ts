import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { CRMEmail, GmailThread } from '../types'
import { sendGmailEmail, getGmailProfile, listGmailThreads } from '../services/gmailService'
import { useAuditStore } from './auditStore'

export interface EmailStore {
  emails: CRMEmail[]
  gmailAddress: string | null
  threads: GmailThread[]
  threadsLoading: boolean
  threadsError: string | null

  // Local email actions
  addEmail: (email: Omit<CRMEmail, 'id' | 'createdAt'>) => CRMEmail
  deleteEmail: (id: string) => void
  updateEmail: (id: string, patch: Partial<CRMEmail>) => void

  // Tracking actions
  trackEmailOpen: (emailId: string) => void
  trackEmailClick: (emailId: string) => void
  enableTracking: (emailId: string) => void

  // Gmail auth
  setGmailAddress: (addr: string | null) => void
  disconnectGmail: () => void
  isGmailConnected: () => boolean

  // Gmail send (also saves locally)
  sendEmail: (params: {
    to: string[]
    cc?: string[]
    subject: string
    body: string
    contactId?: string
    dealId?: string
    companyId?: string
    accessToken?: string
  }) => Promise<CRMEmail>

  // Load Gmail threads
  loadThreads: (accessToken: string, query?: string) => Promise<void>

  // Helpers
  getEmailsByContact: (contactId: string) => CRMEmail[]
  getEmailsByDeal: (dealId: string) => CRMEmail[]
}

export const useEmailStore = create<EmailStore>()(
  persist(
    (set, get) => ({
      emails: [],
      gmailAddress: null,
      threads: [],
      threadsLoading: false,
      threadsError: null,

      addEmail: (data) => {
        const email: CRMEmail = { ...data, id: uuid(), createdAt: new Date().toISOString() }
        set((s) => ({ emails: [email, ...s.emails] }))
        return email
      },

      deleteEmail: (id) => set((s) => ({ emails: s.emails.filter((e) => e.id !== id) })),

      updateEmail: (id, patch) =>
        set((s) => ({
          emails: s.emails.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      trackEmailOpen: (emailId) =>
        set((s) => ({
          emails: s.emails.map((e) => {
            if (e.id !== emailId) return e
            const now = new Date().toISOString()
            return {
              ...e,
              openedAt: e.openedAt ?? now,
              openCount: (e.openCount ?? 0) + 1,
              lastOpenedAt: now,
            }
          }),
        })),

      trackEmailClick: (emailId) =>
        set((s) => ({
          emails: s.emails.map((e) => {
            if (e.id !== emailId) return e
            const now = new Date().toISOString()
            return {
              ...e,
              clickCount: (e.clickCount ?? 0) + 1,
              lastClickedAt: now,
            }
          }),
        })),

      enableTracking: (emailId) =>
        set((s) => ({
          emails: s.emails.map((e) => (e.id === emailId ? { ...e, trackingEnabled: true } : e)),
        })),

      setGmailAddress: (addr) => set({ gmailAddress: addr }),

      disconnectGmail: () => {
        set({ gmailAddress: null, threads: [] })
      },

      isGmailConnected: () => {
        return !!get().gmailAddress
      },

      sendEmail: async (params) => {
        const { accessToken } = params
        let gmailMessageId: string | undefined
        let gmailThreadId: string | undefined

        if (accessToken) {
          const sent = await sendGmailEmail(
            { to: params.to, cc: params.cc, subject: params.subject, body: params.body },
            accessToken,
          )
          gmailMessageId = sent.id
          gmailThreadId = sent.threadId
        }

        const from = get().gmailAddress ?? 'me@crm.local'
        const email = get().addEmail({
          from,
          to: params.to,
          cc: params.cc,
          subject: params.subject,
          body: params.body,
          status: 'sent',
          contactId: params.contactId,
          dealId: params.dealId,
          companyId: params.companyId,
          gmailMessageId,
          gmailThreadId,
          sentAt: new Date().toISOString(),
        })

        useAuditStore.getState().logAction('email_sent', 'email', email.id, params.subject, 'Email enviado')
        return email
      },

      loadThreads: async (accessToken: string, query = '') => {
        set({ threadsLoading: true, threadsError: null })
        try {
          if (!get().gmailAddress) {
            const profile = await getGmailProfile(accessToken)
            set({ gmailAddress: profile.emailAddress })
          }
          const threads = await listGmailThreads(accessToken, query)
          set({ threads, threadsLoading: false })
        } catch (err) {
          set({
            threadsLoading: false,
            threadsError: err instanceof Error ? err.message : 'Error al cargar correos',
          })
        }
      },

      getEmailsByContact: (contactId) => get().emails.filter((e) => e.contactId === contactId),
      getEmailsByDeal: (dealId) => get().emails.filter((e) => e.dealId === dealId),
    }),
    {
      name: 'crm_emails',
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        if (version < 2) {
          const s = persistedState as Record<string, unknown>
          delete s.gmailTokens
          return s
        }
        return persistedState as EmailStore
      },
      partialize: (s) => ({
        emails: s.emails,
        gmailAddress: s.gmailAddress,
      }),
    },
  ),
)
