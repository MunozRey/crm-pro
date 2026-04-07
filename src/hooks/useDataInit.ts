import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { useContactsStore } from '../store/contactsStore'
import { useCompaniesStore } from '../store/companiesStore'
import { useDealsStore } from '../store/dealsStore'
import { useActivitiesStore } from '../store/activitiesStore'
import { useNotificationsStore } from '../store/notificationsStore'
import { initRealtimeSubscriptions } from '../lib/realtimeSubscriptions'
import { isSupabaseConfigured } from '../lib/supabase'

/**
 * Fetches all core data on mount and sets up Realtime subscriptions.
 * Call this inside a component that only renders for authenticated users.
 */
export function useDataInit() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const didInit = useRef(false)

  useEffect(() => {
    if (didInit.current) return
    // For !isSupabaseConfigured we still want seed data loaded
    if (!currentUser && isSupabaseConfigured) return

    didInit.current = true

    // Kick off all fetches in parallel
    useContactsStore.getState().fetchContacts()
    useCompaniesStore.getState().fetchCompanies()
    useDealsStore.getState().fetchDeals()
    useActivitiesStore.getState().fetchActivities()
    useNotificationsStore.getState().fetchNotifications()

    const cleanup = initRealtimeSubscriptions()
    return () => {
      cleanup()
      didInit.current = false
    }
  }, [currentUser])
}
