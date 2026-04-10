import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { CRMEmail, GmailThread } from '../types'
import { sendGmailEmail, getGmailProfile, listGmailThreads } from '../services/gmailService'
import { useAuditStore } from './auditStore'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getOrgId, runSupabaseWrite } from '../lib/supabaseHelpers'
import { useAuthStore } from './authStore'
import { seedEmails } from '../utils/seedData'
import type { Database } from '../lib/database.types'

export interface GmailThreadLink {
  threadId: string
  contactId?: string
  companyId?: string
  dealId?: string
  source: 'auto' | 'manual'
  updatedAt: string
}

export interface EmailStore {
  emails: CRMEmail[]
  gmailAddress: string | null
  threads: GmailThread[]
  threadLinks: Record<string, GmailThreadLink>
  threadsLoading: boolean
  threadsError: string | null
  threadsLastSyncedAt: string | null

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
  fetchThreadLinks: () => Promise<void>
  setThreadLink: (link: Omit<GmailThreadLink, 'updatedAt'>) => void
  clearThreadLink: (threadId: string) => void

  // Helpers
  getEmailsByContact: (contactId: string) => CRMEmail[]
  getEmailsByDeal: (dealId: string) => CRMEmail[]
}

type GmailThreadLinkRow = Database['public']['Tables']['gmail_thread_links']['Row']

export const useEmailStore = create<EmailStore>()(
  persist(
    (set, get) => ({
      emails: isSupabaseConfigured ? [] : seedEmails,
      gmailAddress: null,
      threads: [],
      threadLinks: {},
      threadsLoading: false,
      threadsError: null,
      threadsLastSyncedAt: null,

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
          set({ threads, threadsLoading: false, threadsLastSyncedAt: new Date().toISOString() })
        } catch (err) {
          set({
            threadsLoading: false,
            threadsError: err instanceof Error ? err.message : 'Error al cargar correos',
            threadsLastSyncedAt: new Date().toISOString(),
          })
        }
      },

      fetchThreadLinks: async () => {
        if (!isSupabaseConfigured || !supabase) return
        try {
          const { data, error } = await supabase
            .from('gmail_thread_links')
            .select('thread_id, contact_id, company_id, deal_id, source, updated_at')

          if (error) return

          const links: Record<string, GmailThreadLink> = {}
          for (const row of (data ?? []) as Pick<GmailThreadLinkRow, 'thread_id' | 'contact_id' | 'company_id' | 'deal_id' | 'source' | 'updated_at'>[]) {
            links[row.thread_id] = {
              threadId: row.thread_id,
              contactId: row.contact_id ?? undefined,
              companyId: row.company_id ?? undefined,
              dealId: row.deal_id ?? undefined,
              source: row.source === 'manual' ? 'manual' : 'auto',
              updatedAt: row.updated_at ?? new Date().toISOString(),
            }
          }
          set({ threadLinks: links })
        } catch {
          // Non-critical: link hydration can silently fail without blocking Inbox
        }
      },

      setThreadLink: (link) => {
        const next: GmailThreadLink = {
          ...link,
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({
          threadLinks: { ...s.threadLinks, [link.threadId]: next },
        }))

        if (isSupabaseConfigured && supabase) {
          const currentUserId = useAuthStore.getState().currentUser?.id
          if (!currentUserId) return
          runSupabaseWrite(
            'emailStore:setThreadLink',
            supabase.from('gmail_thread_links').upsert({
              thread_id: link.threadId,
              user_id: currentUserId,
              contact_id: link.contactId ?? null,
              company_id: link.companyId ?? null,
              deal_id: link.dealId ?? null,
              source: link.source,
              organization_id: getOrgId(),
            } as never, { onConflict: 'thread_id,user_id,organization_id' }),
          )
        }
      },

      clearThreadLink: (threadId) => {
        set((s) => {
          const next = { ...s.threadLinks }
          delete next[threadId]
          return { threadLinks: next }
        })

        if (isSupabaseConfigured && supabase) {
          runSupabaseWrite(
            'emailStore:clearThreadLink',
            supabase.from('gmail_thread_links').delete().eq('thread_id', threadId),
          )
        }
      },

      getEmailsByContact: (contactId) => get().emails.filter((e) => e.contactId === contactId),
      getEmailsByDeal: (dealId) => get().emails.filter((e) => e.dealId === dealId),
    }),
    {
      name: 'crm_emails_v2',
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        if (version < 2) {
          const s = persistedState as Record<string, unknown>
          delete s.gmailTokens
          if (!isSupabaseConfigured && (!Array.isArray(s.emails) || s.emails.length === 0)) {
            s.emails = seedEmails
          }
          return s
        }
        const s = persistedState as Record<string, unknown>
        if (version < 3) {
          if (!isSupabaseConfigured && (!Array.isArray(s.emails) || s.emails.length === 0)) {
            s.emails = seedEmails
          }
        }
        return s as unknown as EmailStore
      },
      partialize: (s) => ({
        emails: s.emails,
        gmailAddress: s.gmailAddress,
        threadLinks: s.threadLinks,
        threadsLastSyncedAt: s.threadsLastSyncedAt,
      }),
    },
  ),
)
