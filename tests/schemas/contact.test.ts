import { describe, it, expect } from 'vitest'
import { contactSchema } from '../../src/lib/schemas/contact'

const validContact = {
  firstName: 'Ana',
  lastName: 'García',
  email: 'ana@empresa.com',
  phone: '',
  jobTitle: '',
  companyId: '',
  status: 'prospect' as const,
  source: 'website' as const,
  assignedTo: 'user-1',
  notes: '',
}

describe('contactSchema', () => {
  it('accepts a valid contact payload', () => {
    const result = contactSchema.safeParse(validContact)
    expect(result.success).toBe(true)
  })

  it('rejects empty firstName', () => {
    const result = contactSchema.safeParse({ ...validContact, firstName: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path[0] === 'firstName')
      expect(issue?.message).toBe('Nombre requerido')
    }
  })

  it('rejects empty lastName', () => {
    const result = contactSchema.safeParse({ ...validContact, lastName: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path[0] === 'lastName')
      expect(issue?.message).toBe('Apellido requerido')
    }
  })

  it('rejects invalid email', () => {
    const result = contactSchema.safeParse({ ...validContact, email: 'not-an-email' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path[0] === 'email')
      expect(issue).toBeDefined()
    }
  })

  it('rejects empty assignedTo', () => {
    const result = contactSchema.safeParse({ ...validContact, assignedTo: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path[0] === 'assignedTo')
      expect(issue?.message).toBe('Asignado a requerido')
    }
  })

  it('rejects invalid status enum value', () => {
    const result = contactSchema.safeParse({ ...validContact, status: 'unknown' })
    expect(result.success).toBe(false)
  })
})
