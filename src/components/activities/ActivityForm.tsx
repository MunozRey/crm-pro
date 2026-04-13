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
import { useTranslations } from '../../i18n'

type FormValues = z.infer<typeof activitySchema>

interface ActivityFormProps {
  activity?: Activity
  defaultContactId?: string
  defaultDealId?: string
  onSubmit: (data: Omit<Activity, 'id' | 'createdAt'>) => void
  onCancel: () => void
}

export function ActivityForm({ activity, defaultContactId, defaultDealId, onSubmit, onCancel }: ActivityFormProps) {
  const t = useTranslations()
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
          label={t.common.type}
          required
          options={[
            { value: 'call', label: t.activities.typeLabels.call },
            { value: 'email', label: t.activities.typeLabels.email },
            { value: 'meeting', label: t.activities.typeLabels.meeting },
            { value: 'note', label: t.activities.typeLabels.note },
            { value: 'task', label: t.activities.typeLabels.task },
            { value: 'linkedin', label: t.activities.typeLabels.linkedin },
          ]}
          error={errors.type?.message}
          {...register('type')}
        />
        <Select
          label={t.common.status}
          required
          options={[
            { value: 'pending', label: t.activities.statusLabels.pending },
            { value: 'completed', label: t.activities.statusLabels.completed },
            { value: 'cancelled', label: t.activities.statusLabels.cancelled },
          ]}
          {...register('status')}
        />
      </div>

      <Input label={t.activities.subject} required error={errors.subject?.message} {...register('subject')} />
      <Textarea label={t.common.description} rows={3} {...register('description')} />
      <Input label={t.activities.outcome} {...register('outcome')} />
      <Input label={t.activities.dueDate} type="date" {...register('dueDate')} />

      <Select
        label={t.contacts.title}
        options={[
          { value: '', label: t.common.noResults },
          ...contacts.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
        ]}
        {...register('contactId')}
      />

      <Select
        label={t.deals.title}
        options={[
          { value: '', label: t.common.noResults },
          ...deals.map((d) => ({ value: d.id, label: d.title })),
        ]}
        {...register('dealId')}
      />

      <Select
        label={t.common.assignedTo}
        required
        options={orgUsers.map((u) => ({ value: u.name, label: u.name }))}
        {...register('createdBy')}
      />

      <div className="flex gap-3 pt-2">
        <Button type="submit" className="flex-1">
          {activity ? t.common.save : t.activities.newActivity}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t.common.cancel}</Button>
      </div>
    </form>
  )
}
