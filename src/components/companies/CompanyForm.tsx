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
      <Input label="Nombre de empresa" required error={errors.name?.message} {...register('name')} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Dominio" placeholder="empresa.com" {...register('domain')} />
        <Input label="Teléfono" {...register('phone')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Industria"
          required
          options={[
            { value: 'fintech', label: 'Fintech' },
            { value: 'saas', label: 'SaaS' },
            { value: 'consulting', label: 'Consultoría' },
            { value: 'insurance', label: 'Seguros' },
            { value: 'banking', label: 'Banca' },
            { value: 'retail', label: 'Retail' },
            { value: 'healthcare', label: 'Salud' },
            { value: 'other', label: 'Otro' },
          ]}
          {...register('industry')}
        />
        <Select
          label="Tamaño"
          options={COMPANY_SIZE_OPTIONS.map((s) => ({ value: s, label: s }))}
          placeholder="Seleccionar"
          {...register('size')}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="País" {...register('country')} />
        <Input label="Ciudad" {...register('city')} />
      </div>
      <Input label="Website" type="url" placeholder="https://" {...register('website')} />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Estado"
          options={[
            { value: 'prospect', label: 'Prospecto' },
            { value: 'customer', label: 'Cliente' },
            { value: 'partner', label: 'Partner' },
            { value: 'churned', label: 'Perdido' },
          ]}
          {...register('status')}
        />
        <Input label="Facturación (€)" type="number" {...register('revenue')} />
      </div>
      <Textarea label="Notas" rows={3} {...register('notes')} />

      {company && (
        <CustomFieldsForm entityId={company.id} entityType="company" />
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" className="flex-1">
          {company ? 'Guardar cambios' : 'Crear empresa'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}
