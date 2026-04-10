import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { contactSchema } from '../../lib/schemas/contact'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import type { Contact } from '../../types'
import { useCompaniesStore } from '../../store/companiesStore'
import { useAuthStore } from '../../store/authStore'
import { CustomFieldsForm } from '../shared/CustomFieldRenderer'

type FormValues = z.infer<typeof contactSchema>

interface ContactFormProps {
  contact?: Contact
  onSubmit: (data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'linkedDeals' | 'lastContactedAt'>) => void
  onCancel: () => void
  isLoading?: boolean
}

export function ContactForm({ contact, onSubmit, onCancel, isLoading }: ContactFormProps) {
  const companies = useCompaniesStore((s) => s.companies)
  const orgUsers = useAuthStore((s) => s.users)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: contact?.firstName ?? '',
      lastName: contact?.lastName ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      jobTitle: contact?.jobTitle ?? '',
      companyId: contact?.companyId ?? '',
      status: contact?.status ?? 'prospect',
      source: contact?.source ?? 'website',
      assignedTo: contact?.assignedTo ?? (orgUsers[0]?.name ?? ''),
      notes: contact?.notes ?? '',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Nombre" required error={errors.firstName?.message} {...register('firstName')} />
        <Input label="Apellido" required error={errors.lastName?.message} {...register('lastName')} />
      </div>
      <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />
      <Input label="Teléfono" type="tel" {...register('phone')} />
      <Input label="Cargo" {...register('jobTitle')} />

      <Select
        label="Empresa"
        options={[
          { value: '', label: 'Sin empresa' },
          ...companies.map((c) => ({ value: c.id, label: c.name })),
        ]}
        {...register('companyId')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Estado"
          required
          options={[
            { value: 'prospect', label: 'Prospecto' },
            { value: 'customer', label: 'Cliente' },
            { value: 'churned', label: 'Perdido' },
          ]}
          error={errors.status?.message}
          {...register('status')}
        />
        <Select
          label="Fuente"
          required
          options={[
            { value: 'website', label: 'Web' },
            { value: 'referral', label: 'Referido' },
            { value: 'outbound', label: 'Outbound' },
            { value: 'event', label: 'Evento' },
            { value: 'linkedin', label: 'LinkedIn' },
            { value: 'other', label: 'Otro' },
          ]}
          error={errors.source?.message}
          {...register('source')}
        />
      </div>

      <Select
        label="Asignado a"
        required
        options={orgUsers.map((u) => ({ value: u.name, label: u.name }))}
        error={errors.assignedTo?.message}
        {...register('assignedTo')}
      />

      <Textarea label="Notas" rows={3} {...register('notes')} />

      {contact && (
        <CustomFieldsForm entityId={contact.id} entityType="contact" />
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isLoading} className="flex-1">
          {contact ? 'Guardar cambios' : 'Crear contacto'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
