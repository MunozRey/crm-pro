import { supabase, isSupabaseConfigured } from './supabase'
import { useContactsStore } from '../store/contactsStore'
import { useCompaniesStore } from '../store/companiesStore'
import { useDealsStore } from '../store/dealsStore'
import { useActivitiesStore } from '../store/activitiesStore'
import { useNotificationsStore } from '../store/notificationsStore'

/**
 * Subscribe to Postgres changes on all core tables.
 * Returns a cleanup function that removes the channel.
 */
export function initRealtimeSubscriptions(): () => void {
  if (!isSupabaseConfigured || !supabase) return () => {}

  const channel = supabase!.channel('db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
      useContactsStore.getState().fetchContacts()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => {
      useCompaniesStore.getState().fetchCompanies()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
      useDealsStore.getState().fetchDeals()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () => {
      useActivitiesStore.getState().fetchActivities()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
      useNotificationsStore.getState().fetchNotifications()
    })
    .subscribe()

  return () => {
    supabase!.removeChannel(channel)
  }
}
