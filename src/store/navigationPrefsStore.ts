import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { LS_KEYS } from '../utils/constants'
import { useAuthStore } from './authStore'
import { createDefaultNavigationPreferences } from '../config/navigationDefaults'
import { sanitizeNavigationPreferences } from '../utils/navigationSanitizer'
import type { NavigationPreferences } from '../types/navigation'

interface NavigationPrefsState {
  preferences: NavigationPreferences
  loaded: boolean
  loading: boolean
  error: string | null
  loadPreferences: () => Promise<void>
  updatePreferences: (updater: (current: NavigationPreferences) => NavigationPreferences) => Promise<void>
  resetPreferences: () => Promise<void>
}

const DEFAULT_PREFS = createDefaultNavigationPreferences()

export const useNavigationPrefsStore = create<NavigationPrefsState>()(
  persist(
    (set, get) => ({
      preferences: DEFAULT_PREFS,
      loaded: false,
      loading: false,
      error: null,
      loadPreferences: async () => {
        if (!isSupabaseConfigured || !supabase) {
          set({ loaded: true })
          return
        }
        const state = useAuthStore.getState()
        const userId = state.currentUser?.id
        const organizationId = state.organizationId
        if (!userId || !organizationId) return
        set({ loading: true, error: null })
        const { data, error } = await (supabase as any)
          .from('navigation_preferences')
          .select('prefs')
          .eq('user_id', userId)
          .eq('organization_id', organizationId)
          .maybeSingle()
        if (error) {
          set({ loading: false, loaded: true, error: error.message })
          return
        }
        set({
          preferences: sanitizeNavigationPreferences(data?.prefs),
          loaded: true,
          loading: false,
          error: null,
        })
      },
      updatePreferences: async (updater) => {
        const next = sanitizeNavigationPreferences(updater(get().preferences))
        set({ preferences: next })
        if (!isSupabaseConfigured || !supabase) return
        const state = useAuthStore.getState()
        const userId = state.currentUser?.id
        const organizationId = state.organizationId
        if (!userId || !organizationId) return
        const { error } = await (supabase as any)
          .from('navigation_preferences')
          .upsert({
            user_id: userId,
            organization_id: organizationId,
            prefs: next,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'organization_id,user_id' })
        if (error) set({ error: error.message })
      },
      resetPreferences: async () => {
        await get().updatePreferences(() => createDefaultNavigationPreferences())
      },
    }),
    { name: `${LS_KEYS.settings}_navigation_prefs` },
  ),
)
