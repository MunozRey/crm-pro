import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Download, Upload, RotateCcw, Tag, Mail, Wifi, WifiOff, FileSpreadsheet, SlidersHorizontal, Pencil, X, Check, Globe, Activity, RefreshCw, ShieldAlert, Lock, Bold, Italic, Link as LinkIcon, Image as ImageIcon } from 'lucide-react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
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
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useAuditStore } from '../store/auditStore'
import type { Language } from '../i18n'
import type { DealCurrency, CustomFieldEntityType, CustomFieldType, PipelineStage } from '../types'
import type { NotificationType } from '../types'
import type { Permission, UserRole } from '../types/auth'
import { ALL_PERMISSIONS } from '../utils/permissionProfiles'
const ENTITY_TABS: CustomFieldEntityType[] = ['contact', 'company', 'deal']

const FIELD_TYPES: CustomFieldType[] = [
  'text', 'number', 'date', 'select', 'multiselect',
  'checkbox', 'url', 'email', 'currency', 'textarea',
]

export function Settings() {
  const t = useTranslations()
  const { language, setLanguage } = useI18nStore()
  const { settings, updateThemePreference, updateCurrency, updateLeadSlaHours, updatePermissionProfile, updateBranding, updateGoogleClientId, addTag, removeTag, resetToDefaults, reorderStages, addPipelineStage } = useSettingsStore()
  const { disabledTypes, toggleType } = useNotificationsStore()
  const contactsStore = useContactsStore()
  const companiesStore = useCompaniesStore()
  const dealsStore = useDealsStore()
  const activitiesStore = useActivitiesStore()
  const { isGmailConnected, gmailAddress, disconnectGmail, syncState, threadsLastSyncedAt, lastSyncErrorMessage } = useEmailStore()
  const orgUsers = useAuthStore((s) => s.users)

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

  const cfEntityDefs = useCustomFieldsStore.getState().getDefinitionsForEntity(cfActiveEntity)

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
    const localizedDefs = useCustomFieldsStore.getState().getDefinitionsForEntity(cfActiveEntity)
    const def = localizedDefs.find((d) => d.id === id)
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
        ...(language === 'en' ? {
          label: trimmedLabel,
          options: optionsArray,
          placeholder: cfPlaceholder.trim() || undefined,
        } : {}),
        fieldType: cfFieldType,
        required: cfRequired,
        isActive: cfIsActive,
      })
      if (language !== 'en') {
        // Non-English edits update localized presentation metadata for the active locale.
        useCustomFieldsStore.getState().upsertTranslation(cfEditingId, language, {
          label: trimmedLabel,
          placeholder: cfPlaceholder.trim() || undefined,
          options: optionsArray,
        })
      }
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
  const [googleClientId, setGoogleClientId] = useState(() => settings.googleClientId ?? '')
  const [connectingGmail, setConnectingGmail] = useState(false)
  const [disconnectingGmail, setDisconnectingGmail] = useState(false)
  const [showCSVImport, setShowCSVImport] = useState(false)
  const [pipelineDraft, setPipelineDraft] = useState<PipelineStage[]>(settings.pipelineStages)
  const [rbacRole, setRbacRole] = useState<UserRole>('manager')
  const [brandingDraft, setBrandingDraft] = useState(settings.branding)

  useEffect(() => {
    setPipelineDraft(settings.pipelineStages)
  }, [settings.pipelineStages])
  useEffect(() => {
    setBrandingDraft(settings.branding)
  }, [settings.branding])
  const [maintenanceRuns, setMaintenanceRuns] = useState<Array<{
    id: string
    status: 'running' | 'success' | 'error'
    mode: 'single_org' | 'all_orgs'
    processed: number
    error_message: string | null
    started_at: string
    finished_at: string | null
  }>>([])
  const [loadingMaintenanceRuns, setLoadingMaintenanceRuns] = useState(false)
  const [maintenanceStatusFilter, setMaintenanceStatusFilter] = useState<'all' | 'success' | 'running' | 'error'>('all')
  const [signatureName, setSignatureName] = useState('')
  const [signatureHtml, setSignatureHtml] = useState('')
  const [editingSignatureId, setEditingSignatureId] = useState<string | null>(null)
  const signatureEditorRef = useRef<HTMLTextAreaElement | null>(null)
  const PIPELINE_STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#f97316', '#ec4899']

  const connected = isGmailConnected()
  const currentUser = useAuthStore((s) => s.currentUser)
  const currentIdentity = currentUser?.id ? settings.emailIdentities?.[currentUser.id] : undefined
  const currentSignatures = currentIdentity?.signatures ?? []
  const currentDefaultSignatureId = currentIdentity?.defaultSignatureId ?? currentSignatures[0]?.id
  const usersForSettings = orgUsers.length > 0
    ? orgUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: t.team.roleLabels[user.role],
    }))
    : settings.users

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

  const handlePipelineStageChange = (stageId: string, patch: Partial<PipelineStage>) => {
    setPipelineDraft((prev) => prev.map((stage) => (stage.id === stageId ? { ...stage, ...patch } : stage)))
  }

  const handlePipelineDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const from = result.source.index
    const to = result.destination.index
    if (from === to) return
    setPipelineDraft((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next.map((stage, index) => ({ ...stage, order: index }))
    })
  }

  const handleAddPipelineStage = () => {
    const nextIndex = settings.pipelineStages.length + 1
    const id = `stage_${Date.now().toString(36)}`
    const color = PIPELINE_STAGE_COLORS[settings.pipelineStages.length % PIPELINE_STAGE_COLORS.length]
    const stageName = `${t.deals.stage} ${nextIndex}`
    const newStage: PipelineStage = {
      id,
      name: stageName,
      color,
      order: settings.pipelineStages.length,
      probability: 40,
    }
    addPipelineStage(newStage)
    setPipelineDraft((prev) => [...prev, newStage])
    toast.success(t.common.create + ' ✓')
  }

  const PIPELINE_STAGE_DELETE_BLOCKED = new Set(['closed_won', 'closed_lost'])

  const handleRemovePipelineStage = (stageId: string) => {
    if (PIPELINE_STAGE_DELETE_BLOCKED.has(stageId)) {
      toast.error(t.settings.pipelineStageProtected)
      return
    }
    const sorted = [...pipelineDraft].sort((a, b) => a.order - b.order)
    const index = sorted.findIndex((s) => s.id === stageId)
    if (index === -1) return
    const fallback = sorted[index - 1]?.id ?? sorted[index + 1]?.id
    if (!fallback) {
      toast.error(t.errors.generic)
      return
    }
    const { deals, updateDeal } = useDealsStore.getState()
    for (const d of deals) {
      if (d.stage === stageId) updateDeal(d.id, { stage: fallback })
    }
    const nextStages = sorted.filter((s) => s.id !== stageId).map((s, i) => ({ ...s, order: i }))
    setPipelineDraft(nextStages)
    reorderStages(nextStages)
    toast.success(t.common.delete + ' ✓')
  }

  const handleSavePipelineConfig = () => {
    const normalized = pipelineDraft.map((stage, index) => ({
      ...stage,
      name: stage.name.trim() || settings.pipelineStages[index]?.name || stage.id,
      probability: Math.max(0, Math.min(100, Number.isFinite(stage.probability) ? stage.probability : 0)),
      order: index,
    }))
    reorderStages(normalized)
    toast.success(t.common.save + ' ✓')
  }

  const rolePermissions = settings.permissionProfiles?.[rbacRole] ?? []

  const handleTogglePermission = (permission: Permission) => {
    const current = settings.permissionProfiles?.[rbacRole] ?? []
    const next = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission]
    updatePermissionProfile(rbacRole, next)
    useAuditStore.getState().logAction(
      'permission_profile_updated',
      'settings',
      `permission-profile-${rbacRole}`,
      rbacRole,
      `${rbacRole} permissions updated (${next.length} grants)`
    )
    toast.success(t.settings.permissionsUpdated)
  }

  const handleSaveBranding = () => {
    updateBranding({
      appName: brandingDraft.appName.trim() || 'CRM Pro',
      primaryColor: brandingDraft.primaryColor || '#7c3aed',
      logoUrl: brandingDraft.logoUrl?.trim() || undefined,
      customDomain: brandingDraft.customDomain?.trim() || undefined,
      privacyUrl: brandingDraft.privacyUrl?.trim() || undefined,
      termsUrl: brandingDraft.termsUrl?.trim() || undefined,
    })
    toast.success(t.common.save + ' ✓')
  }

  const insertAroundSelection = (before: string, after = '') => {
    const editor = signatureEditorRef.current
    if (!editor) return
    const start = editor.selectionStart ?? signatureHtml.length
    const end = editor.selectionEnd ?? signatureHtml.length
    const selected = signatureHtml.slice(start, end)
    const next = `${signatureHtml.slice(0, start)}${before}${selected}${after}${signatureHtml.slice(end)}`
    setSignatureHtml(next)
  }

  const handleSaveSignature = () => {
    if (!currentUser?.id) {
      toast.error(t.errors.generic)
      return
    }
    const sigId = useSettingsStore.getState().upsertEmailSignature(currentUser.id, {
      id: editingSignatureId ?? undefined,
      name: signatureName.trim() || 'Signature',
      html: signatureHtml.trim(),
    })
    if (!currentDefaultSignatureId) {
      useSettingsStore.getState().setDefaultEmailSignature(currentUser.id, sigId)
    }
    setSignatureName('')
    setSignatureHtml('')
    setEditingSignatureId(null)
    toast.success(t.settings.signatureSaved)
  }

  const handleResetBranding = () => {
    setBrandingDraft({ appName: 'CRM Pro', primaryColor: '#7c3aed' })
    updateBranding({
      appName: 'CRM Pro',
      primaryColor: '#7c3aed',
      logoUrl: undefined,
      customDomain: undefined,
      privacyUrl: undefined,
      termsUrl: undefined,
    })
    toast.success(t.settings.resetBranding)
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
          toast.error(t.errors.generic)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleConnectGmail = async () => {
    if (!googleClientId.trim()) { toast.error(t.settings.gmailEnterClientId); return }
    // Persist client ID via typed settings action.
    updateGoogleClientId(googleClientId)
    setConnectingGmail(true)
    try {
      await initiateGmailOAuth(googleClientId.trim())
      // Browser will redirect — no further action needed here
    } catch (err) {
      setConnectingGmail(false)
      toast.error(err instanceof Error ? err.message : t.errors.gmailConnectionError)
    }
  }

  const handleDisconnectGmail = async () => {
    if (!supabase) {
      disconnectGmail()
      toast.success(t.settings.gmailDisconnected)
      return
    }

    setDisconnectingGmail(true)
    try {
      const { error } = await supabase.functions.invoke('gmail-disconnect')
      if (error) throw error
      disconnectGmail()
      toast.success(t.settings.gmailDisconnected)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.errors.gmailConnectionError)
    } finally {
      setDisconnectingGmail(false)
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

  const loadMaintenanceRuns = async () => {
    if (!supabase) return
    setLoadingMaintenanceRuns(true)
    try {
      const { data, error } = await supabase
        .from('lead_score_maintenance_runs')
        .select('id,status,mode,processed,error_message,started_at,finished_at')
        .order('started_at', { ascending: false })
        .limit(15)
      if (error) throw error
      setMaintenanceRuns((data ?? []) as typeof maintenanceRuns)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.errors.generic)
    } finally {
      setLoadingMaintenanceRuns(false)
    }
  }

  useEffect(() => {
    loadMaintenanceRuns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lastSuccessRun = maintenanceRuns.find((run) => run.status === 'success')
  const lastSuccessAt = lastSuccessRun?.finished_at ?? lastSuccessRun?.started_at
  const staleSlaHours = 8
  const staleSlaMs = staleSlaHours * 60 * 60 * 1000
  const isSlaBreached = !lastSuccessAt || Date.now() - new Date(lastSuccessAt).getTime() > staleSlaMs
  const recentErrors = maintenanceRuns.filter((run) => run.status === 'error').slice(0, 3)
  const visibleMaintenanceRuns = maintenanceStatusFilter === 'all'
    ? maintenanceRuns
    : maintenanceRuns.filter((run) => run.status === maintenanceStatusFilter)

  const formatAgo = (iso?: string | null) => {
    if (!iso) return t.settings.leadOpsNotAvailable
    const diffMs = Date.now() - new Date(iso).getTime()
    if (diffMs < 60_000) return t.settings.leadOpsJustNow
    const mins = Math.floor(diffMs / 60_000)
    if (mins < 60) return `${mins}${t.settings.leadOpsMinsAgo}`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}${t.settings.leadOpsHoursAgo}`
    const days = Math.floor(hours / 24)
    return `${days}${t.settings.leadOpsDaysAgo}`
  }

  return (
    <div className="p-6 space-y-8">

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

        <div className="mt-4 max-w-xs">
          <Select
            label={t.settings.theme}
            value={settings.themePreference}
            onChange={(e) => updateThemePreference(e.target.value as 'system' | 'light' | 'dark')}
            options={[
              { value: 'system', label: t.settings.themeSystem },
              { value: 'light', label: t.settings.themeLight },
              { value: 'dark', label: t.settings.themeDark },
            ]}
          />
        </div>
      </section>

      <section className="bg-navy-800/60 border border-white/8 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-3">{t.settings.emailProviderHealth}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-white/4 border border-white/8">
            <p className="text-xs text-slate-500 mb-1">{t.settings.emailSyncState}</p>
            <p className="text-sm text-slate-200">{syncState}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/4 border border-white/8">
            <p className="text-xs text-slate-500 mb-1">{t.settings.emailLastSync}</p>
            <p className="text-sm text-slate-200">{threadsLastSyncedAt ? formatAgo(threadsLastSyncedAt) : t.settings.leadOpsNotAvailable}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/4 border border-white/8">
            <p className="text-xs text-slate-500 mb-1">{t.settings.emailLastError}</p>
            <p className="text-sm text-slate-200">{lastSyncErrorMessage ?? t.settings.leadOpsNotAvailable}</p>
          </div>
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
              <Button variant="danger" size="sm" loading={disconnectingGmail} leftIcon={disconnectingGmail ? undefined : <WifiOff size={12} />} onClick={handleDisconnectGmail}>
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

      <section className="bg-navy-800/60 border border-white/8 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-3">{t.settings.emailSignatures}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Input
              label={t.settings.signatureName}
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder={t.settings.signatureNamePlaceholder}
            />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => insertAroundSelection('<strong>', '</strong>')} className="px-2 py-1 rounded-md bg-white/6 border border-white/10 text-slate-300"><Bold size={12} /></button>
              <button type="button" onClick={() => insertAroundSelection('<em>', '</em>')} className="px-2 py-1 rounded-md bg-white/6 border border-white/10 text-slate-300"><Italic size={12} /></button>
              <button type="button" onClick={() => insertAroundSelection('<a href=\"https://\">', '</a>')} className="px-2 py-1 rounded-md bg-white/6 border border-white/10 text-slate-300"><LinkIcon size={12} /></button>
              <label className="px-2 py-1 rounded-md bg-white/6 border border-white/10 text-slate-300 cursor-pointer inline-flex items-center">
                <ImageIcon size={12} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const dataUrl = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader()
                      reader.onload = () => resolve(String(reader.result ?? ''))
                      reader.onerror = () => reject(reader.error)
                      reader.readAsDataURL(file)
                    })
                    insertAroundSelection(`<img src="${dataUrl}" alt="${file.name}" style="max-width:180px;max-height:80px;" />`)
                    e.currentTarget.value = ''
                  }}
                />
              </label>
            </div>
            <label className="text-xs text-slate-400">{t.settings.signatureHtml}</label>
            <textarea
              ref={signatureEditorRef}
              value={signatureHtml}
              onChange={(e) => setSignatureHtml(e.target.value)}
              rows={7}
              className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
              placeholder="<p>Best regards,<br/>Your name</p>"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveSignature}>{editingSignatureId ? t.common.save : t.common.create}</Button>
              {editingSignatureId && <Button size="sm" variant="ghost" onClick={() => { setEditingSignatureId(null); setSignatureName(''); setSignatureHtml('') }}>{t.common.cancel}</Button>}
            </div>
          </div>
          <div className="space-y-2">
            {currentSignatures.length === 0 && (
              <p className="text-xs text-slate-500">{t.common.noResults}</p>
            )}
            {currentSignatures.map((sig) => (
              <div key={sig.id} className="p-3 rounded-xl bg-white/4 border border-white/8">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-sm text-slate-200 font-medium">{sig.name}</div>
                  {sig.id === currentDefaultSignatureId ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-300">{t.settings.signatureDefault}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => currentUser?.id && useSettingsStore.getState().setDefaultEmailSignature(currentUser.id, sig.id)}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-white/12 text-slate-400 hover:text-slate-200"
                    >
                      {t.settings.signatureSetDefault}
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-400 mb-2 line-clamp-2">{sig.html.replace(/<[^>]+>/g, ' ')}</div>
                <div className="flex gap-2">
                  <Button size="xs" variant="secondary" onClick={() => { setEditingSignatureId(sig.id); setSignatureName(sig.name); setSignatureHtml(sig.html) }}>{t.common.edit}</Button>
                  <Button size="xs" variant="ghost" onClick={() => {
                    if (!currentUser?.id) return
                    useSettingsStore.getState().deleteEmailSignature(currentUser.id, sig.id)
                    toast.success(t.settings.signatureDeleted)
                  }}>{t.common.delete}</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
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

      {/* Branding */}
      <section className="bg-navy-800/60 border border-white/8 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">{t.settings.branding}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            label={t.settings.appName}
            value={brandingDraft.appName}
            onChange={(e) => setBrandingDraft((prev) => ({ ...prev, appName: e.target.value }))}
          />
          <Input
            label={t.settings.primaryColor}
            type="color"
            value={brandingDraft.primaryColor}
            onChange={(e) => setBrandingDraft((prev) => ({ ...prev, primaryColor: e.target.value }))}
          />
          <Input
            label={t.settings.logoUrl}
            value={brandingDraft.logoUrl ?? ''}
            onChange={(e) => setBrandingDraft((prev) => ({ ...prev, logoUrl: e.target.value }))}
          />
          <Input
            label={t.settings.customDomain}
            value={brandingDraft.customDomain ?? ''}
            onChange={(e) => setBrandingDraft((prev) => ({ ...prev, customDomain: e.target.value }))}
            placeholder="crm.yourcompany.com"
          />
          <Input
            label={t.settings.privacyUrl}
            value={brandingDraft.privacyUrl ?? ''}
            onChange={(e) => setBrandingDraft((prev) => ({ ...prev, privacyUrl: e.target.value }))}
            placeholder="https://yourcompany.com/privacy"
          />
          <Input
            label={t.settings.termsUrl}
            value={brandingDraft.termsUrl ?? ''}
            onChange={(e) => setBrandingDraft((prev) => ({ ...prev, termsUrl: e.target.value }))}
            placeholder="https://yourcompany.com/terms"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={handleSaveBranding}>{t.common.save}</Button>
          <Button size="sm" variant="ghost" onClick={handleResetBranding}>{t.settings.resetBranding}</Button>
        </div>
      </section>

      {/* Pipeline Stages */}
      <section className="bg-navy-800/60 border border-white/8 rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">{t.settings.pipeline}</h2>
          <Button size="sm" leftIcon={<Plus size={13} />} onClick={handleAddPipelineStage}>
            {t.common.add}
          </Button>
        </div>
        <DragDropContext onDragEnd={handlePipelineDragEnd}>
          <Droppable droppableId="pipeline-stages">
            {(dropProvided) => (
              <div
                className="space-y-3"
                ref={dropProvided.innerRef}
                {...dropProvided.droppableProps}
              >
                {pipelineDraft.map((stage, index) => (
                  <Draggable key={stage.id} draggableId={stage.id} index={index}>
                    {(dragProvided) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className="p-3 bg-white/4 rounded-xl"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <button
                            type="button"
                            {...dragProvided.dragHandleProps}
                            className="mt-2 text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0"
                            aria-label={`${t.common.edit} order`}
                            title={`${t.common.edit} order`}
                          >
                            <SlidersHorizontal size={14} />
                          </button>
                          <div className="w-3 h-3 rounded-full flex-shrink-0 mt-2.5" style={{ backgroundColor: stage.color }} />
                          <div className="min-w-0 flex-1 space-y-2">
                            <Input
                              label={t.common.name}
                              value={stage.name}
                              onChange={(e) => handlePipelineStageChange(stage.id, { name: e.target.value })}
                              className="w-full"
                            />
                            <div className="flex justify-end">
                              <button
                                type="button"
                                disabled={PIPELINE_STAGE_DELETE_BLOCKED.has(stage.id)}
                                onClick={() => handleRemovePipelineStage(stage.id)}
                                title={PIPELINE_STAGE_DELETE_BLOCKED.has(stage.id) ? t.settings.pipelineStageProtected : t.settings.pipelineStageDeleteHint}
                                aria-label={t.common.delete}
                                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                                  PIPELINE_STAGE_DELETE_BLOCKED.has(stage.id)
                                    ? 'border-white/5 text-slate-600 cursor-not-allowed opacity-40'
                                    : 'border-white/10 text-slate-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10'
                                }`}
                              >
                                <Trash2 size={12} />
                                {t.common.delete}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-slate-400 w-28">{t.deals.probability}</label>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={stage.probability}
                            onChange={(e) => handlePipelineStageChange(stage.id, { probability: Number(e.target.value) })}
                            className="flex-1 accent-brand-500"
                          />
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={stage.probability}
                            onChange={(e) => handlePipelineStageChange(stage.id, { probability: Number(e.target.value) })}
                            className="crm-themed-input w-20 rounded-lg px-2 py-1 text-xs"
                          />
                          <span className="text-xs text-slate-500">%</span>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        <div className="mt-4 max-w-xs">
          <Input
            label={t.settings.leadOpsSlaHours}
            type="number"
            min={1}
            value={settings.leadSlaHours ?? 8}
            onChange={(e) => updateLeadSlaHours(Number(e.target.value))}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={handleSavePipelineConfig}>
            {t.common.save}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPipelineDraft(settings.pipelineStages)}>
            {t.common.cancel}
          </Button>
        </div>
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
          {usersForSettings.map((user) => (
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

      {/* Permission Profiles */}
      <section className="bg-navy-800/60 border border-white/8 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-2">{t.settings.permissionProfiles}</h2>
        <p className="text-xs text-slate-500 mb-4">{t.settings.permissionProfilesHint}</p>
        <div className="max-w-xs mb-4">
          <Select
            label={t.team.role}
            value={rbacRole}
            onChange={(e) => setRbacRole(e.target.value as UserRole)}
            options={[
              { value: 'admin', label: t.team.roleLabels.admin },
              { value: 'manager', label: t.team.roleLabels.manager },
              { value: 'sales_rep', label: t.team.roleLabels.sales_rep },
              { value: 'viewer', label: t.team.roleLabels.viewer },
            ]}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {ALL_PERMISSIONS.map((permission) => {
            const active = rolePermissions.includes(permission)
            return (
              <label key={permission} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${active ? 'border-brand-500/40 bg-brand-500/10 text-brand-200' : 'border-white/8 bg-white/3 text-slate-400'}`}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => handleTogglePermission(permission)}
                  className="accent-brand-500"
                />
                <span>{permission}</span>
              </label>
            )
          })}
        </div>
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

      {/* Lead Maintenance Ops */}
      <section className="bg-navy-800/60 border border-white/8 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isSlaBreached ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
              {isSlaBreached ? <ShieldAlert size={14} className="text-amber-400" /> : <Activity size={14} className="text-emerald-400" />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">{t.settings.leadOpsTitle}</h2>
              <p className="text-xs text-slate-500">{t.settings.leadOpsSubtitle}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<RefreshCw size={13} />}
            loading={loadingMaintenanceRuns}
            onClick={loadMaintenanceRuns}
          >
            {t.leads.refresh}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-white/4 border border-white/8">
            <p className="text-xs text-slate-500 mb-1">{t.settings.leadOpsLastSuccess}</p>
            <p className="text-sm font-medium text-slate-200">{formatAgo(lastSuccessAt)}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/4 border border-white/8">
            <p className="text-xs text-slate-500 mb-1">{t.settings.leadOpsSlaLabel}</p>
            <p className={`text-sm font-medium ${isSlaBreached ? 'text-amber-300' : 'text-emerald-300'}`}>
              {isSlaBreached ? t.settings.leadOpsBreached : t.settings.leadOpsHealthy}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/4 border border-white/8">
            <p className="text-xs text-slate-500 mb-1">{t.settings.leadOpsRecentErrors}</p>
            <p className={`text-sm font-medium ${recentErrors.length > 0 ? 'text-red-300' : 'text-slate-200'}`}>
              {recentErrors.length}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/4 border border-emerald-500/20">
            <p className="text-xs text-slate-500 mb-1">{t.settings.leadOpsMailboxScope}</p>
            <p className="text-sm font-medium text-emerald-300 flex items-center gap-1.5">
              <Lock size={13} />
              {t.settings.leadOpsMailboxPrivate}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{t.settings.leadOpsMailboxPrivateHint}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {([
            { value: 'all', label: t.settings.leadOpsFilterAll },
            { value: 'success', label: t.settings.leadOpsFilterSuccess },
            { value: 'running', label: t.settings.leadOpsFilterRunning },
            { value: 'error', label: t.settings.leadOpsFilterError },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMaintenanceStatusFilter(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                maintenanceStatusFilter === opt.value
                  ? 'bg-brand-500/15 border-brand-500/30 text-brand-300'
                  : 'bg-white/4 border-white/8 text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {visibleMaintenanceRuns.length === 0 ? (
          <p className="text-sm text-slate-500">{t.settings.leadOpsNoRuns}</p>
        ) : (
          <div className="space-y-2">
            {visibleMaintenanceRuns.map((run) => {
              const statusLabel = run.status === 'success'
                ? t.settings.leadOpsFilterSuccess
                : run.status === 'running'
                  ? t.settings.leadOpsFilterRunning
                  : t.settings.leadOpsFilterError
              return (
              <div key={run.id} className="p-3 rounded-xl bg-white/4 border border-white/8">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-400">
                    {run.mode === 'all_orgs' ? t.settings.leadOpsAllOrgs : t.settings.leadOpsSingleOrg} · {formatAgo(run.started_at)}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    run.status === 'success'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : run.status === 'running'
                        ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                        : 'bg-red-500/15 text-red-300 border-red-500/30'
                  }`}>
                    {statusLabel}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {t.settings.leadOpsProcessed}: <span className="text-slate-300">{run.processed}</span>
                </div>
                {run.error_message ? (
                  <p className="mt-1 text-xs text-red-300">{run.error_message}</p>
                ) : null}
              </div>
              )
            })}
          </div>
        )}
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
