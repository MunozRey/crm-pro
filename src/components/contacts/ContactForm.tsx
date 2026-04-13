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
import { useTranslations } from '../../i18n'

type FormValues = z.infer<typeof contactSchema>

interface ContactFormProps {
  contact?: Contact
  onSubmit: (data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'linkedDeals' | 'lastContactedAt'>) => void
  onCancel: () => void
  isLoading?: boolean
}

export function ContactForm({ contact, onSubmit, onCancel, isLoading }: ContactFormProps) {
  const t = useTranslations()
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
        <Input label={t.contacts.firstName} required error={errors.firstName?.message} {...register('firstName')} />
        <Input label={t.contacts.lastName} required error={errors.lastName?.message} {...register('lastName')} />
      </div>
      <Input label={t.common.email} type="email" required error={errors.email?.message} {...register('email')} />
      <Input label={t.common.phone} type="tel" {...register('phone')} />
      <Input label={t.contacts.jobTitle} {...register('jobTitle')} />

      <Select
        label={t.contacts.company}
        options={[
          { value: '', label: t.contacts.noCompany },
          ...companies.map((c) => ({ value: c.id, label: c.name })),
        ]}
        {...register('companyId')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label={t.common.status}
          required
          options={[
            { value: 'prospect', label: t.contacts.statusLabels.prospect },
            { value: 'customer', label: t.contacts.statusLabels.customer },
            { value: 'churned', label: t.contacts.statusLabels.churned },
          ]}
          error={errors.status?.message}
          {...register('status')}
        />
        <Select
          label={t.contacts.source}
          required
          options={[
            { value: 'website', label: t.contacts.sourceLabels.website },
            { value: 'referral', label: t.contacts.sourceLabels.referral },
            { value: 'outbound', label: t.contacts.sourceLabels.outbound },
            { value: 'event', label: t.contacts.sourceLabels.event },
            { value: 'linkedin', label: t.contacts.sourceLabels.linkedin },
            { value: 'other', label: t.contacts.sourceLabels.other },
          ]}
          error={errors.source?.message}
          {...register('source')}
        />
      </div>

      <Select
        label={t.common.assignedTo}
        required
        options={orgUsers.map((u) => ({ value: u.name, label: u.name }))}
        error={errors.assignedTo?.message}
        {...register('assignedTo')}
      />

      <Textarea label={t.common.notes} rows={3} {...register('notes')} />

      {contact && (
        <CustomFieldsForm entityId={contact.id} entityType="contact" />
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isLoading} className="flex-1">
          {contact ? t.common.save : t.contacts.createContact}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  )
}
