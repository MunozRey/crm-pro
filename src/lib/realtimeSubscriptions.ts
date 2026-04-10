import { supabase, isSupabaseConfigured } from './supabase'
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
import { useCustomFieldsStore } from '../store/customFieldsStore'

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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_goals' }, () => {
      useGoalsStore.getState().fetchGoals()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'email_sequences' }, () => {
      useSequencesStore.getState().fetchSequences()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_rules' }, () => {
      useAutomationsStore.getState().fetchRules()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'email_templates' }, () => {
      useTemplateStore.getState().fetchTemplates()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
      useProductsStore.getState().fetchProducts()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_field_definitions' }, () => {
      useCustomFieldsStore.getState().fetchCustomFields()
    })
    .subscribe()

  return () => {
    supabase!.removeChannel(channel)
  }
}
