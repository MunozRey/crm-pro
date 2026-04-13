import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { AutomationExecutionLog, AutomationRule, AutomationTriggerType, Deal, DealStage } from '../types'
import { useActivitiesStore } from './activitiesStore'
import { useNotificationsStore } from './notificationsStore'
import { useDealsStore } from './dealsStore'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getErrorMessage, getOrgId, runSupabaseWrite, sbDelete } from '../lib/supabaseHelpers'

// ─── Seed Data ────────────────────────────────────────────────────────────────

const _now = new Date().toISOString()

const SEED_RULES: AutomationRule[] = [
  {
    id: 'auto-seed-1', name: 'Enviar email de seguimiento',
    description: 'Cuando un deal pasa a Propuesta, crea una tarea de email para enviar la propuesta formal.',
    isActive: true, trigger: { type: 'deal_stage_changed', toStage: 'proposal' },
    actions: [{ type: 'create_activity', activityType: 'email', activitySubject: 'Enviar propuesta formal', activityDaysFromNow: 2 }],
    executionCount: 0, createdAt: _now, updatedAt: _now,
  },
  {
    id: 'auto-seed-2', name: 'Notificar deal ganado',
    description: 'Envía una notificación cuando se cierra un deal exitosamente.',
    isActive: true, trigger: { type: 'deal_closed_won' },
    actions: [{ type: 'send_notification', notificationTitle: 'Deal ganado', notificationMessage: '¡Felicidades! Se ha cerrado un deal exitosamente.' }],
    executionCount: 0, createdAt: _now, updatedAt: _now,
  },
  {
    id: 'auto-seed-3', name: 'Tarea post-negociación',
    description: 'Cuando un deal entra en Negociación, crea una tarea para revisar los términos.',
    isActive: true, trigger: { type: 'deal_stage_changed', toStage: 'negotiation' },
    actions: [{ type: 'create_activity', activityType: 'task', activitySubject: 'Revisar términos del contrato', activityDaysFromNow: 1 }],
    executionCount: 0, createdAt: _now, updatedAt: _now,
  },
]

// ─── Store Interface ──────────────────────────────────────────────────────────

