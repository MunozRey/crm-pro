import { useState, useEffect } from 'react'
import { Plus, Trash2, Download, Upload, RotateCcw, Tag, Mail, Wifi, WifiOff, FileSpreadsheet, SlidersHorizontal, Pencil, X, Check, Globe } from 'lucide-react'
import { useSettingsStore } from '../store/settingsStore'
import { useContactsStore } from '../store/contactsStore'
import { useCompaniesStore } from '../store/companiesStore'
import { useDealsStore } from '../store/dealsStore'
import { useActivitiesStore } from '../store/activitiesStore'
import { useEmailStore } from '../store/emailStore'
import { useCustomFieldsStore } from '../store/customFieldsStore'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { ConfirmDialog } from '../components/ui/Modal'
import { Avatar } from '../components/ui/Avatar'
import { toast } from '../store/toastStore'
import { seedContacts } from '../utils/seedData'
import { seedCompanies } from '../utils/seedData'
import { seedDeals } from '../utils/seedData'
import { seedActivities } from '../utils/seedData'
import { initiateGmailOAuth } from '../services/gmailService'
import { CSVImport } from '../components/import/CSVImport'
import { PermissionGate } from '../components/auth/PermissionGate'
import { useNotificationsStore, ALL_NOTIFICATION_TYPES } from '../store/notificationsStore'
import { useTranslations, useI18nStore, LANGUAGE_LABELS, LANGUAGE_FLAGS } from '../i18n'
import type { Language } from '../i18n'
import type { DealCurrency, CustomFieldEntityType, CustomFieldType } from '../types'
import type { NotificationType } from '../types'
const ENTITY_TABS: CustomFieldEntityType[] = ['contact', 'company', 'deal']

const FIELD_TYPES: CustomFieldType[] = [
  'text', 'number', 'date', 'select', 'multiselect',
  'checkbox', 'url', 'email', 'currency', 'textarea',
]

