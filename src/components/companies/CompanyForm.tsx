import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import type { Company } from '../../types'
import { COMPANY_SIZE_OPTIONS } from '../../utils/constants'
import { CustomFieldsForm } from '../shared/CustomFieldRenderer'
import { useTranslations } from '../../i18n'

const schema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  domain: z.string(),
  industry: z.enum(['fintech', 'saas', 'consulting', 'insurance', 'banking', 'retail', 'healthcare', 'other']),
  size: z.string(),
  country: z.string(),
  city: z.string(),
  website: z.string(),
  phone: z.string(),
  status: z.enum(['prospect', 'customer', 'partner', 'churned']),
  revenue: z.string(),
  notes: z.string(),
})

type FormValues = z.infer<typeof schema>

interface CompanyFormProps {
  company?: Company
  onSubmit: (data: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'contacts' | 'deals' | 'tags'>) => void
  onCancel: () => void
}

export function CompanyForm({ company, onSubmit, onCancel }: CompanyFormProps) {
  const t = useTranslations()
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: company?.name ?? '',
      domain: company?.domain ?? '',
      industry: company?.industry ?? 'saas',
      size: company?.size ?? '',
      country: company?.country ?? '',
      city: company?.city ?? '',
      website: company?.website ?? '',
      phone: company?.phone ?? '',
      status: company?.status ?? 'prospect',
      revenue: company?.revenue?.toString() ?? '',
      notes: company?.notes ?? '',
    },
  })

  const handleFormSubmit = (data: FormValues) => {
    onSubmit({
      ...data,
      revenue: data.revenue ? Number(data.revenue) : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4">
      <Input label={t.companies.name} required error={errors.name?.message} {...register('name')} />
      <div className="grid grid-cols-2 gap-4">
        <Input label={t.companies.domain} placeholder={t.companies.domainPlaceholder} {...register('domain')} />
        <Input label={t.common.phone} {...register('phone')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label={t.companies.industry}
          required
          options={[
            { value: 'fintech', label: t.companies.industryLabels.fintech },
            { value: 'saas', label: t.companies.industryLabels.saas },
            { value: 'consulting', label: t.companies.industryLabels.consulting },
            { value: 'insurance', label: t.companies.industryLabels.insurance },
            { value: 'banking', label: t.companies.industryLabels.banking },
            { value: 'retail', label: t.companies.industryLabels.retail },
            { value: 'healthcare', label: t.companies.industryLabels.healthcare },
            { value: 'other', label: t.companies.industryLabels.other },
          ]}
          {...register('industry')}
        />
        <Select
          label={t.companies.size}
          options={COMPANY_SIZE_OPTIONS.map((s) => ({ value: s, label: s }))}
          placeholder={t.common.select}
          {...register('size')}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label={t.companies.country} {...register('country')} />
        <Input label={t.companies.city} {...register('city')} />
      </div>
      <Input label={t.companies.website} type="url" placeholder="https://" {...register('website')} />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label={t.common.status}
          options={[
            { value: 'prospect', label: t.companies.statusLabels.prospect },
            { value: 'customer', label: t.companies.statusLabels.customer },
            { value: 'partner', label: t.companies.statusLabels.partner },
            { value: 'churned', label: t.companies.statusLabels.churned },
          ]}
          {...register('status')}
        />
        <Input label={t.companies.revenue} type="number" {...register('revenue')} />
      </div>
      <Textarea label={t.common.notes} rows={3} {...register('notes')} />

      {company && (
        <CustomFieldsForm entityId={company.id} entityType="company" />
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" className="flex-1">
          {company ? t.common.save : t.companies.newCompany}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t.common.cancel}</Button>
      </div>
    </form>
  )
}