interface AutomationsStore {
  rules: AutomationRule[]
  recentExecutions: AutomationExecutionLog[]
  isLoading: boolean
  error: string | null
  fetchRules: () => Promise<void>
  fetchRecentExecutions: () => Promise<void>
  addRule: (rule: Omit<AutomationRule, 'id' | 'executionCount' | 'createdAt' | 'updatedAt'>) => void
  updateRule: (id: string, updates: Partial<AutomationRule>) => void
  deleteRule: (id: string) => void
  toggleRule: (id: string) => void
  executeRulesForTrigger: (
    triggerType: AutomationTriggerType,
    context: { deal?: Deal; fromStage?: DealStage; toStage?: DealStage; contactId?: string }
  ) => Promise<void>
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAutomationsStore = create<AutomationsStore>()((set, get) => ({
  rules: [],
  recentExecutions: [],
  isLoading: false,
  error: null,

  fetchRules: async () => {
    if (!isSupabaseConfigured || !supabase) {
      set({ rules: SEED_RULES })
      return
    }
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.from('automation_rules').select('*').order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
      const rules: AutomationRule[] = rows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        description: r.description as string,
        isActive: Boolean(r.is_active),
        trigger: r.trigger as AutomationRule['trigger'],
        actions: (r.actions as AutomationRule['actions']) ?? [],
        executionCount: (r.execution_count as number) ?? 0,
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
        lastExecutedAt: r.last_executed_at as string | undefined,
      }))
      set({ rules: rules.length > 0 ? rules : SEED_RULES, isLoading: false })
    } catch (e: unknown) {
      set({ error: getErrorMessage(e), isLoading: false })
    }
  },

  fetchRecentExecutions: async () => {
    if (!isSupabaseConfigured || !supabase) {
      set({ recentExecutions: [] })
      return
    }
    try {
      const { data, error } = await supabase
        .from('automation_executions')
        .select('id,rule_id,trigger_type,status,context,result,error_message,created_at')
        .order('created_at', { ascending: false })
        .limit(25)
      if (error) throw error
      set({
        recentExecutions: ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
          id: row.id as string,
          ruleId: row.rule_id as string,
          triggerType: row.trigger_type as AutomationTriggerType,
          status: ((row.status as string) === 'error' ? 'error' : 'success'),
          context: (row.context as Record<string, unknown>) ?? {},
          result: (row.result as Record<string, unknown>) ?? {},
          errorMessage: row.error_message as string | undefined,
          createdAt: row.created_at as string,
        })),
      })
    } catch (e: unknown) {
      set({ error: getErrorMessage(e) })
    }
  },

  addRule: (ruleData) => {
    const ts = new Date().toISOString()
    const rule: AutomationRule = { ...ruleData, id: uuidv4(), executionCount: 0, createdAt: ts, updatedAt: ts }
    set((s) => ({ rules: [...s.rules, rule] }))
    if (isSupabaseConfigured && supabase) {
      runSupabaseWrite(
        'automationsStore:addRule',
        supabase.from('automation_rules').insert({
          id: rule.id, name: rule.name, description: rule.description,
          is_active: rule.isActive, trigger: rule.trigger, actions: rule.actions,
          execution_count: 0, organization_id: getOrgId(),
        } as never),
        (message) => set({ error: message }),
      )
    }
  },

  updateRule: (id, updates) => {
    set((s) => ({
      rules: s.rules.map((r) => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r),
    }))
    if (isSupabaseConfigured && supabase) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (updates.name !== undefined) row.name = updates.name
      if (updates.description !== undefined) row.description = updates.description
      if (updates.isActive !== undefined) row.is_active = updates.isActive
      if (updates.trigger !== undefined) row.trigger = updates.trigger
      if (updates.actions !== undefined) row.actions = updates.actions
      runSupabaseWrite(
        'automationsStore:updateRule',
        supabase.from('automation_rules').update(row as never).eq('id', id),
        (message) => set({ error: message }),
      )
    }
  },

  deleteRule: (id) => {
    set((s) => ({ rules: s.rules.filter((r) => r.id !== id) }))
    if (isSupabaseConfigured && supabase) {
      sbDelete('automation_rules', id).catch((e) => console.error('[automationsStore] delete error', e))
    }
  },

  toggleRule: (id) => {
    const rule = get().rules.find((r) => r.id === id)
    if (!rule) return
    const newActive = !rule.isActive
    set((s) => ({
      rules: s.rules.map((r) => r.id === id ? { ...r, isActive: newActive, updatedAt: new Date().toISOString() } : r),
    }))
    if (isSupabaseConfigured && supabase) {
      runSupabaseWrite(
        'automationsStore:toggleRule',
        supabase.from('automation_rules').update({ is_active: newActive, updated_at: new Date().toISOString() } as never).eq('id', id),
        (message) => set({ error: message }),
      )
    }
  },

  executeRulesForTrigger: async (triggerType, context) => {
    const activeRules = get().rules.filter((r) => r.isActive && r.trigger.type === triggerType)
    for (const rule of activeRules) {
      if (triggerType === 'deal_stage_changed') {
        if (rule.trigger.fromStage && rule.trigger.fromStage !== context.fromStage) continue
        if (rule.trigger.toStage && rule.trigger.toStage !== context.toStage) continue
      }
      let status: AutomationExecutionLog['status'] = 'success'
      let errorMessage: string | undefined
      let executedActions = 0
      try {
        for (const action of rule.actions) {
          const deal = context.deal
          if (action.type === 'create_activity' && deal) {
            const dueDate = action.activityDaysFromNow
              ? new Date(Date.now() + action.activityDaysFromNow * 86_400_000).toISOString()
              : undefined
            useActivitiesStore.getState().addActivity({
              type: action.activityType ?? 'task',
              subject: action.activitySubject ?? `Seguimiento automático: ${deal.title}`,
              description: `Creado automáticamente por la regla "${rule.name}"`,
              status: 'pending', dealId: deal.id,
              contactId: deal.contactId || undefined, dueDate, createdBy: 'Automatización',
            })
            executedActions += 1
          } else if (action.type === 'send_notification' && deal) {
            useNotificationsStore.getState().notify(
              'system',
              action.notificationTitle ?? `Automatización: ${rule.name}`,
              action.notificationMessage ?? `Deal "${deal.title}" activó la regla "${rule.name}"`,
              { entityType: 'deal', entityId: deal.id }
            )
            executedActions += 1
          } else if (action.type === 'update_deal_stage' && deal && action.newStage) {
            useDealsStore.getState().moveDeal(deal.id, action.newStage)
            executedActions += 1
          } else if (action.type === 'assign_to_user' && deal && action.userId) {
            useDealsStore.getState().updateDeal(deal.id, { assignedTo: action.userId })
            executedActions += 1
          }
        }
      } catch (e: unknown) {
        status = 'error'
        errorMessage = getErrorMessage(e)
      }
      set((s) => ({
        rules: s.rules.map((r) =>
          r.id === rule.id ? { ...r, executionCount: r.executionCount + 1, lastExecutedAt: new Date().toISOString() } : r
        ),
      }))
      if (isSupabaseConfigured && supabase) {
        runSupabaseWrite(
          'automationsStore:logExecution',
          supabase.from('automation_executions').insert({
            organization_id: getOrgId(),
            rule_id: rule.id,
            trigger_type: triggerType,
            status,
            context: context as unknown as Record<string, unknown>,
            result: { executedActions },
            error_message: errorMessage ?? null,
          } as never),
          (message) => set({ error: message }),
        )
        runSupabaseWrite(
          'automationsStore:incrementRuleExecution',
          supabase.from('automation_rules').update({
            execution_count: rule.executionCount + 1,
            last_executed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as never).eq('id', rule.id),
          (message) => set({ error: message }),
        )
      }
      const localLog: AutomationExecutionLog = {
        id: uuidv4(),
        ruleId: rule.id,
        triggerType,
        status,
        context: context as unknown as Record<string, unknown>,
        result: { executedActions },
        errorMessage,
        createdAt: new Date().toISOString(),
      }
      set((s) => ({ recentExecutions: [localLog, ...s.recentExecutions].slice(0, 25) }))
    }
  },
}))
