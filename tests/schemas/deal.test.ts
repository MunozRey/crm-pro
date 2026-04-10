import { describe, it, expect } from 'vitest'
import { dealSchema } from '../../src/lib/schemas/deal'

const validDeal = {
  title: 'Big Contract',
  value: '5000',
  currency: 'EUR' as const,
  stage: 'lead' as const,
  probability: '20',
  expectedCloseDate: '2026-06-01',
  contactId: '',
  companyId: '',
  assignedTo: 'user-1',
  priority: 'medium' as const,
  source: '',
  notes: '',
}

describe('dealSchema', () => {
  it('accepts a valid deal payload', () => {
    const result = dealSchema.safeParse(validDeal)
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = dealSchema.safeParse({ ...validDeal, title: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path[0] === 'title')
      expect(issue?.message).toBe('Título requerido')
    }
  })

  it('rejects empty value', () => {
    const result = dealSchema.safeParse({ ...validDeal, value: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path[0] === 'value')
      expect(issue?.message).toBe('Valor requerido')
    }
  })

  it('rejects empty expectedCloseDate', () => {
    const result = dealSchema.safeParse({ ...validDeal, expectedCloseDate: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path[0] === 'expectedCloseDate')
      expect(issue?.message).toBe('Fecha requerida')
    }
  })

  it('rejects empty assignedTo', () => {
    const result = dealSchema.safeParse({ ...validDeal, assignedTo: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path[0] === 'assignedTo')
      expect(issue?.message).toBe('Requerido')
    }
  })

  it('rejects invalid stage enum value', () => {
    const result = dealSchema.safeParse({ ...validDeal, stage: 'unknown' })
    expect(result.success).toBe(false)
  })
})
