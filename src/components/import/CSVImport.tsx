import { useState, useRef } from 'react'
import { X, Upload, FileSpreadsheet, ArrowRight, Check, AlertTriangle, Loader2 } from 'lucide-react'
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
  { key: 'firstName', label: 'Nombre', required: true },
  { key: 'lastName', label: 'Apellido', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Teléfono', required: false },
  { key: 'jobTitle', label: 'Cargo', required: false },
  { key: 'status', label: 'Estado (lead/prospect/customer/churned)', required: false },
  { key: 'source', label: 'Fuente (website/referral/outbound/event/linkedin/other)', required: false },
  { key: 'notes', label: 'Notas', required: false },
]

const COMPANY_FIELDS = [
  { key: 'name', label: 'Nombre', required: true },
  { key: 'domain', label: 'Dominio', required: false },
  { key: 'industry', label: 'Industria', required: false },
  { key: 'size', label: 'Tamaño', required: false },
  { key: 'country', label: 'País', required: false },
  { key: 'city', label: 'Ciudad', required: false },
  { key: 'website', label: 'Website', required: false },
  { key: 'phone', label: 'Teléfono', required: false },
  { key: 'notes', label: 'Notas', required: false },
]

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

  const fields = entityType === 'contacts' ? CONTACT_FIELDS : COMPANY_FIELDS

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

      // Auto-map by matching header names
      const autoMapping: Record<string, string> = {}
      for (const field of fields) {
        const match = headers.find((h) =>
          h.toLowerCase().replace(/[_\s-]/g, '') === field.key.toLowerCase().replace(/[_\s-]/g, '') ||
          h.toLowerCase().includes(field.label.toLowerCase())
        )
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
            <span className="text-sm font-semibold text-white">Importar CSV</span>
            {step !== 'upload' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-slate-400">
                {csvRows.length} filas
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
                    {type === 'contacts' ? 'Contactos' : 'Empresas'}
                  </button>
                ))}
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center cursor-pointer hover:border-brand-500/30 hover:bg-white/2 transition-all"
              >
                <Upload size={36} className="mx-auto text-slate-600 mb-3" />
                <p className="text-sm text-slate-300 font-medium">Arrastra tu archivo CSV aquí</p>
                <p className="text-xs text-slate-500 mt-1">o haz clic para seleccionar</p>
                <p className="text-[10px] text-slate-600 mt-3">Soporta archivos .csv con separador de coma o punto y coma</p>
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
                <p className="text-xs font-semibold text-slate-400 mb-2">Campos esperados para {entityType === 'contacts' ? 'contactos' : 'empresas'}</p>
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
              <p className="text-sm text-slate-300 mb-2">Mapea las columnas de tu CSV a los campos del CRM</p>
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
                      <option value="">— No mapear —</option>
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
                  Mapea todos los campos obligatorios (*) para continuar
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button onClick={reset} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/6 transition-colors">
                  Atrás
                </button>
                <button
                  onClick={() => setStep('preview')}
                  disabled={!requiredFieldsMapped}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gradient text-white text-sm font-semibold disabled:opacity-40"
                >
                  Vista previa <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">Vista previa de las primeras {Math.min(5, csvRows.length)} filas</p>
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
                  Se importarán <span className="text-white font-semibold">{csvRows.length}</span> {entityType === 'contacts' ? 'contactos' : 'empresas'}
                </p>
              </div>

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep('mapping')} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/6 transition-colors">
                  Atrás
                </button>
                <button
                  onClick={handleImport}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl btn-gradient text-white text-sm font-semibold"
                >
                  <Upload size={14} />
                  Importar {csvRows.length} registros
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="py-12 text-center">
              <Loader2 size={36} className="mx-auto text-brand-400 animate-spin mb-4" />
              <p className="text-sm text-slate-300">Importando registros...</p>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 'done' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                <Check size={28} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">Importación completada</p>
                <p className="text-sm text-slate-400 mt-1">
                  {importedCount} registro{importedCount !== 1 ? 's' : ''} importado{importedCount !== 1 ? 's' : ''}
                  {errorCount > 0 && (
                    <span className="text-red-400"> · {errorCount} error{errorCount !== 1 ? 'es' : ''}</span>
                  )}
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button onClick={() => { reset(); }} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/6 transition-colors">
                  Importar más
                </button>
                <button onClick={onClose} className="px-5 py-2 rounded-xl btn-gradient text-white text-sm font-semibold">
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
