import type { Contact, Activity, Company, FollowUpReminder } from '../types'

/**
 * Determine the urgency level based on days since last contact.
 */
function getUrgency(days: number): FollowUpReminder['urgency'] {
  if (days > 60) return 'critical'
  if (days > 30) return 'high'
  if (days > 14) return 'medium'
  return 'low'
}

/**
 * Suggest a follow-up action based on contact status and last activity type.
 */
function suggestAction(
  contact: Contact,
  lastActivityType?: string,
  daysSinceContact?: number
): string {
  if (!lastActivityType || !daysSinceContact) {
    return 'Realizar primer contacto: enviar email de presentación'
  }

  if (daysSinceContact > 60) {
    return 'Contacto frío: reactivar con email de valor o llamada breve'
  }

  if (contact.status === 'customer') {
    return 'Cliente activo: programar llamada de seguimiento de satisfacción'
  }

  if (contact.status === 'prospect') {
    switch (lastActivityType) {
      case 'email':
        return 'Hacer seguimiento por llamada tras email sin respuesta'
      case 'call':
        return 'Enviar email de resumen con próximos pasos'
      case 'meeting':
        return 'Enviar propuesta o resumen de la reunión'
      case 'linkedin':
        return 'Continuar conversación por email o llamada'
      default:
        return 'Programar llamada de seguimiento'
    }
  }

  return 'Programar actividad de seguimiento'
}

const URGENCY_ORDER: Record<FollowUpReminder['urgency'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

/**
 * Detect contacts needing follow-up and generate reminders.
 * Returns contacts that haven't been contacted in 7+ days or have never been contacted,
 * sorted by urgency (critical first) then by days since contact (descending).
 */
export function getFollowUpReminders(
  contacts: Contact[],
  activities: Activity[],
  companies: Company[]
): FollowUpReminder[] {
  const now = new Date()
  const reminders: FollowUpReminder[] = []

  // Build a company lookup map
  const companyMap = new Map<string, Company>()
  for (const company of companies) {
    companyMap.set(company.id, company)
  }

  // Build activity lookup by contactId
  const activityByContact = new Map<string, Activity[]>()
  for (const activity of activities) {
    if (!activity.contactId) continue
    const list = activityByContact.get(activity.contactId) || []
    list.push(activity)
    activityByContact.set(activity.contactId, list)
  }

  for (const contact of contacts) {
    // Skip churned contacts
    if (contact.status === 'churned') continue

    const contactActivities = activityByContact.get(contact.id) || []

    // Find the most recent activity
    let mostRecent: Activity | undefined
    if (contactActivities.length > 0) {
      mostRecent = contactActivities.reduce((latest, a) =>
        new Date(a.createdAt) > new Date(latest.createdAt) ? a : latest
      )
    }

    let daysSinceContact: number
    let lastActivityDate: string

    if (mostRecent) {
      const lastDate = new Date(mostRecent.createdAt)
      daysSinceContact = Math.floor(
        (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      lastActivityDate = mostRecent.createdAt
    } else {
      // Never contacted — use createdAt as reference
      const createdDate = new Date(contact.createdAt)
      daysSinceContact = Math.floor(
        (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      lastActivityDate = contact.createdAt
    }

    // Only include contacts that need follow-up (7+ days or never contacted)
    if (daysSinceContact < 7 && mostRecent) continue

    const company = companyMap.get(contact.companyId)
    const urgency = getUrgency(daysSinceContact)

    reminders.push({
      contactId: contact.id,
      contactName: `${contact.firstName} ${contact.lastName}`,
      companyName: company?.name || '',
      daysSinceContact,
      lastActivityType: mostRecent?.type,
      lastActivityDate,
      urgency,
      suggestedAction: suggestAction(contact, mostRecent?.type, mostRecent ? daysSinceContact : undefined),
    })
  }

  // Sort by urgency (critical first), then by days descending
  reminders.sort((a, b) => {
    const urgencyDiff = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
    if (urgencyDiff !== 0) return urgencyDiff
    return b.daysSinceContact - a.daysSinceContact
  })

  return reminders
}
