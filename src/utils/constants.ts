import type { ContactStatus, ContactSource, CompanyStatus, DealStage, DealPriority, ActivityType, ActivityStatus } from '../types'

// ─── Contact ─────────────────────────────────────────────────────────────────

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  prospect: 'Prospecto',
  customer: 'Cliente',
  churned: 'Perdido',
}

export const CONTACT_STATUS_COLORS: Record<ContactStatus, string> = {
  prospect: 'yellow',
  customer: 'green',
  churned: 'red',
}

export const CONTACT_SOURCE_LABELS: Record<ContactSource, string> = {
  website: 'Web',
  referral: 'Referido',
  outbound: 'Outbound',
  event: 'Evento',
  linkedin: 'LinkedIn',
  other: 'Otro',
}

// ─── Company ─────────────────────────────────────────────────────────────────

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  prospect: 'Prospecto',
  customer: 'Cliente',
  partner: 'Partner',
  churned: 'Perdido',
}

export const COMPANY_SIZE_OPTIONS = [
  '1-10',
  '10-50',
  '50-100',
  '100-200',
  '200-500',
  '500-1000',
  '1000+',
]

export const COMPANY_INDUSTRY_LABELS: Record<string, string> = {
  fintech: 'Fintech',
  saas: 'SaaS',
  consulting: 'Consultoría',
  insurance: 'Seguros',
  banking: 'Banca',
  retail: 'Retail',
  healthcare: 'Salud',
  other: 'Otro',
}

// ─── Deal ─────────────────────────────────────────────────────────────────────

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead',
  qualified: 'Calificado',
  proposal: 'Propuesta',
  negotiation: 'Negociación',
  closed_won: 'Ganado',
  closed_lost: 'Perdido',
}

export const DEAL_STAGE_COLORS: Record<DealStage, string> = {
  lead: 'blue',
  qualified: 'yellow',
  proposal: 'purple',
  negotiation: 'orange',
  closed_won: 'emerald',
  closed_lost: 'rose',
}

export const DEAL_PRIORITY_LABELS: Record<DealPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
}

export const DEAL_PRIORITY_COLORS: Record<DealPriority, string> = {
  low: '#6b7280',
  medium: '#f59e0b',
  high: '#ef4444',
}

export const DEAL_STAGES_ORDER: DealStage[] = [
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
]

// ─── Activity ─────────────────────────────────────────────────────────────────

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: 'Llamada',
  email: 'Email',
  meeting: 'Reunión',
  note: 'Nota',
  task: 'Tarea',
  linkedin: 'LinkedIn',
}

export const ACTIVITY_TYPE_COLORS: Record<ActivityType, string> = {
  call: '#3b82f6',
  email: '#8b5cf6',
  meeting: '#10b981',
  note: '#f59e0b',
  task: '#6366f1',
  linkedin: '#0077b5',
}

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  pending: 'Pendiente',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export const NAV_SECTIONS = {
  main: 'Principal',
  sales: 'Ventas',
  config: 'Configuración',
} as const

// ─── Local Storage Keys ───────────────────────────────────────────────────────

export const LS_KEYS = {
  contacts: 'crm_contacts',
  companies: 'crm_companies',
  deals: 'crm_deals',
  activities: 'crm_activities',
  settings: 'crm_settings',
  audit: 'crm_audit',
  notifications: 'crm_notifications',
  sequences: 'crm_sequences',
  products: 'crm_products',
  automations: 'crm_automations',
} as const
