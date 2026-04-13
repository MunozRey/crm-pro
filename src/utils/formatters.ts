import { formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns'
import { enUS, es, ptBR, fr, de, it } from 'date-fns/locale'
import { useI18nStore, getTranslations } from '../i18n'
import { useSettingsStore } from '../store/settingsStore'
import type { Language } from '../i18n'

const DATE_FNS_LOCALE_BY_LANGUAGE = {
  en: enUS,
  es,
  pt: ptBR,
  fr,
  de,
  it,
} as const

const BCP47_BY_LANGUAGE: Record<Language, string> = {
  en: 'en-GB',
  es: 'es-ES',
  pt: 'pt-BR',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
}

function getActiveLocale() {
  const language = useI18nStore.getState().language
  return {
    language,
    bcp47: BCP47_BY_LANGUAGE[language],
    dateFnsLocale: DATE_FNS_LOCALE_BY_LANGUAGE[language],
  }
}

export function formatCurrency(value: number, currency = 'EUR'): string {
  const { bcp47 } = getActiveLocale()
  const fallbackCurrency = useSettingsStore.getState().settings.currency ?? 'EUR'
  return new Intl.NumberFormat(bcp47, {
    style: 'currency',
    currency: currency || fallbackCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    const { bcp47 } = getActiveLocale()
    return new Intl.DateTimeFormat(bcp47, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date)
  } catch {
    return dateStr
  }
}

export function formatDateShort(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    const { bcp47 } = getActiveLocale()
    return new Intl.DateTimeFormat(bcp47, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date)
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    const { bcp47 } = getActiveLocale()
    return new Intl.DateTimeFormat(bcp47, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch {
    return dateStr
  }
}

export function formatRelativeDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    const { dateFnsLocale } = getActiveLocale()
    const t = getTranslations()
    if (isToday(date)) return t.notifications.today
    if (isYesterday(date)) {
      return ({
        en: 'Yesterday',
        es: 'Ayer',
        pt: 'Ontem',
        fr: 'Hier',
        de: 'Gestern',
        it: 'Ieri',
      } as Record<Language, string>)[useI18nStore.getState().language]
    }
    return formatDistanceToNow(date, { addSuffix: true, locale: dateFnsLocale })
  } catch {
    return dateStr
  }
}

export function formatNumber(value: number): string {
  const { bcp47 } = getActiveLocale()
  return new Intl.NumberFormat(bcp47).format(value)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function formatPhoneNumber(phone: string): string {
  return phone
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '…'
}
