import type { Translations } from './types'
import { en } from './en'

export const it: Translations = {
  ...en,
  nav: {
    ...en.nav,
    dashboard: 'Dashboard',
    contacts: 'Contatti',
    companies: 'Aziende',
    deals: 'Trattative',
    calendar: 'Calendario',
    activities: 'Attivita',
    settings: 'Impostazioni',
    reports: 'Report',
    notifications: 'Notifiche',
    team: 'Team',
  },
  common: {
    ...en.common,
    search: 'Cerca',
    save: 'Salva',
    cancel: 'Annulla',
    delete: 'Elimina',
    edit: 'Modifica',
    create: 'Crea',
    loading: 'Caricamento...',
  },
  settings: {
    ...en.settings,
    title: 'Impostazioni',
    language: 'Lingua',
    currency: 'Valuta',
    notifications: 'Notifiche',
  },
}
