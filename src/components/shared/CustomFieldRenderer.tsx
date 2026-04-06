import { useState, useEffect, useMemo } from 'react'
import type { CustomFieldDefinition, CustomFieldValue, CustomFieldEntityType } from '../../types'
import { useCustomFieldsStore } from '../../store/customFieldsStore'

// ─── Display component (read-only) ──────────────────────────────────────────

export function CustomFieldsDisplay({ entityId, entityType }: { entityId: string; entityType: CustomFieldEntityType }) {
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([])
  const [values, setValues] = useState<CustomFieldValue[]>([])

  useEffect(() => {
    const compute = () => {
      setDefinitions(useCustomFieldsStore.getState().getActiveDefinitionsForEntity(entityType))
      setValues(useCustomFieldsStore.getState().getFieldValues(entityId))
    }
    compute()
    return useCustomFieldsStore.subscribe(compute)
  }, [entityId, entityType])

  const filledFields = useMemo(() => {
    return definitions
      .map((def) => {
        const fv = values.find((v) => v.fieldId === def.id)
        return { def, value: fv?.value ?? null }
      })
      .filter(({ value }) => value !== null && value !== '' && value !== false && !(Array.isArray(value) && value.length === 0))
  }, [definitions, values])

  if (filledFields.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
      {filledFields.map(({ def, value }) => (
        <div key={def.id}>
          <p className="text-xs text-slate-500">{def.label}</p>
          <p className="text-sm text-slate-200 font-medium">
            <FieldValueDisplay def={def} value={value} />
          </p>
        </div>
      ))}
    </div>
  )
}

function FieldValueDisplay({ def, value }: { def: CustomFieldDefinition; value: CustomFieldValue['value'] }) {
  if (value === null || value === '') return <span className="text-slate-600">—</span>

  switch (def.fieldType) {
    case 'checkbox':
      return <span>{value ? 'Sí' : 'No'}</span>
    case 'url':
      return (
        <a href={String(value)} target="_blank" rel="noopener noreferrer"
          className="text-brand-400 hover:text-brand-300 truncate block" onClick={(e) => e.stopPropagation()}>
          {String(value).replace(/^https?:\/\//, '')}
        </a>
      )
    case 'email':
      return <span className="text-brand-400">{String(value)}</span>
    case 'currency':
      return <span>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value))}</span>
    case 'date':
      return <span>{new Date(String(value)).toLocaleDateString('es-ES')}</span>
    case 'multiselect':
      return (
        <span className="flex flex-wrap gap-1">
          {(Array.isArray(value) ? value : []).map((v) => (
            <span key={v} className="px-1.5 py-0.5 rounded text-[10px] bg-white/6 border border-white/10 text-slate-300">{v}</span>
          ))}
        </span>
      )
    default:
      return <span>{String(value)}</span>
  }
}

// ─── Form component (editable) ──────────────────────────────────────────────

export function CustomFieldsForm({ entityId, entityType }: { entityId: string; entityType: CustomFieldEntityType }) {
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, CustomFieldValue['value']>>({})

  useEffect(() => {
    const compute = () => {
      const defs = useCustomFieldsStore.getState().getActiveDefinitionsForEntity(entityType)
      setDefinitions(defs)
      const vals = useCustomFieldsStore.getState().getFieldValues(entityId)
      const map: Record<string, CustomFieldValue['value']> = {}
      for (const v of vals) {
        map[v.fieldId] = v.value
      }
      setFieldValues(map)
    }
    compute()
    return useCustomFieldsStore.subscribe(compute)
  }, [entityId, entityType])

  const handleChange = (fieldId: string, value: CustomFieldValue['value']) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }))
    useCustomFieldsStore.getState().setFieldValue(entityId, fieldId, value)
  }

  if (definitions.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Campos personalizados</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {definitions.map((def) => (
          <FieldInput
            key={def.id}
            definition={def}
            value={fieldValues[def.id] ?? null}
            onChange={(v) => handleChange(def.id, v)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Single field input ─────────────────────────────────────────────────────

function FieldInput({
  definition: def,
  value,
  onChange,
}: {
  definition: CustomFieldDefinition
  value: CustomFieldValue['value']
  onChange: (v: CustomFieldValue['value']) => void
}) {
  const base = 'w-full bg-[#0d0e1a] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500/50'
  const selectBase = `${base} appearance-none`

  switch (def.fieldType) {
    case 'text':
    case 'email':
    case 'url':
      return (
        <div>
          <label className="text-xs text-slate-500 mb-1 block">{def.label}{def.required && <span className="text-red-400">*</span>}</label>
          <input
            type={def.fieldType === 'email' ? 'email' : def.fieldType === 'url' ? 'url' : 'text'}
            value={String(value ?? '')}
            placeholder={def.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={base}
          />
        </div>
      )

    case 'textarea':
      return (
        <div className="col-span-2">
          <label className="text-xs text-slate-500 mb-1 block">{def.label}{def.required && <span className="text-red-400">*</span>}</label>
          <textarea
            value={String(value ?? '')}
            placeholder={def.placeholder}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            className={`${base} resize-none`}
          />
        </div>
      )

    case 'number':
    case 'currency':
      return (
        <div>
          <label className="text-xs text-slate-500 mb-1 block">{def.label}{def.required && <span className="text-red-400">*</span>}</label>
          <input
            type="number"
            step={def.fieldType === 'currency' ? '0.01' : '1'}
            value={value !== null ? Number(value) : ''}
            placeholder={def.placeholder}
            onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
            className={base}
          />
        </div>
      )

    case 'date':
      return (
        <div>
          <label className="text-xs text-slate-500 mb-1 block">{def.label}{def.required && <span className="text-red-400">*</span>}</label>
          <input
            type="date"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || null)}
            className={base}
          />
        </div>
      )

    case 'select':
      return (
        <div>
          <label className="text-xs text-slate-500 mb-1 block">{def.label}{def.required && <span className="text-red-400">*</span>}</label>
          <select
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || null)}
            className={selectBase}
          >
            <option value="">Seleccionar...</option>
            {(def.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      )

    case 'multiselect': {
      const selected = Array.isArray(value) ? value : []
      const toggle = (opt: string) => {
        onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt])
      }
      return (
        <div className="col-span-2">
          <label className="text-xs text-slate-500 mb-1 block">{def.label}{def.required && <span className="text-red-400">*</span>}</label>
          <div className="flex flex-wrap gap-1.5">
            {(def.options || []).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                  selected.includes(opt)
                    ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                    : 'bg-white/4 border-white/8 text-slate-400 hover:text-slate-200 hover:bg-white/6'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )
    }

    case 'checkbox':
      return (
        <div className="flex items-center gap-2 col-span-2">
          <button
            type="button"
            onClick={() => onChange(!value)}
            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
              value ? 'bg-brand-500 border-brand-500' : 'bg-white/4 border-white/10'
            }`}
          >
            {value && <span className="text-white text-xs font-bold">✓</span>}
          </button>
          <label className="text-sm text-slate-300">{def.label}</label>
        </div>
      )

    default:
      return null
  }
}
