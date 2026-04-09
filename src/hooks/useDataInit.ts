import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { useContactsStore } from '../store/contactsStore'
import { useCompaniesStore } from '../store/companiesStore'
import { useDealsStore } from '../store/dealsStore'
import { useActivitiesStore } from '../store/activitiesStore'
import { useNotificationsStore } from '../store/notificationsStore'
import { useGoalsStore } from '../store/goalsStore'
import { useSequencesStore } from '../store/sequencesStore'
import { useAutomationsStore } from '../store/automationsStore'
import { useTemplateStore } from '../store/templateStore'
import { useProductsStore } from '../store/productsStore'
import { useAuditStore } from '../store/auditStore'
import { useCustomFieldsStore } from '../store/customFieldsStore'
import { initRealtimeSubscriptions } from '../lib/realtimeSubscriptions'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useEmailStore } from '../store/emailStore'
import { useGmailToken } from '../contexts/GmailTokenContext'

/**
 * Fetches all core data on mount and sets up Realtime subscriptions.
 * Call this inside a component that only renders for authenticated users.
 */
export function useDataInit() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const gmailAddress = useEmailStore((s) => s.gmailAddress)
  const { setGmailToken } = useGmailToken()
  const didInit = useRef(false)

  useEffect(() => {
    if (didInit.current) return
    // For !isSupabaseConfigured we still want seed data loaded
    if (!currentUser && isSupabaseConfigured) return

    didInit.current = true

    // Silent Gmail token refresh (D-11): restore in-memory access token if user was connected
    if (gmailAddress && isSupabaseConfigured) {
      supabase!.functions.invoke('gmail-refresh-token').then(({ data, error }) => {
        if (!error && data?.access_token) {
          const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000
          setGmailToken(data.access_token, expiresAt)
        }
        // If refresh fails (e.g. token revoked), stay silent — user will see "Connect Gmail" in Inbox
      })
    }

    // Kick off all fetches in parallel
    useContactsStore.getState().fetchContacts()
    useCompaniesStore.getState().fetchCompanies()
    useDealsStore.getState().fetchDeals()
    useActivitiesStore.getState().fetchActivities()
    useNotificationsStore.getState().fetchNotifications()
    useGoalsStore.getState().fetchGoals()
    useSequencesStore.getState().fetchSequences()
    useAutomationsStore.getState().fetchRules()
    useTemplateStore.getState().fetchTemplates()
    useProductsStore.getState().fetchProducts()
    useAuditStore.getState().fetchEntries()
    useCustomFieldsStore.getState().fetchCustomFields()

    const cleanup = initRealtimeSubscriptions()
    return () => {
      cleanup()
      didInit.current = false
    }
  }, [currentUser])
}
