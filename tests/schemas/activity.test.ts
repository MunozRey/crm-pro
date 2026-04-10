import { describe, it, expect } from 'vitest'
import { activitySchema } from '../../src/lib/schemas/activity'

const validActivity = {
  type: 'call' as const,
  subject: 'Follow-up call',
  description: '',
  outcome: '',
  dueDate: '',
  status: 'pending' as const,
  contactId: '',
  dealId: '',
  createdBy: 'user-1',
}

describe('activitySchema', () => {
  it('accepts a valid activity payload', () => {
    const result = activitySchema.safeParse(validActivity)
    expect(result.success).toBe(true)
  })

  it('rejects empty subject', () => {
    const result = activitySchema.safeParse({ ...validActivity, subject: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path[0] === 'subject')
      expect(issue?.message).toBe('Asunto requerido')
    }
  })

  it('rejects empty createdBy', () => {
    const result = activitySchema.safeParse({ ...validActivity, createdBy: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path[0] === 'createdBy')
      expect(issue?.message).toBe('Requerido')
    }
  })

  it('rejects invalid type enum value', () => {
    const result = activitySchema.safeParse({ ...validActivity, type: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status enum value', () => {
    const result = activitySchema.safeParse({ ...validActivity, status: 'unknown' })
    expect(result.success).toBe(false)
  })
})
