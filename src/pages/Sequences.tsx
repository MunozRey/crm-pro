import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Mail, Phone, Linkedin, Clock, Users, CheckCircle2,
  PauseCircle, XCircle, ListOrdered, Trash2, PlayCircle, ChevronRight,
  X, GripVertical,
} from 'lucide-react'
import { useSequencesStore } from '../store/sequencesStore'
import { useContactsStore } from '../store/contactsStore'
import { PermissionGate } from '../components/auth/PermissionGate'
import { toast } from '../store/toastStore'
import { useTranslations } from '../i18n'
import { formatDateShort } from '../utils/formatters'
import type {
  EmailSequence,
  SequenceStep,
  SequenceStepType,
  SequenceEnrollment,
  EnrollmentStatus,
} from '../types'

// ─── Constants ───────────────────────────────────────────────────────────────

function getStepTypeLabels(t: ReturnType<typeof useTranslations>): Record<SequenceStepType, string> {
  return {
    email: t.activities.typeLabels.email,
    call_task: t.activities.typeLabels.call,
    linkedin_task: t.activities.typeLabels.linkedin,
    wait: t.sequences.paused,
  }
}

function getEnrollmentStatusLabels(t: ReturnType<typeof useTranslations>): Record<EnrollmentStatus, string> {
  return {
    active: t.sequences.active,
    completed: t.activities.completed,
    paused: t.sequences.paused,
    replied: t.common.back,
    unsubscribed: t.common.inactive,
  }
}

const ENROLLMENT_STATUS_COLORS: Record<EnrollmentStatus, string> = {
  active: 'bg-emerald-500/20 text-emerald-400',
  completed: 'bg-blue-500/20 text-blue-400',
  paused: 'bg-amber-500/20 text-amber-400',
  replied: 'bg-purple-500/20 text-purple-400',
  unsubscribed: 'bg-slate-500/20 text-slate-400',
}

// ─── Step icon ───────────────────────────────────────────────────────────────

function StepIcon({ type, size = 16 }: { type: SequenceStepType; size?: number }) {
  switch (type) {
    case 'email': return <Mail size={size} className="text-brand-400" />
    case 'call_task': return <Phone size={size} className="text-emerald-400" />
    case 'linkedin_task': return <Linkedin size={size} className="text-sky-400" />
    case 'wait': return <Clock size={size} className="text-amber-400" />
  }
}

// ─── Enroll Modal ────────────────────────────────────────────────────────────

interface EnrollModalProps {
  sequence: EmailSequence
  onClose: () => void
}