export function Settings() {
  const t = useTranslations()
  const { language, setLanguage } = useI18nStore()
  const { settings, updateCurrency, addTag, removeTag, resetToDefaults } = useSettingsStore()
  const { disabledTypes, toggleType } = useNotificationsStore()
  const contactsStore = useContactsStore()
  const companiesStore = useCompaniesStore()
  const dealsStore = useDealsStore()
  const activitiesStore = useActivitiesStore()
  const { isGmailConnected, gmailAddress, disconnectGmail } = useEmailStore()

  // ── Custom Fields state (manual subscription — persisted store) ────────────
  const [cfDefinitions, setCfDefinitions] = useState(() => useCustomFieldsStore.getState().definitions)
  useEffect(() => useCustomFieldsStore.subscribe((s) => setCfDefinitions(s.definitions)), [])

  const [cfActiveEntity, setCfActiveEntity] = useState<CustomFieldEntityType>('contact')
  const [cfShowForm, setCfShowForm] = useState(false)
  const [cfEditingId, setCfEditingId] = useState<string | null>(null)
  const [cfDeleteId, setCfDeleteId] = useState<string | null>(null)

  // Form fields
  const [cfLabel, setCfLabel] = useState('')
  const [cfFieldType, setCfFieldType] = useState<CustomFieldType>('text')
  const [cfOptions, setCfOptions] = useState('')
  const [cfPlaceholder, setCfPlaceholder] = useState('')
  const [cfRequired, setCfRequired] = useState(false)
  const [cfIsActive, setCfIsActive] = useState(true)

  const cfEntityDefs = cfDefinitions
    .filter((d) => d.entityType === cfActiveEntity)
    .sort((a, b) => a.order - b.order)

  const cfResetForm = () => {
    setCfLabel('')
    setCfFieldType('text')
    setCfOptions('')
    setCfPlaceholder('')
    setCfRequired(false)
    setCfIsActive(true)
    setCfEditingId(null)
    setCfShowForm(false)
  }

  const cfOpenNew = () => {
    cfResetForm()
    setCfShowForm(true)
  }

  const cfOpenEdit = (id: string) => {
    const def = cfDefinitions.find((d) => d.id === id)
    if (!def) return
    setCfLabel(def.label)
    setCfFieldType(def.fieldType)
    setCfOptions(def.options?.join('\n') ?? '')
    setCfPlaceholder(def.placeholder ?? '')
    setCfRequired(def.required)
    setCfIsActive(def.isActive)
    setCfEditingId(id)
    setCfShowForm(true)
  }

  const cfHandleSave = () => {
    const trimmedLabel = cfLabel.trim()
    if (!trimmedLabel) { toast.error(t.settings.fieldName + ' required'); return }

    const optionsArray = ['select', 'multiselect'].includes(cfFieldType)
      ? cfOptions.split('\n').map((o) => o.trim()).filter(Boolean)
      : undefined

    if (['select', 'multiselect'].includes(cfFieldType) && (!optionsArray || optionsArray.length === 0)) {
      toast.error(t.settings.options + ' required')
      return
    }

    if (cfEditingId) {
      useCustomFieldsStore.getState().updateDefinition(cfEditingId, {
        label: trimmedLabel,
        fieldType: cfFieldType,
        options: optionsArray,
        placeholder: cfPlaceholder.trim() || undefined,
        required: cfRequired,
        isActive: cfIsActive,
      })
      toast.success(t.common.save + ' ✓')
    } else {
      useCustomFieldsStore.getState().addDefinition({
        entityType: cfActiveEntity,
        label: trimmedLabel,
        fieldType: cfFieldType,
        options: optionsArray,
        placeholder: cfPlaceholder.trim() || undefined,
        required: cfRequired,
        isActive: cfIsActive,
      })
      toast.success(t.common.create + ' ✓')
    }
    cfResetForm()
  }

  const cfHandleDelete = (id: string) => {
    useCustomFieldsStore.getState().deleteDefinition(id)
    toast.success(t.common.delete + ' ✓')
    setCfDeleteId(null)
  }

  const cfToggleActive = (id: string, current: boolean) => {
    useCustomFieldsStore.getState().updateDefinition(id, { isActive: !current })
  }

  const cfToggleRequired = (id: string, current: boolean) => {
    useCustomFieldsStore.getState().updateDefinition(id, { required: !current })
  }

  // ────────────────────────────────────────────────────────────────────────────

  const [newTag, setNewTag] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [googleClientId, setGoogleClientId] = useState(
    () => (settings as { googleClientId?: string }).googleClientId ?? ''
  )
  const [connectingGmail, setConnectingGmail] = useState(false)
  const [showCSVImport, setShowCSVImport] = useState(false)

  const connected = isGmailConnected()

  const handleAddTag = () => {
    const trimmed = newTag.trim()
    if (!trimmed) return
    if (settings.tags.includes(trimmed)) {
      toast.error(t.errors.duplicateTag)
      return
    }
    addTag(trimmed)
    setNewTag('')
    toast.success(t.common.add + ' ✓')
  }

  const handleExportJSON = () => {
    const data = {
      contacts: contactsStore.contacts,
      companies: companiesStore.companies,
      deals: dealsStore.deals,
      activities: activitiesStore.activities,
      settings,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `crm-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t.settings.exportData + ' ✓')
  }

  const handleImportJSON = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as {
            contacts?: Parameters<typeof contactsStore.addContact>[0][]
            companies?: Parameters<typeof companiesStore.addCompany>[0][]
            deals?: Parameters<typeof dealsStore.addDeal>[0][]
            activities?: Parameters<typeof activitiesStore.addActivity>[0][]
          }
          if (data.contacts) {
            contactsStore.bulkDelete(contactsStore.contacts.map((c) => c.id))
            data.contacts.forEach((c) => contactsStore.addContact(c))
          }
          if (data.companies) {
            companiesStore.companies.forEach((c) => companiesStore.deleteCompany(c.id))
            data.companies.forEach((c) => companiesStore.addCompany(c))
          }
          if (data.deals) {
            dealsStore.deals.forEach((d) => dealsStore.deleteDeal(d.id))
            data.deals.forEach((d) => dealsStore.addDeal(d))
          }
          if (data.activities) {
            activitiesStore.activities.forEach((a) => activitiesStore.deleteActivity(a.id))
            data.activities.forEach((a) => activitiesStore.addActivity(a))
          }
          toast.success(t.settings.importData + ' ✓')
        } catch {
          toast.error('Import error')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleConnectGmail = async () => {
    if (!googleClientId.trim()) { toast.error(t.settings.gmailEnterClientId); return }
    // Save client ID to settings
    ;(settings as { googleClientId?: string }).googleClientId = googleClientId.trim()
    setConnectingGmail(true)
    try {
      await initiateGmailOAuth(googleClientId.trim())
      // Browser will redirect — no further action needed here
    } catch (err) {
      setConnectingGmail(false)
      toast.error(err instanceof Error ? err.message : t.errors.gmailConnectionError)
    }
  }

  const handleReset = () => {
    // Reset all stores to seed data
    contactsStore.bulkDelete(contactsStore.contacts.map((c) => c.id))
    seedContacts.forEach((c) => contactsStore.addContact(c))
    companiesStore.companies.forEach((c) => companiesStore.deleteCompany(c.id))
    seedCompanies.forEach((c) => companiesStore.addCompany(c))
    dealsStore.deals.forEach((d) => dealsStore.deleteDeal(d.id))
    seedDeals.forEach((d) => dealsStore.addDeal(d))
    activitiesStore.activities.forEach((a) => activitiesStore.deleteActivity(a.id))
    seedActivities.forEach((a) => activitiesStore.addActivity(a))
    resetToDefaults()
    toast.success(t.settings.resetData + ' ✓')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">

      {/* ── Language Selector ──────────────────────────────────────────── */}
      <section className="bg-navy-800/60 border border-white/8 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center">
            <Globe size={14} className="text-sky-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">{t.settings.language}</h2>
            <p className="text-xs text-slate-500">{t.settings.general}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:gap-3">
          {(['en', 'es', 'pt', 'fr', 'de', 'it'] as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`inline-flex shrink-0 items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium whitespace-nowrap transition-all ${
                language === lang
                  ? 'bg-brand-500/15 border-brand-500/40 text-white shadow-brand-sm'
                  : 'bg-white/4 border-white/8 text-slate-400 hover:text-slate-200 hover:border-white/15'
              }`}
            >
              <span className="text-base">{LANGUAGE_FLAGS[lang]}</span>
              <span>{LANGUAGE_LABELS[lang]}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Gmail Configuration ──────────────────────────────────────────── */}
      <section className="bg-navy-800/60 border border-white/8 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center">
            <Mail size={14} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">{t.settings.gmailIntegration}</h2>
            <p className="text-xs text-slate-500">{t.email.gmailApiLabel}</p>
          </div>
        </div>

        {connected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <Wifi size={14} className="text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-white">{gmailAddress ?? t.settings.gmailConnected}</p>
                  <p className="text-xs text-emerald-400">{t.settings.gmailConnectionActive}</p>
                </div>
              </div>
              <Button variant="danger" size="sm" leftIcon={<WifiOff size={12} />} onClick={() => { disconnectGmail(); toast.success(t.settings.gmailDisconnected) }}>
                {t.settings.disconnect}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1.5">{t.email.googleClientIdLabel}</label>
              <input
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
                placeholder="123456789-abc.apps.googleusercontent.com"
                className="w-full bg-[#0d0e1a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-brand-500/40"
              />
            </div>
            <Button
              leftIcon={connectingGmail ? undefined : <Mail size={14} />}
              loading={connectingGmail}
              onClick={handleConnectGmail}
            >
              {t.settings.connect} Gmail
            </Button>
            <div className="text-xs text-slate-600 space-y-1">
              <p>{t.settings.gmailSetupTitle}</p>
              <p>{t.settings.gmailSetupStep1} <span className="text-brand-400">console.cloud.google.com</span></p>
              <p>{t.settings.gmailSetupStep2}</p>
              <p>{t.settings.gmailSetupStep3}</p>
              <p>{t.settings.gmailSetupStep4.replace('{origin}', '')} <span className="text-brand-400">http://localhost:5173</span></p>
            </div>
          </div>
        )}
      </section>

      {/* ── Custom Fields ────────────────────────────────────────────────────── */}
      <section className="bg-navy-800/60 border border-white/8 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <SlidersHorizontal size={14} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">{t.settings.customFields}</h2>
              <p className="text-xs text-slate-500">{t.settings.entityLabels.contact}, {t.settings.entityLabels.company}, {t.settings.entityLabels.deal}</p>
            </div>
          </div>
          <PermissionGate permission="custom_fields:update">
            <Button size="sm" leftIcon={<Plus size={13} />} onClick={cfOpenNew}>
              {t.common.add}
            </Button>
          </PermissionGate>
        </div>

        {/* Entity type tabs */}
        <div className="flex gap-1 p-1 bg-white/4 rounded-xl mb-4">
          {ENTITY_TABS.map((et) => (
            <button
              key={et}
              onClick={() => { setCfActiveEntity(et); cfResetForm() }}
              className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-all ${
                cfActiveEntity === et
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.settings.entityLabels[et]}
            </button>
          ))}
        </div>

        {/* Inline add / edit form */}
        {cfShowForm && (
          <div className="mb-4 p-4 bg-[#0d0e1a] border border-white/10 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
              {cfEditingId ? `${t.common.edit}` : `${t.common.add} — ${t.settings.entityLabels[cfActiveEntity]}`}
            </p>

            {/* Label + type row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-400 block mb-1">{t.settings.fieldName}</label>
                <input
                  type="text"
                  value={cfLabel}
                  onChange={(e) => setCfLabel(e.target.value)}
                  placeholder={t.settings.fieldPlaceholderHint}
                  className="w-full bg-[#0d0e1a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-brand-500/40"
                />
              </div>
              <div className="w-44">
                <label className="text-xs font-medium text-slate-400 block mb-1">{t.settings.fieldType}</label>
                <select
                  value={cfFieldType}
                  onChange={(e) => setCfFieldType(e.target.value as CustomFieldType)}
                  aria-label={t.settings.fieldType}
                  title={t.settings.fieldType}
                  className="w-full bg-[#0d0e1a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand-500/40 appearance-none cursor-pointer"
                >
                  {FIELD_TYPES.map((ft) => (
                    <option key={ft} value={ft} className="bg-navy-900 text-white">
                      {t.settings.fieldTypeLabels[ft]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Options — only for select / multiselect */}
            {['select', 'multiselect'].includes(cfFieldType) && (
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  {t.settings.options}
                </label>
                <textarea
                  value={cfOptions}
                  onChange={(e) => setCfOptions(e.target.value)}
                  placeholder={t.settings.optionsPlaceholder}
                  rows={4}
                  className="w-full bg-[#0d0e1a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-brand-500/40 resize-none"
                />
              </div>
            )}

            {/* Placeholder */}
            {!['checkbox', 'date'].includes(cfFieldType) && (
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">{t.settings.placeholder}</label>
                <input
                  type="text"
                  value={cfPlaceholder}
                  onChange={(e) => setCfPlaceholder(e.target.value)}
                  placeholder={t.settings.valuePlaceholderHint}
                  className="w-full bg-[#0d0e1a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-brand-500/40"
                />
              </div>
            )}

            {/* Toggles row */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setCfRequired((v) => !v)}
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  cfRequired
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-white/4 border-white/8 text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfRequired ? 'bg-amber-400' : 'bg-slate-600'}`} />
                {t.settings.required}
              </button>
              <button
                type="button"
                onClick={() => setCfIsActive((v) => !v)}
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  cfIsActive
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-white/4 border-white/8 text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfIsActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                {t.common.active}
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <Button size="sm" leftIcon={<Check size={13} />} onClick={cfHandleSave}>
                {cfEditingId ? t.common.save : t.common.create}
              </Button>
              <Button size="sm" variant="secondary" leftIcon={<X size={13} />} onClick={cfResetForm}>
                {t.common.cancel}
              </Button>
            </div>
          </div>
        )}

        {/* Field list */}
        {cfEntityDefs.length === 0 ? (
          <p className="text-sm text-slate-600 text-center py-6">
            {t.settings.customFields} — {t.settings.entityLabels[cfActiveEntity]}
          </p>
        ) : (
          <div className="space-y-2">
            {cfEntityDefs.map((def) => (
              <div
                key={def.id}
                className="flex items-center gap-3 p-3 bg-white/4 rounded-xl border border-white/5"
              >
                {/* Type badge */}
                <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20 uppercase tracking-wide">
                  {t.settings.fieldTypeLabels[def.fieldType]}
                </span>

                {/* Label */}
                <span className="flex-1 text-sm text-slate-200 truncate">{def.label}</span>

                {/* Required toggle */}
                <button
                  onClick={() => cfToggleRequired(def.id, def.required)}
                  title={def.required ? t.settings.requiredToggleOn : t.settings.requiredToggleOff}
                  className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                    def.required
                      ? 'bg-amber-500/15 border-amber-500/25 text-amber-300'
                      : 'bg-white/5 border-white/8 text-slate-600 hover:text-slate-400'
                  }`}
                >
                  {def.required ? t.settings.required : '—'}
                </button>

                {/* Active toggle */}
                <button
                  onClick={() => cfToggleActive(def.id, def.isActive)}
                  title={def.isActive ? t.settings.activeToggleOn : t.settings.activeToggleOff}
                  className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                    def.isActive
                      ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300'
                      : 'bg-white/5 border-white/8 text-slate-600 hover:text-slate-400'
                  }`}
                >
                  {def.isActive ? t.common.active : t.common.inactive}
                </button>

                {/* Edit / Delete — gated */}
                <PermissionGate permission="custom_fields:update">
                  <button
                    onClick={() => cfOpenEdit(def.id)}
                    title={t.settings.editField}
                    className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setCfDeleteId(def.id)}
                    title={t.settings.deleteField}
                    className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </PermissionGate>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Currency */}
      <section className="bg-navy-800/60 border border-white/8 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">{t.settings.currency}</h2>
        <Select
          label={t.settings.currency}
          options={[
            { value: 'EUR', label: t.settings.currencyLabels.eur },
            { value: 'USD', label: t.settings.currencyLabels.usd },
            { value: 'GBP', label: t.settings.currencyLabels.gbp },
          ]}
          value={settings.currency}
          onChange={(e) => updateCurrency(e.target.value as DealCurrency)}
          className="max-w-xs"
        />
      </section>

      {/* Pipeline Stages */}
      <section className="bg-navy-800/60 border border-white/8 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">{t.settings.pipeline}</h2>
        <div className="space-y-2">
          {settings.pipelineStages.map((stage) => (
            <div key={stage.id} className="flex items-center gap-3 p-3 bg-white/4 rounded-xl">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
              <span className="flex-1 text-sm text-slate-200">{stage.name}</span>
              <span className="text-xs text-slate-500">{stage.probability}% prob.</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-3">{t.settings.pipelineReorderHint}</p>
      </section>

      {/* Tags */}
      <section className="bg-navy-800/60 border border-white/8 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">{t.settings.tags}</h2>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder={t.settings.newTagPlaceholder}
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
            leftIcon={<Tag size={14} />}
            className="flex-1"
          />
          <Button size="sm" leftIcon={<Plus size={14} />} onClick={handleAddTag}>
            {t.common.add}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {settings.tags.map((tag) => (
            <div key={tag} className="flex items-center gap-1.5 bg-[#0d0e1a] border border-white/10 rounded-full px-3 py-1">
              <span className="text-xs text-slate-300">{tag}</span>
              <button
                onClick={() => { removeTag(tag); toast.success(t.common.delete + ' ✓') }}
                aria-label={`${t.settings.deleteTagAriaLabel} ${tag}`}
                className="text-slate-600 hover:text-red-400 transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Users */}
      <section className="bg-navy-800/60 border border-white/8 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">{t.settings.users}</h2>
        <div className="space-y-3">
          {settings.users.map((user) => (
            <div key={user.id} className="flex items-center gap-3 p-3 bg-white/4 rounded-xl">
              <Avatar name={user.name} size="sm" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-200">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email} · {user.role}</p>
              </div>
              <span className="text-xs px-2 py-0.5 bg-brand-500/15 text-brand-400 rounded-full">{user.role}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-3">{t.settings.usersAuthHint}</p>
      </section>

      {/* Data Management */}
      <section className="bg-navy-800/60 border border-white/8 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-2">{t.settings.importExport}</h2>
        <p className="text-xs text-slate-500 mb-4">{t.settings.exportData} / {t.settings.importData}</p>
        <div className="flex flex-wrap gap-3">
          <PermissionGate permission="contacts:export">
            <Button variant="secondary" leftIcon={<Download size={14} />} onClick={handleExportJSON}>
              {t.settings.exportData} JSON
            </Button>
          </PermissionGate>
          <PermissionGate permission="import:json">
            <Button variant="secondary" leftIcon={<Upload size={14} />} onClick={handleImportJSON}>
              {t.settings.importData} JSON
            </Button>
          </PermissionGate>
          <PermissionGate permission="import:csv">
            <Button variant="secondary" leftIcon={<FileSpreadsheet size={14} />} onClick={() => setShowCSVImport(true)}>
              {t.settings.importData} CSV
            </Button>
          </PermissionGate>
          <PermissionGate permission="settings:update">
            <Button variant="danger" leftIcon={<RotateCcw size={14} />} onClick={() => setShowResetConfirm(true)}>
              {t.settings.resetData}
            </Button>
          </PermissionGate>
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="bg-navy-800/60 border border-white/8 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-1">{t.settings.notifications}</h2>
        <p className="text-xs text-slate-500 mb-4">{t.common.enabled} / {t.common.disabled}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALL_NOTIFICATION_TYPES.map((type) => {
            const enabled = !disabledTypes.has(type)
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  enabled
                    ? 'bg-brand-500/10 border-brand-500/30 text-white'
                    : 'bg-white/3 border-white/8 text-slate-500 hover:text-slate-300'
                }`}
              >
                <span>{t.settings.notifTypeLabels[type]}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  enabled ? 'bg-brand-500/20 text-brand-300' : 'bg-white/8 text-slate-600'
                }`}>
                  {enabled ? 'ON' : 'OFF'}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <CSVImport isOpen={showCSVImport} onClose={() => setShowCSVImport(false)} />

      <ConfirmDialog
        isOpen={cfDeleteId !== null}
        onClose={() => setCfDeleteId(null)}
        onConfirm={() => cfDeleteId && cfHandleDelete(cfDeleteId)}
        title={t.common.delete}
        message={t.common.bulkDeleteConfirm}
        confirmLabel={t.common.delete}
        danger
      />

      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleReset}
        title={t.settings.resetData}
        message={t.settings.resetConfirm}
        confirmLabel={t.common.confirm}
        danger
      />
    </div>
  )
}
