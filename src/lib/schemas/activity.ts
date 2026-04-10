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
