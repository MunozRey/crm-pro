import { useState, useRef } from 'react'
import { X, Upload, FileSpreadsheet, ArrowRight, Check, AlertTriangle, Loader2, Download } from 'lucide-react'
import { useContactsStore } from '../../store/contactsStore'
import { useCompaniesStore } from '../../store/companiesStore'
import { useAuditStore } from '../../store/auditStore'
import { toast } from '../../store/toastStore'
import type { ContactStatus, ContactSource } from '../../types'
import { useTranslations } from '../../i18n'

interface CSVImportProps {
  isOpen: boolean
  onClose: () => void
}

type EntityType = 'contacts' | 'companies'
type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done'

const CONTACT_FIELDS = [
  { key: 'firstName', required: true },
  { key: 'lastName', required: true },
  { key: 'email', required: true },
  { key: 'phone', required: false },
  { key: 'jobTitle', required: false },
  { key: 'status', required: false },
  { key: 'source', required: false },
  { key: 'notes', required: false },
]

const COMPANY_FIELDS = [
  { key: 'name', required: true },
  { key: 'domain', required: false },
  { key: 'industry', required: false },
  { key: 'size', required: false },
  { key: 'country', required: false },
  { key: 'city', required: false },
  { key: 'website', required: false },
  { key: 'phone', required: false },
  { key: 'notes', required: false },
]

const CONTACT_TEMPLATE_HEADERS = ['firstName', 'lastName', 'email', 'phone', 'jobTitle', 'status', 'source', 'notes']
const COMPANY_TEMPLATE_HEADERS = ['name', 'domain', 'industry', 'size', 'country', 'city', 'website', 'phone', 'notes']

const CONTACT_HEADER_ALIASES: Record<string, string[]> = {
  firstName: ['firstname', 'nombre', 'first', 'nombrecontacto'],
  lastName: ['lastname', 'apellido', 'surname', 'last'],
  email: ['email', 'correo', 'correoelectronico', 'mail', 'e-mail'],
  phone: ['phone', 'telefono', 'movil', 'celular', 'tel'],
  jobTitle: ['jobtitle', 'cargo', 'puesto', 'rol', 'title'],
  status: ['status', 'estado', 'contactstatus', 'estadolead'],
  source: ['source', 'fuente', 'origen', 'leadsource'],
  notes: ['notes', 'notas', 'comentarios', 'observaciones'],
}

const COMPANY_HEADER_ALIASES: Record<string, string[]> = {
  name: ['name', 'nombre', 'empresa', 'company', 'companyname'],
  domain: ['domain', 'dominio'],
  industry: ['industry', 'industria', 'sector'],
  size: ['size', 'tamano', 'tamaño', 'employees', 'headcount'],
  country: ['country', 'pais', 'país'],
  city: ['city', 'ciudad'],
  website: ['website', 'web', 'sitio', 'sitoweb', 'url'],
  phone: ['phone', 'telefono', 'tel', 'movil', 'celular'],
  notes: ['notes', 'notas', 'comentarios', 'observaciones'],
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s-]/g, '')
    .trim()
}

