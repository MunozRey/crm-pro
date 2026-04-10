import type { Translations } from './types'
import { en } from './en'

export const de: Translations = {
  ...en,
  nav: {
    ...en.nav,
    dashboard: 'Dashboard',
    contacts: 'Kontakte',
    companies: 'Unternehmen',
    deals: 'Deals',
    calendar: 'Kalender',
    activities: 'Aktivitaten',
    settings: 'Einstellungen',
    reports: 'Berichte',
    notifications: 'Benachrichtigungen',
    team: 'Team',
  },
  common: {
    ...en.common,
    search: 'Suchen',
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Loschen',
    edit: 'Bearbeiten',
    create: 'Erstellen',
    loading: 'Laden...',
  },
  settings: {
    ...en.settings,
    title: 'Einstellungen',
    language: 'Sprache',
    currency: 'Wahrung',
    notifications: 'Benachrichtigungen',
  },
}
