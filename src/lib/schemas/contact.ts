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
