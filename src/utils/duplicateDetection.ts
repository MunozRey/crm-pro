import type { Contact, DuplicateGroup } from '../types'

/**
 * Normalize a string for comparison: lowercase, strip accents, trim.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Strip non-digit characters and return last 9 digits for phone comparison.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 9 ? digits.slice(-9) : digits
}

/**
 * Find duplicate contacts based on email, name, and phone matching.
 * Returns groups sorted by confidence descending.
 */
export function findDuplicates(contacts: Contact[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = []
  const usedInGroup = new Map<string, Set<string>>() // matchType -> set of contact ids already grouped

  // ─── Email Match (100% confidence) ─────────────────────────────────────

  const emailMap = new Map<string, Contact[]>()
  for (const contact of contacts) {
    if (!contact.email) continue
    const key = contact.email.toLowerCase().trim()
    if (!key) continue
    const existing = emailMap.get(key) || []
    existing.push(contact)
    emailMap.set(key, existing)
  }

  const emailGrouped = new Set<string>()
  for (const [, group] of emailMap) {
    if (group.length >= 2) {
      groups.push({
        contacts: group,
        matchType: 'email',
        confidence: 100,
      })
      for (const c of group) {
        emailGrouped.add(c.id)
      }
    }
  }
  usedInGroup.set('email', emailGrouped)

  // ─── Phone Match (90% confidence) ─────────────────────────────────────

  const phoneMap = new Map<string, Contact[]>()
  for (const contact of contacts) {
    if (!contact.phone) continue
    const key = normalizePhone(contact.phone)
    if (key.length < 7) continue // skip very short/empty phone numbers
    const existing = phoneMap.get(key) || []
    existing.push(contact)
    phoneMap.set(key, existing)
  }

  const phoneGrouped = new Set<string>()
  for (const [, group] of phoneMap) {
    if (group.length >= 2) {
      // Filter out contacts already grouped by email (same pair)
      const nonEmailGrouped = group.filter((c) => !emailGrouped.has(c.id))
      if (nonEmailGrouped.length >= 2) {
        groups.push({
          contacts: group,
          matchType: 'phone',
          confidence: 90,
        })
        for (const c of group) {
          phoneGrouped.add(c.id)
        }
      }
    }
  }
  usedInGroup.set('phone', phoneGrouped)

  // ─── Name Match (80% confidence) ──────────────────────────────────────

  const nameMap = new Map<string, Contact[]>()
  for (const contact of contacts) {
    const firstName = normalize(contact.firstName)
    const lastName = normalize(contact.lastName)
    if (!firstName && !lastName) continue
    const key = `${firstName}|${lastName}`
    const existing = nameMap.get(key) || []
    existing.push(contact)
    nameMap.set(key, existing)
  }

  for (const [, group] of nameMap) {
    if (group.length >= 2) {
      // Only include if not all contacts are already in a higher-confidence group
      const alreadyGrouped = group.every(
        (c) => emailGrouped.has(c.id) || phoneGrouped.has(c.id)
      )
      if (!alreadyGrouped) {
        groups.push({
          contacts: group,
          matchType: 'name',
          confidence: 80,
        })
      }
    }
  }

  // Sort by confidence descending
  groups.sort((a, b) => b.confidence - a.confidence)

  return groups
}
