import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { activitySchema } from '../../lib/schemas/activity'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import type { Activity } from '../../types'
import { useContactsStore } from '../../store/contactsStore'
import { useDealsStore } from '../../store/dealsStore'
import { useAuthStore } from '../../store/authStore'

type FormValues = z.infer<typeof activitySchema>

interface ActivityFormProps {
  activity?: Activity
  defaultContactId?: string
  defaultDealId?: string
  onSubmit: (data: Omit<Activity, 'id' | 'createdAt'>) => void
  onCancel: () => void
}

export function ActivityForm({ activity, defaultContactId, defaultDealId, onSubmit, onCancel }: ActivityFormProps) {
  const contacts = useContactsStore((s) => s.contacts)
  const deals = useDealsStore((s) => s.deals)
  const orgUsers = useAuthStore((s) => s.users)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      type: activity?.type ?? 'call',
      subject: activity?.subject ?? '',
      description: activity?.description ?? '',
      outcome: activity?.outcome ?? '',
      dueDate: activity?.dueDate ?? '',
      status: activity?.status ?? 'pending',
      contactId: activity?.contactId ?? defaultContactId ?? '',
      dealId: activity?.dealId ?? defaultDealId ?? '',
      createdBy: activity?.createdBy ?? (orgUsers[0]?.name ?? ''),
    },
  })

  const handleFormSubmit = (data: FormValues) => {
    onSubmit({
      type: data.type,
      subject: data.subject,
      description: data.description,
      outcome: data.outcome || undefined,
      dueDate: data.dueDate || undefined,
      status: data.status,
      contactId: data.contactId || undefined,
      dealId: data.dealId || undefined,
      createdBy: data.createdBy,
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Tipo"
          required
          options={[
            { value: 'call', label: 'Llamada' },
            { value: 'email', label: 'Email' },
            { value: 'meeting', label: 'Reunión' },
            { value: 'note', label: 'Nota' },
            { value: 'task', label: 'Tarea' },
            { value: 'linkedin', label: 'LinkedIn' },
          ]}
          error={errors.type?.message}
          {...register('type')}
        />
        <Select
          label="Estado"
          required
          options={[
            { value: 'pending', label: 'Pendiente' },
            { value: 'completed', label: 'Completada' },
            { value: 'cancelled', label: 'Cancelada' },
          ]}
          {...register('status')}
        />
      </div>

      <Input label="Asunto" required error={errors.subject?.message} {...register('subject')} />
      <Textarea label="Descripción" rows={3} {...register('description')} />
      <Input label="Resultado / Outcome" {...register('outcome')} />
      <Input label="Fecha límite" type="date" {...register('dueDate')} />

      <Select
        label="Contacto"
        options={[
          { value: '', label: 'Sin contacto' },
          ...contacts.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
        ]}
        {...register('contactId')}
      />

      <Select
        label="Deal"
        options={[
          { value: '', label: 'Sin deal' },
          ...deals.map((d) => ({ value: d.id, label: d.title })),
        ]}
        {...register('dealId')}
      />

      <Select
        label="Creado por"
        required
        options={orgUsers.map((u) => ({ value: u.name, label: u.name }))}
        {...register('createdBy')}
      />

      <div className="flex gap-3 pt-2">
        <Button type="submit" className="flex-1">
          {activity ? 'Guardar cambios' : 'Crear actividad'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}
