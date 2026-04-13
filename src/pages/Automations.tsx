import { useEffect, useState } from 'react'
import {
  Workflow, Plus, Trash2, ToggleLeft, ToggleRight, Zap, Bell,
  ArrowRight, CheckCircle2, Clock, ChevronDown, ChevronUp, X,
} from 'lucide-react'
import { useAutomationsStore } from '../store/automationsStore'
import { PermissionGate } from '../components/auth/PermissionGate'
import { toast } from '../store/toastStore'
import { formatRelativeDate } from '../utils/formatters'
import { useTranslations } from '../i18n'
import type {
  AutomationRule, AutomationTriggerType, AutomationActionType,
  AutomationTrigger, AutomationAction, DealStage, ActivityType,
} from '../types'

// ─── Label maps (built at render time so they pick up active language) ─────────

function getTriggerLabels(t: ReturnType<typeof useTranslations>): Record<AutomationTriggerType, string> {
  return {
    deal_stage_changed: `${t.deals.title} ${t.common.changeStatus.toLowerCase()}`,
    deal_created: `${t.deals.title} ${t.common.create.toLowerCase()}`,
    deal_closed_won: `${t.deals.title} ${t.deals.won.toLowerCase()}`,
    deal_closed_lost: `${t.deals.title} ${t.deals.lost.toLowerCase()}`,
    activity_completed: `${t.activities.title} ${t.activities.completed.toLowerCase()}`,
    contact_created: `${t.contacts.title} ${t.common.create.toLowerCase()}`,
    follow_up_overdue: `${t.followUps.title} ${t.activities.overdue.toLowerCase()}`,
  }
}

function getActionLabels(t: ReturnType<typeof useTranslations>): Record<AutomationActionType, string> {
  return {
    create_activity: `${t.common.create} ${t.activities.title.toLowerCase()}`,
    send_notification: `${t.settings.notifications}`,
    update_deal_stage: `${t.deals.stage}`,
    assign_to_user: `${t.common.assignedTo}`,
    add_tag: `${t.common.add} ${t.common.tags.toLowerCase()}`,
  }
}

const STAGE_OPTIONS: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
const ACTIVITY_TYPE_OPTIONS: ActivityType[] = ['call', 'email', 'meeting', 'task', 'note', 'linkedin']

// ─── Trigger badge color ──────────────────────────────────────────────────────

function triggerColor(type: AutomationTriggerType) {
  if (type === 'deal_closed_won') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
  if (type === 'deal_closed_lost') return 'bg-red-500/15 text-red-400 border-red-500/20'
  if (type.startsWith('deal')) return 'bg-brand-500/15 text-brand-400 border-brand-500/20'
  if (type.startsWith('activity')) return 'bg-purple-500/15 text-purple-400 border-purple-500/20'
  return 'bg-white/8 text-slate-400 border-white/10'
}

// ─── Blank rule template ──────────────────────────────────────────────────────

function blankRule(): Omit<AutomationRule, 'id' | 'executionCount' | 'createdAt' | 'updatedAt'> {
  return {
    name: '',
    description: '',
    isActive: true,
    trigger: { type: 'deal_stage_changed' },
    actions: [{ type: 'create_activity', activityType: 'task', activitySubject: '', activityDaysFromNow: 1 }],
  }
}

// ─── Action editor ────────────────────────────────────────────────────────────

