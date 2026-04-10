import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language, Translations } from './types'
import { es } from './es'
import { en } from './en'
import { pt } from './pt'

export type { Language, Translations }

const translations: Record<Language, Translations> = { es, en, pt }

export const LANGUAGE_LABELS: Record<Language, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
}

export const LANGUAGE_FLAGS: Record<Language, string> = {
  es: '🇪🇸',
  en: '🇬🇧',
  pt: '🇧🇷',
}

interface I18nState {
  language: Language
  setLanguage: (lang: Language) => void
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: 'es',
      setLanguage: (language) => set({ language }),
    }),
    { name: 'crm_language' }
  )
)

/** Hook that returns the current translations object */
export function useTranslations(): Translations {
  const language = useI18nStore((s) => s.language)
  return translations[language]
}

/** Get translations outside of React (for stores, utils) */
export function getTranslations(): Translations {
  return translations[useI18nStore.getState().language]
}

/** Get date-fns locale for current language */
export function getDateLocale() {
  const lang = useI18nStore.getState().language
  // Dynamic import not needed — just return the key for date-fns
  return lang
}
