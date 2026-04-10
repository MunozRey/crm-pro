import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings, DealCurrency } from '../types'
import { seedSettings } from '../utils/seedData'
import { LS_KEYS } from '../utils/constants'

interface SettingsState {
  settings: AppSettings

  updateCurrency: (currency: DealCurrency) => void
  addTag: (tag: string) => void
  removeTag: (tag: string) => void
  reorderStages: (stages: AppSettings['pipelineStages']) => void
  resetToDefaults: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: seedSettings,

      updateCurrency: (currency) => {
        set((state) => ({ settings: { ...state.settings, currency } }))
      },

      addTag: (tag) => {
        set((state) => ({
          settings: { ...state.settings, tags: [...state.settings.tags, tag] },
        }))
      },

      removeTag: (tag) => {
        set((state) => ({
          settings: {
            ...state.settings,
            tags: state.settings.tags.filter((t) => t !== tag),
          },
        }))
      },

      reorderStages: (stages) => {
        set((state) => ({ settings: { ...state.settings, pipelineStages: stages } }))
      },

      resetToDefaults: () => {
        set({ settings: seedSettings })
      },
    }),
    {
      name: LS_KEYS.settings,
    }
  )
)
