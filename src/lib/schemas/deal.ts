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
