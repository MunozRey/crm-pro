import { z } from 'zod'

export const createDealSchema = (availableStages: string[]) => z.object({
  title: z.string().min(1, 'Título requerido'),
  value: z.string().min(1, 'Valor requerido'),
  currency: z.enum(['EUR', 'USD', 'GBP']),
  stage: z.string().min(1, 'Fase requerida').refine((value) => availableStages.includes(value), {
    message: 'Fase inválida',
  }),
  probability: z.string(),
  expectedCloseDate: z.string().min(1, 'Fecha requerida'),
  contactId: z.string(),
  companyId: z.string(),
  assignedTo: z.string().min(1, 'Requerido'),
  priority: z.enum(['low', 'medium', 'high']),
  source: z.string(),
  notes: z.string(),
})

export const dealSchema = createDealSchema(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'])

export type DealFormData = z.infer<typeof dealSchema>
