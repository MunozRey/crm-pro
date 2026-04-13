---
phase: 09-test-suite
plan: 3
title: "Extract Zod Schemas + Write Schema Tests"
goal: "Extract the three inline Zod schemas from component files into src/lib/schemas/, update component imports, and write schema unit tests using the Zod v4 .error.issues API."
wave: 2
dependencies: [1]
requirements: [TEST-03]
---

# Plan 09-3: Extract Zod Schemas + Write Schema Tests

## Goal

The ContactForm, DealForm, and ActivityForm schemas are currently defined as unexported `const` values inside their `.tsx` files. They cannot be imported into test files without pulling in React, hooks, and router context. This plan extracts each schema to a dedicated `src/lib/schemas/` file, updates the component import, and writes tests for all three schemas.

## Context

Current locations (verified from source):
- `src/components/contacts/ContactForm.tsx` — `const contactSchema = z.object({...})` at approximately line 13, not exported
- `src/components/deals/DealForm.tsx` — `const dealSchema = z.object({...})` at approximately line 13, not exported
- `src/components/activities/ActivityForm.tsx` — `const activitySchema = z.object({...})` at approximately line 13, not exported

The project uses `zod@4.3.6`. In Zod v4, the `.safeParse()` return value uses `.error.issues` (NOT `.error.errors` — that was the Zod v3 API). Every assertion in test files must use `.error.issues`.

The `tests/schemas/` directory does not exist yet — create it as part of this plan.

## Tasks

### Task 1: Extract schemas to src/lib/schemas/

Create the directory `src/lib/schemas/` and three schema files. Copy the exact schema definition from each component file verbatim. Export the schema as a named export.

**src/lib/schemas/contact.ts**

```typescript
import { z } from 'zod'

export const contactSchema = z.object({
  firstName: z.string().min(1, 'Nombre requerido'),
  lastName: z.string().min(1, 'Apellido requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string(),
  jobTitle: z.string(),
  companyId: z.string(),
  status: z.enum(['prospect', 'customer', 'churned']),
  source: z.enum(['website', 'referral', 'outbound', 'event', 'linkedin', 'other']),
  assignedTo: z.string().min(1, 'Asignado a requerido'),
  notes: z.string(),
})

export type ContactFormData = z.infer<typeof contactSchema>
```

**src/lib/schemas/deal.ts**

```typescript
import { z } from 'zod'

export const dealSchema = z.object({
  title: z.string().min(1, 'Título requerido'),
  value: z.string().min(1, 'Valor requerido'),
  currency: z.enum(['EUR', 'USD', 'GBP']),
  stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
  probability: z.string(),
  expectedCloseDate: z.string().min(1, 'Fecha requerida'),
  contactId: z.string(),
  companyId: z.string(),
  assignedTo: z.string().min(1, 'Requerido'),
  priority: z.enum(['low', 'medium', 'high']),
  source: z.string(),
  notes: z.string(),
})

export type DealFormData = z.infer<typeof dealSchema>
```

**src/lib/schemas/activity.ts**

```typescript
import { z } from 'zod'

export const activitySchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'note', 'task', 'linkedin']),
  subject: z.string().min(1, 'Asunto requerido'),
  description: z.string(),
  outcome: z.string(),
  dueDate: z.string(),
  status: z.enum(['pending', 'completed', 'cancelled']),
  contactId: z.string(),
  dealId: z.string(),
  createdBy: z.string().min(1, 'Requerido'),
})

export type ActivityFormData = z.infer<typeof activitySchema>
```

IMPORTANT: Before writing these files, open the original component files and read the actual schema definition to ensure the extracted version is byte-for-byte identical. If any field differs from the definitions shown above (the research was verified from source but the source may have since changed), use whatever is in the component file — do NOT use the versions above if they differ.

Files created:
- `src/lib/schemas/contact.ts`
- `src/lib/schemas/deal.ts`
- `src/lib/schemas/activity.ts`

### Task 2: Update component imports

In each of the three component files, remove the local `const schema = z.object({...})` declaration and replace it with an import from the new schema file.

**src/components/contacts/ContactForm.tsx**

Remove:
```typescript
const contactSchema = z.object({ ... })
```

Add at the top (after existing imports):
```typescript
import { contactSchema } from '../../lib/schemas/contact'
```

If the component file also imports `z` from `'zod'` only for the schema, and there are no other `z.` usages in the file, remove the `zod` import too. If `z` is used elsewhere in the file, keep the import.

Apply the same pattern to:
- `src/components/deals/DealForm.tsx` — import `dealSchema` from `'../../lib/schemas/deal'`
- `src/components/activities/ActivityForm.tsx` — import `activitySchema` from `'../../lib/schemas/activity'`

The rest of each component file is untouched. The schema variable names (`contactSchema`, `dealSchema`, `activitySchema`) are preserved, so any `useForm<z.infer<typeof contactSchema>>` or `resolver: zodResolver(contactSchema)` calls continue to work without further changes.

Files modified:
- `src/components/contacts/ContactForm.tsx`
- `src/components/deals/DealForm.tsx`
- `src/components/activities/ActivityForm.tsx`

### Task 3: Write schema tests

Create three test files in `tests/schemas/`.

**tests/schemas/contact.test.ts**

```typescript
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
```

**tests/schemas/deal.test.ts**

```typescript
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
```

**tests/schemas/activity.test.ts**

```typescript
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
```

Files created:
- `tests/schemas/contact.test.ts`
- `tests/schemas/deal.test.ts`
- `tests/schemas/activity.test.ts`

## Verification

1. Verify the app still builds (no broken imports in the components):

   ```bash
   cd C:/Users/david/OneDrive/Escritorio/Development/CRM && npx tsc --noEmit
   ```

   Expected: 0 errors.

2. Run schema tests in isolation:

   ```bash
   cd C:/Users/david/OneDrive/Escritorio/Development/CRM && npx vitest run tests/schemas/
   ```

   Expected: all schema tests pass.

3. Run full suite to confirm no regressions:

   ```bash
   cd C:/Users/david/OneDrive/Escritorio/Development/CRM && npx vitest run
   ```

   Expected: all tests pass (19 original + new schema tests), 0 failed.

## Success Criteria

- `src/lib/schemas/contact.ts`, `src/lib/schemas/deal.ts`, `src/lib/schemas/activity.ts` exist with named exports
- Each component file imports its schema from `src/lib/schemas/` instead of defining it inline
- `npx tsc --noEmit` exits 0 (no broken imports)
- All schema tests pass — valid payloads return `success: true`, required-field violations return `success: false` with the correct Spanish error message in `result.error.issues`
- No test uses `.error.errors` (Zod v3 API) — all use `.error.issues`