function downloadCSVTemplate(entityType: EntityType) {
  const rows = entityType === 'contacts'
    ? [
      CONTACT_TEMPLATE_HEADERS,
      ['Juan', 'Perez', 'juan@acme.com', '+34111222333', 'CEO', 'lead', 'website', 'Interesado en demo'],
      ['Laura', 'Gomez', 'laura@beta.io', '+34123456789', 'CTO', 'prospect', 'linkedin', 'Seguimiento en 7 dias'],
    ]
    : [
      COMPANY_TEMPLATE_HEADERS,
      ['Acme SL', 'acme.com', 'technology', '51-200', 'Espana', 'Madrid', 'https://acme.com', '+34911122334', 'Cliente potencial enterprise'],
      ['Beta Labs', 'betalabs.io', 'consulting', '11-50', 'Mexico', 'CDMX', 'https://betalabs.io', '+525511223344', 'Vino por referencia'],
    ]
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `crm-template-${entityType}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if ((char === ',' || char === ';') && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(parseLine).filter((r) => r.some((c) => c))
  return { headers, rows }
}

export function CSVImport({ isOpen, onClose }: CSVImportProps) {
  const t = useTranslations()
  const [step, setStep] = useState<Step>('upload')
  const [entityType, setEntityType] = useState<EntityType>('contacts')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({}) // crmField -> csvHeader
  const [importedCount, setImportedCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const addContact = useContactsStore((s) => s.addContact)
  const addCompany = useCompaniesStore((s) => s.addCompany)

  if (!isOpen) return null

  const fieldLabels: Record<string, string> = {
    firstName: t.contacts.firstName,
    lastName: t.contacts.lastName,
    email: t.common.email,
    phone: t.common.phone,
    jobTitle: t.contacts.jobTitle,
    status: t.common.status,
    source: t.contacts.source,
    notes: t.common.notes,
    name: t.common.name,
    domain: t.companies.domain,
    industry: t.companies.industry,
    size: t.companies.size,
    country: t.companies.country,
    city: t.companies.city,
    website: t.companies.website,
  }
  const fields = (entityType === 'contacts' ? CONTACT_FIELDS : COMPANY_FIELDS).map((f) => ({
    ...f,
    label: fieldLabels[f.key] ?? f.key,
  }))

  const handleFileSelect = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers, rows } = parseCSV(text)
      if (headers.length === 0) {
        toast.error(t.errors.generic)
        return
      }
      setCsvHeaders(headers)
      setCsvRows(rows)

      // Auto-map by matching header names + common aliases.
      const autoMapping: Record<string, string> = {}
      const aliases = entityType === 'contacts' ? CONTACT_HEADER_ALIASES : COMPANY_HEADER_ALIASES
      const normalizedHeaders = headers.map((h) => ({ raw: h, normalized: normalizeHeader(h) }))
      for (const field of fields) {
        const fieldKeyNormalized = normalizeHeader(field.key)
        const fieldLabelNormalized = normalizeHeader(field.label)
        const aliasCandidates = [fieldKeyNormalized, fieldLabelNormalized, ...(aliases[field.key] ?? []).map(normalizeHeader)]
        const uniqueCandidates = Array.from(new Set(aliasCandidates))
        const exact = normalizedHeaders.find((h) => uniqueCandidates.includes(h.normalized))
        const partial = normalizedHeaders.find((h) => uniqueCandidates.some((candidate) => h.normalized.includes(candidate) || candidate.includes(h.normalized)))
        const match = exact?.raw ?? partial?.raw
        if (match) autoMapping[field.key] = match
      }
      setMapping(autoMapping)
      setStep('mapping')
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFileSelect(file)
    } else {
      toast.error(t.errors.generic)
    }
  }

  const requiredFieldsMapped = fields.filter((f) => f.required).every((f) => mapping[f.key])

  const handleImport = async () => {
    setStep('importing')
    let imported = 0
    let errors = 0

    for (const row of csvRows) {
      try {
        const record: Record<string, string> = {}
        for (const [crmField, csvHeader] of Object.entries(mapping)) {
          const colIdx = csvHeaders.indexOf(csvHeader)
          if (colIdx >= 0 && row[colIdx]) {
            record[crmField] = row[colIdx]
          }
        }

        if (entityType === 'contacts') {
          if (!record.firstName || !record.email) {
            errors++
            continue
          }
          addContact({
            firstName: record.firstName,
            lastName: record.lastName || '',
            email: record.email,
            phone: record.phone || '',
            jobTitle: record.jobTitle || '',
            companyId: '',
            status: (['lead', 'prospect', 'customer', 'churned'].includes(record.status) ? record.status : 'lead') as ContactStatus,
            source: (['website', 'referral', 'outbound', 'event', 'linkedin', 'other'].includes(record.source) ? record.source : 'other') as ContactSource,
            tags: [],
            assignedTo: 'user-001',
            notes: record.notes || '',
            linkedDeals: [],
            lastContactedAt: '',
          })
          imported++
        } else {
          if (!record.name) {
            errors++
            continue
          }
          addCompany({
            name: record.name,
            domain: record.domain || '',
            industry: record.industry || 'other',
            size: record.size || '',
            country: record.country || '',
            city: record.city || '',
            website: record.website || '',
            phone: record.phone || '',
            status: 'prospect',
            contacts: [],
            deals: [],
            tags: [],
            notes: record.notes || '',
          } as any)
          imported++
        }
      } catch {
        errors++
      }
    }

    setImportedCount(imported)
    setErrorCount(errors)
    setStep('done')
    useAuditStore.getState().logAction(
      entityType === 'contacts' ? 'contact_created' : 'company_created',
      entityType === 'contacts' ? 'contact' : 'company',
      'bulk-import',
      `Importación CSV: ${imported} ${entityType}`,
      `${imported} importados, ${errors} errores`
    )
  }

  const reset = () => {
    setStep('upload')
    setCsvHeaders([])
    setCsvRows([])
    setMapping({})
    setImportedCount(0)
    setErrorCount(0)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 glass rounded-2xl shadow-float border-white/10 overflow-hidden animate-scale-in max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={18} className="text-brand-400" />
            <span className="text-sm font-semibold text-white">{t.csvImport.title}</span>
            {step !== 'upload' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-slate-400">
                {csvRows.length} {t.csvImport.rows}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="flex gap-2 mb-4">
                {(['contacts', 'companies'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setEntityType(type)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      entityType === type
                        ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                        : 'bg-white/4 text-slate-500 hover:text-white hover:bg-white/8 border border-transparent'
                    }`}
                  >
                    {type === 'contacts' ? t.csvImport.contacts : t.csvImport.companies}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => downloadCSVTemplate(entityType)}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/4 text-slate-300 hover:text-white hover:bg-white/8 border border-white/10 transition-colors"
                >
                  <Download size={12} />
                  {t.csvImport.downloadTemplate}
                </button>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center cursor-pointer hover:border-brand-500/30 hover:bg-white/2 transition-all"
              >
                <Upload size={36} className="mx-auto text-slate-600 mb-3" />
                <p className="text-sm text-slate-300 font-medium">{t.csvImport.dropTitle}</p>
                <p className="text-xs text-slate-500 mt-1">{t.csvImport.dropSubtitle}</p>
                <p className="text-[10px] text-slate-600 mt-3">{t.csvImport.dropHint}</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                }}
              />

              {/* Expected fields */}
              <div className="glass rounded-xl border-white/8 p-4">
                <p className="text-xs font-semibold text-slate-400 mb-2">{t.csvImport.expectedFieldsFor} {entityType === 'contacts' ? t.csvImport.contacts.toLowerCase() : t.csvImport.companies.toLowerCase()}</p>
                <div className="flex flex-wrap gap-1.5">
                  {fields.map((f) => (
                    <span key={f.key} className={`text-[10px] px-2 py-0.5 rounded-full ${f.required ? 'bg-brand-500/15 text-brand-400' : 'bg-white/6 text-slate-500'}`}>
                      {f.label}{f.required ? ' *' : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-300 mb-2">{t.csvImport.mapColumns}</p>
              <div className="space-y-2">
                {fields.map((field) => (
                  <div key={field.key} className="flex items-center gap-3">
                    <div className="w-40 flex-shrink-0">
                      <span className={`text-xs ${field.required ? 'text-brand-400 font-medium' : 'text-slate-400'}`}>
                        {field.label}{field.required ? ' *' : ''}
                      </span>
                    </div>
                    <ArrowRight size={12} className="text-slate-600 flex-shrink-0" />
                    <select
                      value={mapping[field.key] || ''}
                      onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                      className="flex-1 bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-brand-500/40"
                    >
                      <option value="">— {t.csvImport.doNotMap} —</option>
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {!requiredFieldsMapped && (
                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-xl px-3 py-2">
                  <AlertTriangle size={13} />
                  {t.csvImport.requiredFieldsWarning}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button onClick={reset} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/6 transition-colors">
                  {t.csvImport.back}
                </button>
                <button
                  onClick={() => setStep('preview')}
                  disabled={!requiredFieldsMapped}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gradient text-white text-sm font-semibold disabled:opacity-40"
                >
                  {t.csvImport.preview} <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">{t.csvImport.previewRows.replace('{count}', String(Math.min(5, csvRows.length)))}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/8">
                      {fields.filter((f) => mapping[f.key]).map((f) => (
                        <th key={f.key} className="text-left py-2 px-2 text-slate-500 font-medium">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-white/4">
                        {fields.filter((f) => mapping[f.key]).map((f) => {
                          const colIdx = csvHeaders.indexOf(mapping[f.key])
                          return (
                            <td key={f.key} className="py-2 px-2 text-slate-300 truncate max-w-[150px]">
                              {colIdx >= 0 ? row[colIdx] || '—' : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="glass rounded-xl border-white/8 p-3 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {t.csvImport.toImport
                    .replace('{count}', String(csvRows.length))
                    .replace('{entity}', entityType === 'contacts' ? t.csvImport.contacts.toLowerCase() : t.csvImport.companies.toLowerCase())}
                </p>
              </div>

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep('mapping')} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/6 transition-colors">
                  {t.csvImport.back}
                </button>
                <button
                  onClick={handleImport}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl btn-gradient text-white text-sm font-semibold"
                >
                  <Upload size={14} />
                  {t.csvImport.importRecords.replace('{count}', String(csvRows.length))}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="py-12 text-center">
              <Loader2 size={36} className="mx-auto text-brand-400 animate-spin mb-4" />
              <p className="text-sm text-slate-300">{t.csvImport.importing}</p>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 'done' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                <Check size={28} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{t.csvImport.completed}</p>
                <p className="text-sm text-slate-400 mt-1">
                  {t.csvImport.importedSummary
                    .replace('{imported}', String(importedCount))
                    .replace('{errors}', String(errorCount))}
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button onClick={() => { reset(); }} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/6 transition-colors">
                  {t.csvImport.importMore}
                </button>
                <button onClick={onClose} className="px-5 py-2 rounded-xl btn-gradient text-white text-sm font-semibold">
                  {t.csvImport.close}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