function EnrollModal({ sequence, onClose }: EnrollModalProps) {
  const t = useTranslations()
  const [contacts, setContacts] = useState(useContactsStore.getState().contacts)
  const [selectedContactId, setSelectedContactId] = useState('')
  const { enrollContact } = useSequencesStore.getState()

  useEffect(() => {
    const unsub = useContactsStore.subscribe((s) => setContacts(s.contacts))
    return unsub
  }, [])

  function handleEnroll() {
    if (!selectedContactId) return
    const contact = contacts.find((c) => c.id === selectedContactId)
    if (!contact) return
    enrollContact(sequence.id, contact.id, `${contact.firstName} ${contact.lastName}`)
    toast.success(`${contact.firstName} ${contact.lastName} — "${sequence.name}"`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 glass rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-white">{t.sequences.enrolled}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{sequence.name}</p>
          </div>
          <button
            onClick={onClose}
            title={t.common.close}
            aria-label={t.common.close}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">{t.contacts.title}</label>
            <select
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
              aria-label={t.contacts.title}
              title={t.contacts.title}
              className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500/50 [&>option]:bg-navy-900 [&>option]:text-white"
            >
              <option value="">— {t.common.selectAll} —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} {c.email ? `(${c.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 bg-[#0d0e1a] border border-white/10 text-slate-300 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-white/10 transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleEnroll}
              disabled={!selectedContactId}
              className="flex-1 btn-gradient text-white text-sm font-medium px-4 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.sequences.enrolled}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── New / Edit Step Form ────────────────────────────────────────────────────

interface StepFormProps {
  step: SequenceStep
  index: number
  onChange: (updated: SequenceStep) => void
  onRemove: () => void
}

function StepFormRow({ step, index, onChange, onRemove }: StepFormProps) {
  const t = useTranslations()
  const stepTypeLabels = getStepTypeLabels(t)

  return (
    <div className="flex gap-3 items-start p-4 bg-white/3 border border-white/8 rounded-xl">
      <div className="flex items-center gap-1 text-slate-600 pt-1 cursor-grab flex-shrink-0">
        <GripVertical size={14} />
        <span className="text-xs font-mono text-slate-600">{index + 1}</span>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3">
        {/* Type */}
        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-1">{t.common.type}</label>
          <select
            value={step.type}
            onChange={(e) => onChange({ ...step, type: e.target.value as SequenceStepType })}
            aria-label={t.common.type}
            title={t.common.type}
            className="w-full bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-brand-500/50 [&>option]:bg-navy-900 [&>option]:text-white"
          >
            {(Object.keys(stepTypeLabels) as SequenceStepType[]).map((k) => (
              <option key={k} value={k}>{stepTypeLabels[k]}</option>
            ))}
          </select>
        </div>

        {/* Delay */}
        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-1">{t.activities.dueDate}</label>
          <input
            type="number"
            min={0}
            value={step.delayDays}
            onChange={(e) => onChange({ ...step, delayDays: parseInt(e.target.value) || 0 })}
            aria-label={t.activities.dueDate}
            title={t.activities.dueDate}
            className="w-full bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-brand-500/50"
          />
        </div>

        {/* Email-specific fields */}
        {step.type === 'email' && (
          <>
            <div className="col-span-2">
              <label className="block text-[10px] font-medium text-slate-500 mb-1">{t.activities.subject}</label>
              <input
                type="text"
                value={step.subject ?? ''}
                onChange={(e) => onChange({ ...step, subject: e.target.value })}
                placeholder={`${t.activities.subject}...`}
                className="w-full bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-brand-500/50"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-medium text-slate-500 mb-1">
                {t.common.description} <span className="text-slate-600 font-normal">({'{{firstName}}'}, {'{{companyName}}'})</span>
              </label>
              <textarea
                value={step.bodyTemplate ?? ''}
                onChange={(e) => onChange({ ...step, bodyTemplate: e.target.value })}
                placeholder={`${t.common.description}...`}
                rows={3}
                className="w-full bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-brand-500/50 resize-none font-mono"
              />
            </div>
          </>
        )}

        {/* Task-specific fields */}
        {(step.type === 'call_task' || step.type === 'linkedin_task') && (
          <div className="col-span-2">
            <label className="block text-[10px] font-medium text-slate-500 mb-1">{t.common.description}</label>
            <input
              type="text"
              value={step.taskDescription ?? ''}
              onChange={(e) => onChange({ ...step, taskDescription: e.target.value })}
              placeholder={`${t.common.description}...`}
              className="w-full bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-brand-500/50"
            />
          </div>
        )}
      </div>

      <button
        onClick={onRemove}
        title={t.common.delete}
        aria-label={t.common.delete}
        className="p-1.5 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── New Sequence SlideOver ───────────────────────────────────────────────────

interface NewSequenceSlideOverProps {
  open: boolean
  onClose: () => void
}

function NewSequenceSlideOver({ open, onClose }: NewSequenceSlideOverProps) {
  const t = useTranslations()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<SequenceStep[]>([])

  function reset() {
    setName('')
    setDescription('')
    setSteps([])
  }

  function handleClose() {
    reset()
    onClose()
  }

  function addStep() {
    const newStep: SequenceStep = {
      id: `step-${Date.now()}`,
      order: steps.length,
      type: 'email',
      delayDays: steps.length === 0 ? 0 : 3,
    }
    setSteps((prev) => [...prev, newStep])
  }

  function updateStep(index: number, updated: SequenceStep) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...updated, order: i } : s)))
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })))
  }

  function handleSave() {
    if (!name.trim()) {
      toast.error(t.common.name)
      return
    }
    useSequencesStore.getState().createSequence({
      name: name.trim(),
      description: description.trim(),
      steps,
      createdBy: 'current-user',
      isActive: true,
    })
    toast.success(`"${name}" ${t.sequences.newSequence.toLowerCase()}`)
    handleClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 ml-auto w-full max-w-xl h-full bg-navy-900 border-l border-white/8 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div>
            <h2 className="text-lg font-semibold text-white">{t.sequences.newSequence}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t.common.description}</p>
          </div>
          <button
            onClick={handleClose}
            title={t.common.close}
            aria-label={t.common.close}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">{t.common.name} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${t.sequences.title}...`}
              className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-brand-500/50"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">{t.common.description}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`${t.common.description}...`}
              rows={2}
              className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-brand-500/50 resize-none"
            />
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-slate-400">
                {t.sequences.steps} ({steps.length})
              </label>
              <button
                onClick={addStep}
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
              >
                <Plus size={13} />
                {t.common.add}
              </button>
            </div>

            {steps.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-white/10 rounded-xl">
                <ListOrdered size={24} className="mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">{t.common.noResults}</p>
                <button
                  onClick={addStep}
                  className="text-xs text-brand-400 hover:text-brand-300 mt-2 transition-colors"
                >
                  + {t.common.add}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <StepFormRow
                    key={step.id}
                    step={step}
                    index={idx}
                    onChange={(updated) => updateStep(idx, updated)}
                    onRemove={() => removeStep(idx)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 flex items-center gap-3">
          <button
            onClick={handleClose}
            className="flex-1 bg-[#0d0e1a] border border-white/10 text-slate-300 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 btn-gradient text-white text-sm font-medium px-4 py-2.5 rounded-xl"
          >
            {t.sequences.newSequence}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sequence Detail ─────────────────────────────────────────────────────────

interface SequenceDetailProps {
  sequence: EmailSequence
  enrollments: SequenceEnrollment[]
  onEnroll: () => void
}

function SequenceDetail({ sequence, enrollments, onEnroll }: SequenceDetailProps) {
  const t = useTranslations()
  const stepTypeLabels = getStepTypeLabels(t)
  const enrollmentStatusLabels = getEnrollmentStatusLabels(t)
  const [tab, setTab] = useState<'steps' | 'enrolled'>('steps')
  const { pauseEnrollment, resumeEnrollment, completeEnrollment, unenrollContact } = useSequencesStore.getState()

  function formatDate(iso?: string) {
    if (!iso) return '—'
    return formatDateShort(iso)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-white truncate">{sequence.name}</h2>
              {sequence.isActive ? (
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full flex-shrink-0">
                  {t.sequences.active}
                </span>
              ) : (
                <span className="text-[10px] font-semibold bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded-full flex-shrink-0">
                  {t.common.inactive}
                </span>
              )}
            </div>
            {sequence.description && (
              <p className="text-sm text-slate-400">{sequence.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <span>{sequence.steps.length} {t.sequences.steps.toLowerCase()}</span>
              <span>{sequence.enrolledCount} {t.sequences.enrolled.toLowerCase()}</span>
              <span>{t.common.createdAt} {formatDate(sequence.createdAt)}</span>
            </div>
          </div>
          <PermissionGate permission="sequences:enroll">
            <button
              onClick={onEnroll}
              className="btn-gradient text-white text-xs font-medium px-4 py-2 rounded-full flex items-center gap-1.5 flex-shrink-0"
            >
              <Plus size={13} />
              {t.sequences.enrolled}
            </button>
          </PermissionGate>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {(['steps', 'enrolled'] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`text-xs font-medium px-4 py-2 rounded-full transition-colors ${
                tab === tabKey
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              {tabKey === 'steps' ? t.sequences.steps : `${t.sequences.enrolled} (${enrollments.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'steps' && (
          <div className="space-y-0">
            {sequence.steps.length === 0 ? (
              <div className="text-center py-12">
                <ListOrdered size={32} className="mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">{t.common.noResults}</p>
              </div>
            ) : (
              sequence.steps
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((step, idx) => (
                  <div key={step.id} className="flex gap-4">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-[#0d0e1a] border border-white/10 flex items-center justify-center">
                        <StepIcon type={step.type} size={15} />
                      </div>
                      {idx < sequence.steps.length - 1 && (
                        <div className="w-px flex-1 bg-white/8 my-1 min-h-[32px]" />
                      )}
                    </div>

                    {/* Step content */}
                    <div className={`flex-1 pb-6 ${idx === sequence.steps.length - 1 ? '' : ''}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-white">
                          {t.sequences.steps} {idx + 1} — {stepTypeLabels[step.type]}
                        </span>
                        {step.delayDays > 0 && (
                          <span className="text-[10px] bg-white/6 text-slate-400 px-2 py-0.5 rounded-full">
                            +{step.delayDays}
                          </span>
                        )}
                        {step.delayDays === 0 && idx === 0 && (
                          <span className="text-[10px] bg-brand-500/15 text-brand-400 px-2 py-0.5 rounded-full">
                            0
                          </span>
                        )}
                      </div>

                      {step.type === 'email' && (
                        <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2">
                          {step.subject && (
                            <p className="text-sm font-medium text-white">
                              <span className="text-slate-500 text-xs font-normal mr-2">{t.activities.subject}:</span>
                              {step.subject}
                            </p>
                          )}
                          {step.bodyTemplate && (
                            <p className="text-xs text-slate-400 whitespace-pre-wrap line-clamp-3 font-mono">
                              {step.bodyTemplate}
                            </p>
                          )}
                        </div>
                      )}

                      {(step.type === 'call_task' || step.type === 'linkedin_task') && step.taskDescription && (
                        <div className="bg-white/3 border border-white/8 rounded-xl p-4">
                          <p className="text-xs text-slate-300">{step.taskDescription}</p>
                        </div>
                      )}

                      {step.type === 'wait' && (
                        <div className="bg-white/3 border border-white/8 rounded-xl p-4">
                          <p className="text-xs text-slate-400">{t.sequences.paused} {step.delayDays}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {tab === 'enrolled' && (
          <div>
            {enrollments.length === 0 ? (
              <div className="text-center py-12">
                <Users size={32} className="mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">{t.common.noResults}</p>
                <PermissionGate permission="sequences:create">
                  <button
                    onClick={onEnroll}
                    className="btn-gradient text-white text-xs font-medium px-4 py-2 rounded-full mt-4 inline-flex items-center gap-1.5"
                  >
                    <Plus size={13} />
                    {t.sequences.enrolled}
                  </button>
                </PermissionGate>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/6">
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide pb-3 pr-4">{t.contacts.title}</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide pb-3 pr-4">{t.common.status}</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide pb-3 pr-4">{t.sequences.steps}</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide pb-3 pr-4">{t.activities.dueDate}</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide pb-3">{t.common.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((enr) => (
                      <tr key={enr.id} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-white">{enr.contactName}</p>
                          <p className="text-[11px] text-slate-500">
                            {t.sequences.enrolled} {formatDate(enr.enrolledAt)}
                          </p>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${ENROLLMENT_STATUS_COLORS[enr.status]}`}>
                            {enrollmentStatusLabels[enr.status]}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-xs text-slate-300">
                            {enr.currentStep + 1} / {sequence.steps.length}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-xs text-slate-400">{formatDate(enr.nextStepAt)}</span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            {enr.status === 'active' && (
                              <button
                                onClick={() => { pauseEnrollment(enr.id); toast.success(t.sequences.paused) }}
                                title={t.sequences.paused}
                                className="p-1 text-slate-500 hover:text-amber-400 transition-colors"
                              >
                                <PauseCircle size={15} />
                              </button>
                            )}
                            {enr.status === 'paused' && (
                              <button
                                onClick={() => { resumeEnrollment(enr.id); toast.success(t.sequences.active) }}
                                title={t.sequences.active}
                                className="p-1 text-slate-500 hover:text-emerald-400 transition-colors"
                              >
                                <PlayCircle size={15} />
                              </button>
                            )}
                            {(enr.status === 'active' || enr.status === 'paused') && (
                              <button
                                onClick={() => { completeEnrollment(enr.id); toast.success(t.activities.completed) }}
                                title={t.activities.completed}
                                className="p-1 text-slate-500 hover:text-blue-400 transition-colors"
                              >
                                <CheckCircle2 size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => { unenrollContact(enr.id); toast.success(t.common.remove) }}
                              title={t.common.remove}
                              className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <XCircle size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Sequences() {
  const t = useTranslations()
  const [sequences, setSequences] = useState<EmailSequence[]>([])
  const [enrollments, setEnrollments] = useState<SequenceEnrollment[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewSlideOver, setShowNewSlideOver] = useState(false)
  const [showEnrollModal, setShowEnrollModal] = useState(false)

  // Manual Zustand v5 subscription
  const syncState = useCallback(() => {
    const s = useSequencesStore.getState()
    setSequences(s.sequences)
    setEnrollments(s.enrollments)
  }, [])

  useEffect(() => {
    syncState()
    const unsub = useSequencesStore.subscribe(syncState)
    return unsub
  }, [syncState])

  const selectedSequence = sequences.find((s) => s.id === selectedId) ?? null
  const selectedEnrollments = selectedSequence
    ? enrollments.filter((e) => e.sequenceId === selectedSequence.id)
    : []

  function handleDelete(seqId: string) {
    if (!confirm(t.common.bulkDeleteConfirm)) return
    useSequencesStore.getState().deleteSequence(seqId)
    if (selectedId === seqId) setSelectedId(null)
    toast.success(t.sequences.title)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="flex items-center justify-between px-6 py-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t.sequences.title}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {sequences.length} {t.sequences.title.toLowerCase()} · {enrollments.filter((e) => e.status === 'active').length} {t.sequences.active.toLowerCase()}
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 flex gap-6 px-6 pb-6 min-h-0">
        {/* ─── Left: Sequence List ─────────────────────────────────────── */}
        <div className="w-[280px] flex-shrink-0 glass rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/6 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{t.sequences.title}</h2>
            <PermissionGate permission="sequences:create">
              <button
                onClick={() => setShowNewSlideOver(true)}
                className="btn-gradient text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1"
              >
                <Plus size={13} />
                {t.common.create}
              </button>
            </PermissionGate>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sequences.length === 0 ? (
              <div className="p-6 text-center">
                <ListOrdered size={28} className="mx-auto text-slate-600 mb-2" />
                <p className="text-xs text-slate-500">{t.common.noResults}</p>
                <PermissionGate permission="sequences:create">
                  <button
                    onClick={() => setShowNewSlideOver(true)}
                    className="text-xs text-brand-400 hover:text-brand-300 mt-2 block mx-auto transition-colors"
                  >
                    + {t.sequences.newSequence}
                  </button>
                </PermissionGate>
              </div>
            ) : (
              sequences.map((seq) => {
                const seqEnrollments = enrollments.filter((e) => e.sequenceId === seq.id)
                const activeCount = seqEnrollments.filter((e) => e.status === 'active').length

                return (
                  <div
                    key={seq.id}
                    onClick={() => setSelectedId(seq.id)}
                    className={`group px-4 py-3 border-b border-white/4 cursor-pointer transition-colors ${
                      selectedId === seq.id
                        ? 'bg-brand-600/10 border-l-2 border-l-brand-500'
                        : 'hover:bg-white/3'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium text-white truncate">{seq.name}</p>
                          {seq.isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span>{seq.steps.length} {t.sequences.steps.toLowerCase()}</span>
                          <span>{activeCount} {t.sequences.active.toLowerCase()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <PermissionGate permission="sequences:delete">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(seq.id) }}
                            title={t.common.delete}
                            aria-label={t.common.delete}
                            className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </PermissionGate>
                        <ChevronRight size={13} className="text-slate-600" />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ─── Right: Detail ───────────────────────────────────────────── */}
        <div className="flex-1 glass rounded-2xl overflow-hidden min-w-0">
          {selectedSequence ? (
            <SequenceDetail
              sequence={selectedSequence}
              enrollments={selectedEnrollments}
              onEnroll={() => setShowEnrollModal(true)}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#0d0e1a] border border-white/8 flex items-center justify-center mx-auto mb-4">
                  <ListOrdered size={28} className="text-slate-600" />
                </div>
                <h3 className="text-white font-medium mb-1">{t.common.view} {t.sequences.title.toLowerCase()}</h3>
                <p className="text-sm text-slate-500">{t.common.or} {t.sequences.newSequence.toLowerCase()}</p>
                <PermissionGate permission="sequences:create">
                  <button
                    onClick={() => setShowNewSlideOver(true)}
                    className="btn-gradient text-white text-xs font-medium px-5 py-2.5 rounded-full mt-4 inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    {t.sequences.newSequence}
                  </button>
                </PermissionGate>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals / SlideOvers */}
      <NewSequenceSlideOver open={showNewSlideOver} onClose={() => setShowNewSlideOver(false)} />
      {showEnrollModal && selectedSequence && (
        <EnrollModal sequence={selectedSequence} onClose={() => setShowEnrollModal(false)} />
      )}
    </div>
  )
}
