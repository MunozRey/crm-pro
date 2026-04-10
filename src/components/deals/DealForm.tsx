import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { dealSchema } from '../../lib/schemas/deal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import type { Deal } from '../../types'
import { useContactsStore } from '../../store/contactsStore'
import { useAuthStore } from '../../store/authStore'
import { useCompaniesStore } from '../../store/companiesStore'

type FormValues = z.infer<typeof dealSchema>

interface DealFormProps {
  deal?: Deal
  onSubmit: (data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'activities'>) => void
  onCancel: () => void
}

export function DealForm({ deal, onSubmit, onCancel }: DealFormProps) {
  const contacts = useContactsStore((s) => s.contacts)
  const companies = useCompaniesStore((s) => s.companies)
  const orgUsers = useAuthStore((s) => s.users)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: deal?.title ?? '',
      value: deal?.value?.toString() ?? '',
      currency: deal?.currency ?? 'EUR',
      stage: deal?.stage ?? 'lead',
      probability: deal?.probability?.toString() ?? '10',
      expectedCloseDate: deal?.expectedCloseDate ?? '',
      contactId: deal?.contactId ?? '',
      companyId: deal?.companyId ?? '',
      assignedTo: deal?.assignedTo ?? (orgUsers[0]?.name ?? ''),
      priority: deal?.priority ?? 'medium',
      source: deal?.source ?? '',
      notes: deal?.notes ?? '',
    },
  })

  const handleFormSubmit = (data: FormValues) => {
    onSubmit({
      title: data.title,
      value: Number(data.value),
      currency: data.currency,
      stage: data.stage,
      probability: Number(data.probability),
      expectedCloseDate: data.expectedCloseDate,
      contactId: data.contactId,
      companyId: data.companyId,
      assignedTo: data.assignedTo,
      priority: data.priority,
      source: data.source,
      notes: data.notes,
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4">
      <Input label="Título del deal" required error={errors.title?.message} {...register('title')} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Valor" type="number" required error={errors.value?.message} {...register('value')} />
        <Select
          label="Moneda"
          options={[{ value: 'EUR', label: 'EUR €' }, { value: 'USD', label: 'USD $' }, { value: 'GBP', label: 'GBP £' }]}
          {...register('currency')}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Etapa"
          options={[
            { value: 'lead', label: 'Lead' },
            { value: 'qualified', label: 'Calificado' },
            { value: 'proposal', label: 'Propuesta' },
            { value: 'negotiation', label: 'Negociación' },
            { value: 'closed_won', label: 'Ganado' },
            { value: 'closed_lost', label: 'Perdido' },
          ]}
          {...register('stage')}
        />
        <Select
          label="Prioridad"
          options={[
            { value: 'low', label: 'Baja' },
            { value: 'medium', label: 'Media' },
            { value: 'high', label: 'Alta' },
          ]}
          {...register('priority')}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Probabilidad (%)" type="number" min="0" max="100" {...register('probability')} />
        <Input label="Fecha cierre estimada" type="date" required error={errors.expectedCloseDate?.message} {...register('expectedCloseDate')} />
      </div>
      <Select
        label="Contacto"
        options={[{ value: '', label: 'Sin contacto' }, ...contacts.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))]}
        {...register('contactId')}
      />
      <Select
        label="Empresa"
        options={[{ value: '', label: 'Sin empresa' }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
        {...register('companyId')}
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Asignado a"
          required
          options={orgUsers.map((u) => ({ value: u.name, label: u.name }))}
          {...register('assignedTo')}
        />
        <Input label="Fuente" placeholder="referral, outbound..." {...register('source')} />
      </div>
      <Textarea label="Notas" rows={3} {...register('notes')} />
      <div className="flex gap-3 pt-2">
        <Button type="submit" className="flex-1">{deal ? 'Guardar cambios' : 'Crear deal'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}
