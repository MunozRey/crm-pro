import type { Translations } from './types'
import { en } from './en'

export const fr: Translations = {
  ...en,
  nav: {
    ...en.nav,
    dashboard: 'Tableau de bord',
    contacts: 'Contacts',
    companies: 'Entreprises',
    deals: 'Opportunites',
    calendar: 'Calendrier',
    activities: 'Activites',
    settings: 'Parametres',
    reports: 'Rapports',
    notifications: 'Notifications',
    team: 'Equipe',
  },
  common: {
    ...en.common,
    search: 'Rechercher',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    create: 'Creer',
    loading: 'Chargement...',
  },
  settings: {
    ...en.settings,
    title: 'Parametres',
    language: 'Langue',
    currency: 'Devise',
    notifications: 'Notifications',
  },
}