function ActionEditor({
  action,
  actionLabels,
  t,
  onChange,
  onRemove,
}: {
  action: AutomationAction
  actionLabels: Record<AutomationActionType, string>
  t: ReturnType<typeof useTranslations>
  onChange: (a: AutomationAction) => void
  onRemove: () => void
}) {
  return (
    <div className="glass rounded-xl p-3 border border-white/6 space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={action.type}
          onChange={(e) => onChange({ type: e.target.value as AutomationActionType })}
          aria-label={t.automations.action}
          title={t.automations.action}
          className="flex-1 bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500/50"
        >
          {(Object.keys(actionLabels) as AutomationActionType[]).map((k) => (
            <option key={k} value={k}>{actionLabels[k]}</option>
          ))}
        </select>
        <button onClick={onRemove} title={t.common.delete} aria-label={t.common.delete} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors">
          <X size={13} />
        </button>
      </div>

      {action.type === 'create_activity' && (
        <>
          <select
            value={action.activityType ?? 'task'}
            onChange={(e) => onChange({ ...action, activityType: e.target.value as ActivityType })}
            aria-label={t.common.type}
            title={t.common.type}
            className="w-full bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500/50"
          >
            {ACTIVITY_TYPE_OPTIONS.map((k) => (
              <option key={k} value={k}>{t.activities.typeLabels[k]}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder={t.activities.subject}
            value={action.activitySubject ?? ''}
            onChange={(e) => onChange({ ...action, activitySubject: e.target.value })}
            className="w-full bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={90}
              value={action.activityDaysFromNow ?? 1}
              onChange={(e) => onChange({ ...action, activityDaysFromNow: Number(e.target.value) })}
              aria-label={t.automations.trigger}
              title={t.automations.trigger}
              className="w-20 bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500/50"
            />
            <span className="text-xs text-slate-500">{t.automations.trigger.toLowerCase()}</span>
          </div>
        </>
      )}

      {action.type === 'send_notification' && (
        <>
          <input
            type="text"
            placeholder={t.settings.notifications}
            value={action.notificationTitle ?? ''}
            onChange={(e) => onChange({ ...action, notificationTitle: e.target.value })}
            className="w-full bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50"
          />
          <textarea
            placeholder={t.common.notes}
            value={action.notificationMessage ?? ''}
            onChange={(e) => onChange({ ...action, notificationMessage: e.target.value })}
            rows={2}
            className="w-full bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50 resize-none"
          />
        </>
      )}

      {action.type === 'update_deal_stage' && (
        <select
          value={action.newStage ?? 'qualified'}
          onChange={(e) => onChange({ ...action, newStage: e.target.value as DealStage })}
          aria-label={t.deals.stage}
          title={t.deals.stage}
          className="w-full bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500/50"
        >
          {STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>{t.deals.stageLabels[s as keyof typeof t.deals.stageLabels] ?? s}</option>
          ))}
        </select>
      )}
    </div>
  )
}

// ─── Rule form modal ──────────────────────────────────────────────────────────

function RuleModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Omit<AutomationRule, 'id' | 'executionCount' | 'createdAt' | 'updatedAt'>
  onSave: (rule: typeof initial) => void
  onClose: () => void
}) {
  const t = useTranslations()
  const triggerLabels = getTriggerLabels(t)
  const actionLabels = getActionLabels(t)
  const [form, setForm] = useState(initial)

  const setTrigger = (tr: AutomationTrigger) => setForm((f) => ({ ...f, trigger: tr }))
  const setActions = (actions: AutomationAction[]) => setForm((f) => ({ ...f, actions }))

  const updateAction = (i: number, a: AutomationAction) =>
    setActions(form.actions.map((ac, idx) => (idx === i ? a : ac)))
  const removeAction = (i: number) => setActions(form.actions.filter((_, idx) => idx !== i))
  const addAction = () => setActions([...form.actions, { type: 'create_activity', activityType: 'task', activitySubject: '', activityDaysFromNow: 1 }])

  const handleSave = () => {
    if (!form.name.trim()) { toast.error(t.common.name); return }
    if (form.actions.length === 0) { toast.error(`${t.common.add} ${t.automations.action.toLowerCase()}`); return }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg border border-white/10 rounded-2xl shadow-float overflow-hidden flex flex-col max-h-[90vh] bg-[#0d0f1e]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <h2 className="text-sm font-semibold text-white">
            {initial.name ? t.common.edit : t.automations.newRule}
          </h2>
          <button onClick={onClose} title={t.common.close} aria-label={t.common.close} className="p-1.5 text-slate-500 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Name & description */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder={`${t.common.name} *`}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50"
            />
            <input
              type="text"
              placeholder={t.common.description}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50"
            />
          </div>

          {/* Trigger */}
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">{t.automations.trigger}</p>
            <div className="glass rounded-xl p-3 border border-white/6 space-y-2">
              <select
                value={form.trigger.type}
                onChange={(e) => setTrigger({ type: e.target.value as AutomationTriggerType })}
                aria-label={t.automations.trigger}
                title={t.automations.trigger}
                className="w-full bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500/50"
              >
                {(Object.keys(triggerLabels) as AutomationTriggerType[]).map((k) => (
                  <option key={k} value={k}>{triggerLabels[k]}</option>
                ))}
              </select>

              {form.trigger.type === 'deal_stage_changed' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-slate-600 mb-1">{t.common.from}</p>
                    <select
                      value={form.trigger.fromStage ?? ''}
                      onChange={(e) => setTrigger({ ...form.trigger, fromStage: (e.target.value as DealStage) || undefined })}
                      aria-label={t.common.from}
                      title={t.common.from}
                      className="w-full bg-[#0d0e1a] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500/50"
                    >
                      <option value="">{t.common.all}</option>
                      {STAGE_OPTIONS.map((s) => <option key={s} value={s}>{t.deals.stageLabels[s as keyof typeof t.deals.stageLabels] ?? s}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-600 mb-1">{t.common.to}</p>
                    <select
                      value={form.trigger.toStage ?? ''}
                      onChange={(e) => setTrigger({ ...form.trigger, toStage: (e.target.value as DealStage) || undefined })}
                      aria-label={t.common.to}
                      title={t.common.to}
                      className="w-full bg-[#0d0e1a] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500/50"
                    >
                      <option value="">{t.common.all}</option>
                      {STAGE_OPTIONS.map((s) => <option key={s} value={s}>{t.deals.stageLabels[s as keyof typeof t.deals.stageLabels] ?? s}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">{t.automations.action}</p>
            <div className="space-y-2">
              {form.actions.map((action, i) => (
                <ActionEditor
                  key={i}
                  action={action}
                  actionLabels={actionLabels}
                  t={t}
                  onChange={(a) => updateAction(i, a)}
                  onRemove={() => removeAction(i)}
                />
              ))}
              <button
                onClick={addAction}
                className="w-full py-2 rounded-xl border border-dashed border-white/10 text-xs text-slate-500 hover:text-slate-300 hover:border-white/20 transition-colors"
              >
                + {t.common.add} {t.automations.action.toLowerCase()}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-white/6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-white/10 text-xs text-slate-400 hover:text-white hover:bg-white/4 transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-xs text-white font-medium transition-colors"
          >
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Rule card ────────────────────────────────────────────────────────────────

function RuleCard({ rule }: { rule: AutomationRule }) {
  const t = useTranslations()
  const triggerLabels = getTriggerLabels(t)
  const actionLabels = getActionLabels(t)
  const { toggleRule, deleteRule, updateRule } = useAutomationsStore()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)

  const handleSave = (data: Omit<AutomationRule, 'id' | 'executionCount' | 'createdAt' | 'updatedAt'>) => {
    updateRule(rule.id, data)
    setEditing(false)
    toast.success(t.automations.title)
  }

  return (
    <>
      {editing && (
        <RuleModal
          initial={{ name: rule.name, description: rule.description, isActive: rule.isActive, trigger: rule.trigger, actions: rule.actions }}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      )}

      <div className={`glass rounded-xl border transition-colors ${rule.isActive ? 'border-white/6' : 'border-white/3 opacity-60'}`}>
        <div className="px-4 py-3">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={`p-2 rounded-lg flex-shrink-0 ${rule.isActive ? 'bg-brand-500/15' : 'bg-white/4'}`}>
              <Workflow size={14} className={rule.isActive ? 'text-brand-400' : 'text-slate-500'} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white">{rule.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${triggerColor(rule.trigger.type)}`}>
                  {triggerLabels[rule.trigger.type]}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#0d0e1a] border border-white/8 text-slate-400">
                  {rule.actions.length} {t.automations.action.toLowerCase()}
                </span>
              </div>
              {rule.description && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{rule.description}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                {rule.executionCount > 0 ? (
                  <span className="text-[10px] text-slate-600 flex items-center gap-1">
                    <CheckCircle2 size={10} className="text-emerald-500" />
                    {t.automations.executionCount}: {rule.executionCount}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-600">{t.automations.executionCount}: 0</span>
                )}
                {rule.lastExecutedAt && (
                  <span className="text-[10px] text-slate-600 flex items-center gap-1">
                    <Clock size={10} />
                    {formatRelativeDate(rule.lastExecutedAt)}
                  </span>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                onClick={() => setExpanded((v) => !v)}
                  title={expanded ? t.common.close : t.common.view}
                  aria-label={expanded ? t.common.close : t.common.view}
                className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors"
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              <PermissionGate permission="automations:update">
                <button
                  onClick={() => setEditing(true)}
                  className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors text-xs"
                >
                  {t.common.edit}
                </button>
              </PermissionGate>
              <PermissionGate permission="automations:update">
                <button
                  onClick={() => toggleRule(rule.id)}
                  className="flex-shrink-0"
                  title={rule.isActive ? t.common.disabled : t.common.enabled}
                >
                  {rule.isActive
                    ? <ToggleRight size={20} className="text-brand-400" />
                    : <ToggleLeft size={20} className="text-slate-500" />
                  }
                </button>
              </PermissionGate>
              <PermissionGate permission="automations:delete">
                <button
                  onClick={() => { deleteRule(rule.id); toast.success(t.common.delete) }}
                  title={t.common.delete}
                  aria-label={t.common.delete}
                  className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </PermissionGate>
            </div>
          </div>
        </div>

        {/* Expanded: trigger + actions detail */}
        {expanded && (
          <div className="px-4 pb-3 border-t border-white/4 pt-3">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/4 border border-white/6">
                <Zap size={11} className="text-amber-400" />
                <span className="text-slate-300">{triggerLabels[rule.trigger.type]}</span>
                {rule.trigger.toStage && (
                  <><ArrowRight size={10} className="text-slate-600" /><span className="text-brand-400">{t.deals.stageLabels[rule.trigger.toStage as keyof typeof t.deals.stageLabels] ?? rule.trigger.toStage}</span></>
                )}
              </div>
              <ArrowRight size={12} className="text-slate-600" />
              {rule.actions.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/4 border border-white/6">
                  <Bell size={11} className="text-brand-400" />
                  <span className="text-slate-300">{actionLabels[a.type]}</span>
                  {a.activitySubject && <span className="text-slate-500">: {a.activitySubject}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Automations() {
  const t = useTranslations()
  const rules = useAutomationsStore((s) => s.rules)
  const recentExecutions = useAutomationsStore((s) => s.recentExecutions)
  const fetchRecentExecutions = useAutomationsStore((s) => s.fetchRecentExecutions)
  const addRule = useAutomationsStore((s) => s.addRule)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    fetchRecentExecutions()
  }, [fetchRecentExecutions])

  const active = rules.filter((r) => r.isActive).length
  const totalExecutions = rules.reduce((s, r) => s + r.executionCount, 0)

  const handleSave = (data: Omit<AutomationRule, 'id' | 'executionCount' | 'createdAt' | 'updatedAt'>) => {
    addRule(data)
    setShowNew(false)
    toast.success(t.automations.title)
  }

  return (
    <div className="p-6 space-y-5">
      {showNew && (
        <RuleModal initial={blankRule()} onSave={handleSave} onClose={() => setShowNew(false)} />
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {active} {t.sequences.active.toLowerCase()} · {totalExecutions} {t.automations.executionCount.toLowerCase()}
        </p>
        <PermissionGate permission="automations:create">
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-xs text-white font-medium transition-colors"
          >
            <Plus size={13} />
            {t.automations.newRule}
          </button>
        </PermissionGate>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl p-4 border border-white/6">
          <p className="text-xs text-slate-500 mb-1">{t.common.total} {t.automations.title.toLowerCase()}</p>
          <p className="text-2xl font-bold text-white">{rules.length}</p>
        </div>
        <div className="glass rounded-xl p-4 border border-white/6">
          <p className="text-xs text-slate-500 mb-1">{t.sequences.active}</p>
          <p className="text-2xl font-bold text-brand-400">{active}</p>
        </div>
        <div className="glass rounded-xl p-4 border border-white/6">
          <p className="text-xs text-slate-500 mb-1">{t.automations.executionCount}</p>
          <p className="text-2xl font-bold text-emerald-400">{totalExecutions}</p>
        </div>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="glass rounded-xl p-12 border border-white/6 text-center">
          <Workflow size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-400">{t.automations.title}</p>
          <p className="text-xs text-slate-600 mt-1">{t.common.noResults}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      )}

      <div className="glass rounded-xl p-4 border border-white/6">
        <p className="text-xs text-slate-500 mb-3 uppercase tracking-wide">{t.audit.title}</p>
        {recentExecutions.length === 0 ? (
          <p className="text-xs text-slate-600">{t.common.noResults}</p>
        ) : (
          <div className="space-y-2">
            {recentExecutions.slice(0, 10).map((exec) => (
              <div key={exec.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs text-slate-200 truncate">{exec.triggerType}</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {formatRelativeDate(exec.createdAt)} · {exec.ruleId}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  exec.status === 'success'
                    ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                    : 'text-red-300 border-red-500/30 bg-red-500/10'
                }`}>
                  {exec.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
