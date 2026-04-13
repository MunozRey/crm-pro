import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Lead, LeadLifecycleStage } from '../types'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getOrgId } from '../lib/supabaseHelpers'
import { useContactsStore } from './contactsStore'
import { useCompaniesStore } from './companiesStore'
import { useAuditStore } from './auditStore'
import { useNotificationsStore } from './notificationsStore'
import { useAuthStore } from './authStore'
import { toast } from './toastStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => supabase as any

const HOT_THRESHOLD = 70
const HOT_SIGNAL_WINDOW_DAYS = 30
const NON_SCORING_EVENT_TYPES = new Set(['manual_score_adjustment', 'manual_recompute', 'score_recomputed'])
const ACTIVITY_EVENT_WEIGHTS: Record<string, number> = {
  email_opened: 8,
  email_clicked: 12,
  email_replied: 20,
  email_sent: 4,
  call_completed: 15,
  meeting_completed: 18,
  meeting_scheduled: 9,
  note_added: 5,
  website_visit: 6,
  form_submitted: 10,
  deal_created: 14,
}

function daysSince(isoDate?: string): number {
  if (!isoDate) return Number.POSITIVE_INFINITY
  const ts = new Date(isoDate).getTime()
  if (Number.isNaN(ts)) return Number.POSITIVE_INFINITY
  return (Date.now() - ts) / 86_400_000
}

function recencyDecayWeight(eventCreatedAt?: string): number {
  const ageDays = daysSince(eventCreatedAt)
  if (ageDays <= 7) return 1
  if (ageDays <= 30) return 0.7
  if (ageDays <= 90) return 0.4
  return 0.2
}

function rowToLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    firstName: (row.first_name as string) ?? '',
    lastName: (row.last_name as string) ?? '',
    email: (row.email as string) ?? '',
    phone: (row.phone as string) ?? undefined,
    companyName: (row.company_name as string) ?? undefined,
    jobTitle: (row.job_title as string) ?? undefined,
    source: (row.source as string) ?? 'website',
    status: (row.status as Lead['status']) ?? 'open',
    lifecycleStage: (row.lifecycle_stage as LeadLifecycleStage) ?? 'lead',
    score: (row.score as number) ?? 0,
    assignedTo: (row.assigned_to as string) ?? undefined,
    ownerUserId: (row.owner_user_id as string) ?? undefined,
    tags: (row.tags as string[]) ?? [],
    notes: (row.notes as string) ?? undefined,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
    lastEngagedAt: (row.last_engaged_at as string) ?? undefined,
    convertedContactId: (row.converted_contact_id as string) ?? undefined,
    convertedCompanyId: (row.converted_company_id as string) ?? undefined,
    convertedDealId: (row.converted_deal_id as string) ?? undefined,
  }
}

function leadToRow(lead: Partial<Lead>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (lead.firstName !== undefined) row.first_name = lead.firstName
  if (lead.lastName !== undefined) row.last_name = lead.lastName
  if (lead.email !== undefined) row.email = lead.email
  if (lead.phone !== undefined) row.phone = lead.phone
  if (lead.companyName !== undefined) row.company_name = lead.companyName
  if (lead.jobTitle !== undefined) row.job_title = lead.jobTitle
  if (lead.source !== undefined) row.source = lead.source
  if (lead.status !== undefined) row.status = lead.status
  if (lead.lifecycleStage !== undefined) row.lifecycle_stage = lead.lifecycleStage
  if (lead.score !== undefined) row.score = lead.score
  if (lead.assignedTo !== undefined) row.assigned_to = lead.assignedTo
  if (lead.ownerUserId !== undefined) row.owner_user_id = lead.ownerUserId
  if (lead.tags !== undefined) row.tags = lead.tags
  if (lead.notes !== undefined) row.notes = lead.notes
  if (lead.lastEngagedAt !== undefined) row.last_engaged_at = lead.lastEngagedAt
  if (lead.convertedContactId !== undefined) row.converted_contact_id = lead.convertedContactId
  if (lead.convertedCompanyId !== undefined) row.converted_company_id = lead.convertedCompanyId
  if (lead.convertedDealId !== undefined) row.converted_deal_id = lead.convertedDealId
  return row
}

export interface LeadsState {
  leads: Lead[]
  leadEventsByLeadId: Record<string, Array<{ id: string; eventType: string; metadata: Record<string, unknown>; createdAt: string }>>
  scoringRules: Array<{ id: string; key: string; points: number; isEnabled: boolean }>
  scoreInsightsByLeadId: Record<string, {
    confidence: 'high' | 'medium' | 'low'
    baselineSignals: number
    eventScore: number
    recentSignals: number
    computedScore?: number
    persistedScore?: number
    hasRecentEngagement?: boolean
  }>
  scoreHistoryByLeadId: Record<string, Array<{ score: number; createdAt: string }>>
  isLoading: boolean
  error: string | null
  search: string
  stageFilter: '' | LeadLifecycleStage
  scoreFilter: '' | 'hot' | 'warm' | 'cold'

  fetchLeads: () => Promise<void>
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'score' | 'status' | 'lifecycleStage'> & {
    lifecycleStage?: LeadLifecycleStage
    score?: number
    status?: Lead['status']
  }) => Lead
  updateLead: (id: string, updates: Partial<Lead>) => void
  deleteLead: (id: string) => void
  setSearch: (value: string) => void
  setStageFilter: (value: LeadsState['stageFilter']) => void
  setScoreFilter: (value: LeadsState['scoreFilter']) => void
  getFilteredLeads: () => Lead[]
  fetchScoringRules: () => Promise<void>
  updateScoringRule: (ruleId: string, patch: { points?: number; isEnabled?: boolean }) => Promise<void>
  fetchLeadEvents: (leadId: string) => Promise<void>
  fetchScoreInsight: (leadId: string) => Promise<void>
  fetchScoreHistory: (leadId: string) => Promise<void>
  runScheduledScoreMaintenance: () => Promise<void>
  addLeadEvent: (
    leadId: string,
    eventType: string,
    metadata?: Record<string, unknown>,
    options?: { skipRecompute?: boolean },
  ) => Promise<void>
  recomputeLeadScore: (leadId: string, options?: { allowDemotion?: boolean; reason?: string }) => Promise<void>
  convertLeadToContact: (leadId: string) => Promise<boolean>
}

export const useLeadsStore = create<LeadsState>()((set, get) => ({
  leads: [],
  leadEventsByLeadId: {},
  scoringRules: [],
  scoreInsightsByLeadId: {},
  scoreHistoryByLeadId: {},
  isLoading: false,
  error: null,
  search: '',
  stageFilter: '',
  scoreFilter: '',

  fetchLeads: async () => {
    set({ isLoading: true, error: null })
    try {
      if (!isSupabaseConfigured || !supabase) {
        set({ leads: [], isLoading: false })
        return
      }
      const { data, error } = await supabase.from('leads').select('*').order('score', { ascending: false })
      if (error) throw error
      set({ leads: (data ?? []).map((row) => rowToLead(row as unknown as Record<string, unknown>)), isLoading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  addLead: (leadData) => {
    const now = new Date().toISOString()
    const optimistic: Lead = {
      id: uuidv4(),
      firstName: leadData.firstName,
      lastName: leadData.lastName,
      email: leadData.email,
      phone: leadData.phone,
      companyName: leadData.companyName,
      jobTitle: leadData.jobTitle,
      source: leadData.source,
      status: leadData.status ?? 'open',
      lifecycleStage: leadData.lifecycleStage ?? 'lead',
      score: leadData.score ?? 0,
      assignedTo: leadData.assignedTo,
      ownerUserId: leadData.ownerUserId,
      tags: leadData.tags,
      notes: leadData.notes,
      createdAt: now,
      updatedAt: now,
      lastEngagedAt: leadData.lastEngagedAt,
      convertedContactId: undefined,
      convertedCompanyId: undefined,
      convertedDealId: undefined,
    }
    set((s) => ({ leads: [optimistic, ...s.leads] }))
    if (isSupabaseConfigured && supabase) {
      try {
        sb().from('leads').insert({ ...leadToRow(optimistic), organization_id: getOrgId() }).select().single()
          .then(({ data, error }: any) => {
            if (error) {
              set({ error: error.message })
              toast.error(error.message)
              return
            }
            const realLead = rowToLead(data as Record<string, unknown>)
            set((s) => ({ leads: s.leads.map((lead) => (lead.id === optimistic.id ? realLead : lead)) }))
          })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to save lead'
        set({ error: message })
        toast.error(message)
      }
    }
    return optimistic
  },

  updateLead: (id, updates) => {
    set((s) => ({
      leads: s.leads.map((lead) => (lead.id === id ? { ...lead, ...updates, updatedAt: new Date().toISOString() } : lead)),
    }))
    if (isSupabaseConfigured && supabase) {
      sb().from('leads').update({ ...leadToRow(updates), updated_at: new Date().toISOString() }).eq('id', id)
    }
  },

  deleteLead: (id) => {
    set((s) => ({ leads: s.leads.filter((lead) => lead.id !== id) }))
    if (isSupabaseConfigured && supabase) {
      sb().from('leads').delete().eq('id', id)
    }
  },

  setSearch: (value) => set({ search: value }),
  setStageFilter: (value) => set({ stageFilter: value }),
  setScoreFilter: (value) => set({ scoreFilter: value }),

  getFilteredLeads: () => {
    const { leads, search, stageFilter, scoreFilter } = get()
    return leads.filter((lead) => {
      const query = search.trim().toLowerCase()
      if (query) {
        const haystack = `${lead.firstName} ${lead.lastName} ${lead.email} ${lead.companyName ?? ''}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      if (stageFilter && lead.lifecycleStage !== stageFilter) return false
      if (scoreFilter === 'hot' && lead.score < 70) return false
      if (scoreFilter === 'warm' && (lead.score < 40 || lead.score >= 70)) return false
      if (scoreFilter === 'cold' && lead.score >= 40) return false
      return true
    }).sort((a, b) => b.score - a.score)
  },

  fetchScoringRules: async () => {
    if (!isSupabaseConfigured || !supabase) return
    const { data, error } = await sb()
      .from('lead_scoring_rules')
      .select('id,key,points,is_enabled')
      .order('key', { ascending: true })
    if (error) {
      set({ error: error.message })
      return
    }
    set({
      scoringRules: (data ?? []).map((row: any) => ({
        id: row.id as string,
        key: (row.key as string) ?? '',
        points: (row.points as number) ?? 0,
        isEnabled: (row.is_enabled as boolean) ?? true,
      })),
    })
  },

  updateScoringRule: async (ruleId, patch) => {
    set((s) => ({
      scoringRules: s.scoringRules.map((rule) => (
        rule.id === ruleId
          ? {
            ...rule,
            ...(patch.points !== undefined ? { points: patch.points } : {}),
            ...(patch.isEnabled !== undefined ? { isEnabled: patch.isEnabled } : {}),
          }
          : rule
      )),
    }))
    if (!isSupabaseConfigured || !supabase) return
    const payload: Record<string, unknown> = {}
    if (patch.points !== undefined) payload.points = patch.points
    if (patch.isEnabled !== undefined) payload.is_enabled = patch.isEnabled
    const { error } = await sb()
      .from('lead_scoring_rules')
      .update(payload)
      .eq('id', ruleId)
    if (error) set({ error: error.message })
  },

  fetchLeadEvents: async (leadId) => {
    if (!isSupabaseConfigured || !supabase) return
    const { data, error } = await sb()
      .from('lead_events')
      .select('id,event_type,metadata,created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
    if (error) {
      set({ error: error.message })
      return
    }
    set((s) => ({
      leadEventsByLeadId: {
        ...s.leadEventsByLeadId,
        [leadId]: (data ?? []).map((row: any) => ({
          id: row.id as string,
          eventType: (row.event_type as string) ?? 'activity',
          metadata: (row.metadata as Record<string, unknown>) ?? {},
          createdAt: (row.created_at as string) ?? new Date().toISOString(),
        })),
      },
    }))
  },

  fetchScoreInsight: async (leadId) => {
    if (!isSupabaseConfigured || !supabase) return
    const { data, error } = await sb()
      .from('lead_score_snapshots')
      .select('reason')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data?.reason) return
    try {
      const parsed = JSON.parse(data.reason as string) as {
        computedScore?: number
        persistedScore?: number
        confidence?: { recentSignals?: number; hasRecentEngagement?: boolean }
        factors?: {
          baselineSignals?: { hasLastEngagedAt?: boolean; hasCompany?: boolean; hasJobTitle?: boolean; hotTags?: string[] }
          eventScore?: number
        }
      }
      const baseline = parsed.factors?.baselineSignals
      const baselineSignals = Number(Boolean(baseline?.hasLastEngagedAt))
        + Number(Boolean(baseline?.hasCompany))
        + Number(Boolean(baseline?.hasJobTitle))
        + Number((baseline?.hotTags?.length ?? 0) > 0)
      const recentSignals = parsed.confidence?.recentSignals ?? 0
      const hasRecentEngagement = Boolean(parsed.confidence?.hasRecentEngagement)
      const confidence: 'high' | 'medium' | 'low' = recentSignals >= 3 || (recentSignals >= 1 && hasRecentEngagement)
        ? 'high'
        : recentSignals >= 1 || hasRecentEngagement
          ? 'medium'
          : 'low'
      set((s) => ({
        scoreInsightsByLeadId: {
          ...s.scoreInsightsByLeadId,
          [leadId]: {
            confidence,
            baselineSignals,
            eventScore: Math.round(parsed.factors?.eventScore ?? 0),
            recentSignals,
            computedScore: parsed.computedScore,
            persistedScore: parsed.persistedScore,
            hasRecentEngagement,
          },
        },
      }))
    } catch {
      // Legacy snapshots may use plain-string reason format.
    }
  },

  fetchScoreHistory: async (leadId) => {
    if (!isSupabaseConfigured || !supabase) return
    const { data, error } = await sb()
      .from('lead_score_snapshots')
      .select('score,created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })
      .limit(30)
    if (error) return
    set((s) => ({
      scoreHistoryByLeadId: {
        ...s.scoreHistoryByLeadId,
        [leadId]: ((data ?? []) as Array<{ score: number; created_at: string }>).map((row) => ({
          score: row.score ?? 0,
          createdAt: row.created_at,
        })),
      },
    }))
  },

  runScheduledScoreMaintenance: async () => {
    const leads = get().leads
    if (!leads.length) return
    const orgId = getOrgId()
    const checkpointKey = `crm_lead_decay_checkpoint_${orgId}`
    const lastRun = Number(localStorage.getItem(checkpointKey) ?? '0')
    const now = Date.now()
    // Run decay maintenance at most once every 6h.
    if (now - lastRun < 6 * 60 * 60 * 1000) return

    const managers = useAuthStore.getState().users.filter((u) => u.role === 'admin' || u.role === 'manager')
    for (const lead of leads) {
      const prevScore = lead.score
      await get().recomputeLeadScore(lead.id, {
        allowDemotion: true,
        reason: 'scheduled_decay',
      })
      const nextLead = get().leads.find((l) => l.id === lead.id)
      const nextScore = nextLead?.score ?? prevScore
      const dropped = prevScore - nextScore
      if (dropped >= 10 || (prevScore >= HOT_THRESHOLD && nextScore < HOT_THRESHOLD)) {
        for (const manager of managers) {
          useNotificationsStore.getState().notify(
            'system',
            'Lead confidence dropped',
            `${lead.firstName} ${lead.lastName} dropped from ${prevScore} to ${nextScore}.`,
            { entityType: 'lead', entityId: lead.id, userId: manager.id },
          )
        }
      }
    }
    localStorage.setItem(checkpointKey, String(now))
  },

  addLeadEvent: async (leadId, eventType, metadata = {}, options = {}) => {
    const now = new Date().toISOString()
    if (!isSupabaseConfigured || !supabase) {
      set((s) => ({
        leadEventsByLeadId: {
          ...s.leadEventsByLeadId,
          [leadId]: [
            {
              id: uuidv4(),
              eventType,
              metadata,
              createdAt: now,
            },
            ...(s.leadEventsByLeadId[leadId] ?? []),
          ],
        },
      }))
      if (!options.skipRecompute) {
        await get().recomputeLeadScore(leadId, { reason: `event_ingested:${eventType}` })
      }
      return
    }
    const { data, error } = await sb()
      .from('lead_events')
      .insert({
        organization_id: getOrgId(),
        lead_id: leadId,
        event_type: eventType,
        metadata,
      })
      .select('id,event_type,metadata,created_at')
      .single()
    if (error) {
      set({ error: error.message })
      return
    }
    set((s) => ({
      leadEventsByLeadId: {
        ...s.leadEventsByLeadId,
        [leadId]: [
          {
            id: data.id as string,
            eventType: (data.event_type as string) ?? eventType,
            metadata: (data.metadata as Record<string, unknown>) ?? metadata,
            createdAt: (data.created_at as string) ?? now,
          },
          ...(s.leadEventsByLeadId[leadId] ?? []),
        ],
      },
    }))
    if (!options.skipRecompute) {
      await get().recomputeLeadScore(leadId, { reason: `event_ingested:${eventType}` })
    }
  },

  recomputeLeadScore: async (leadId, options = {}) => {
    const lead = get().leads.find((item) => item.id === leadId)
    if (!lead) return
    if (isSupabaseConfigured && supabase && get().scoringRules.length === 0) {
      await get().fetchScoringRules()
    }
    let score = 0

    let eventScore = 0
    let recentSignalCount = 0
    const eventsByType: Record<string, Array<{ created_at?: string }>> = {}
    const rawEvents: Array<{ event_type?: string; created_at?: string }> = []

    if (isSupabaseConfigured && supabase) {
      const { data: events } = await sb()
        .from('lead_events')
        .select('event_type,created_at')
        .eq('lead_id', leadId)

      for (const row of events ?? []) {
        const r = row as { event_type?: string; created_at?: string }
        rawEvents.push({ event_type: r.event_type, created_at: r.created_at })
        const key = (r.event_type as string) ?? ''
        if (!key || NON_SCORING_EVENT_TYPES.has(key)) continue
        if (!eventsByType[key]) eventsByType[key] = []
        eventsByType[key].push({ created_at: r.created_at })
      }
    } else {
      const localEvents = get().leadEventsByLeadId[leadId] ?? []
      for (const event of localEvents) {
        rawEvents.push({ event_type: event.eventType, created_at: event.createdAt })
        if (!event.eventType || NON_SCORING_EVENT_TYPES.has(event.eventType)) continue
        if (!eventsByType[event.eventType]) eventsByType[event.eventType] = []
        eventsByType[event.eventType].push({ created_at: event.createdAt })
      }
    }

    const enabledRules = get().scoringRules.filter((r) => r.isEnabled)
    if (enabledRules.length > 0) {
      for (const rule of enabledRules) {
        const key = rule.key ?? ''
        for (const row of rawEvents) {
          const et = row.event_type ?? ''
          if (!et || et !== key) continue
          if (NON_SCORING_EVENT_TYPES.has(et)) continue
          if (daysSince(row.created_at) <= HOT_SIGNAL_WINDOW_DAYS) recentSignalCount += 1
        }
      }
    } else if (!isSupabaseConfigured) {
      // Mock mode without DB rules: count recent non-internal events (approximates activity signals).
      for (const row of rawEvents) {
        const et = row.event_type ?? ''
        if (!et || NON_SCORING_EVENT_TYPES.has(et)) continue
        if (daysSince(row.created_at) <= HOT_SIGNAL_WINDOW_DAYS) recentSignalCount += 1
      }
    }

    for (const [eventType, events] of Object.entries(eventsByType)) {
      const baseWeight = ACTIVITY_EVENT_WEIGHTS[eventType] ?? 2
      for (const event of events) {
        eventScore += baseWeight * recencyDecayWeight(event.created_at)
      }
    }
    score += eventScore

    let computedScore = Math.max(0, Math.min(100, Math.round(score)))
    // Match lead-score-maintenance: no "hot" without rule-matched recent signals unless last_engaged is fresh.
    if (
      computedScore >= HOT_THRESHOLD
      && recentSignalCount === 0
      && daysSince(lead.lastEngagedAt) > HOT_SIGNAL_WINDOW_DAYS
    ) {
      computedScore = HOT_THRESHOLD - 1
    }
    const allowDemotion = options.allowDemotion ?? false
    const nextScore = allowDemotion ? computedScore : Math.max(lead.score ?? 0, computedScore)
    get().updateLead(leadId, { score: nextScore })
    if (options.reason === 'manual_recompute') {
      useAuditStore.getState().logAction(
        'lead_score_recomputed',
        'lead',
        leadId,
        `${lead.firstName} ${lead.lastName}`.trim(),
        `Score recomputed (${lead.score} -> ${nextScore})`,
      )
    }

    if (isSupabaseConfigured && supabase) {
      const reasonPayload = {
        reason: options.reason ?? 'manual_recompute',
        computedScore,
        persistedScore: nextScore,
        allowDemotion,
        confidence: {
          threshold: HOT_THRESHOLD,
          recentSignalWindowDays: HOT_SIGNAL_WINDOW_DAYS,
          recentSignals: recentSignalCount,
          hasRecentEngagement: daysSince(lead.lastEngagedAt) <= HOT_SIGNAL_WINDOW_DAYS,
        },
        factors: {
          baselineSignals: {},
          eventScore: Math.round(eventScore),
        },
      }
      await sb().from('lead_score_snapshots').insert({
        organization_id: getOrgId(),
        lead_id: leadId,
        score: nextScore,
        reason: JSON.stringify(reasonPayload),
      })
    }
  },

  convertLeadToContact: async (leadId) => {
    const lead = get().leads.find((item) => item.id === leadId)
    if (!lead) return false

    const convertLocally = async () => {
      let companyId = ''
      if (lead.companyName?.trim()) {
        const existing = useCompaniesStore.getState().companies.find((c) => c.name.toLowerCase() === lead.companyName!.toLowerCase())
        if (existing) {
          companyId = existing.id
        } else {
          const company = useCompaniesStore.getState().addCompany({
            name: lead.companyName,
            domain: '',
            industry: 'other',
            size: '0-10',
            country: '',
            city: '',
            website: '',
            phone: '',
            status: 'prospect',
            revenue: 0,
            contacts: [],
            deals: [],
            tags: [],
            notes: '',
          })
          companyId = company.id
        }
      }

      const contact = useContactsStore.getState().addContact({
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone ?? '',
        jobTitle: lead.jobTitle ?? '',
        companyId,
        status: 'prospect',
        source: (lead.source as any) ?? 'other',
        tags: lead.tags,
        assignedTo: lead.assignedTo ?? '',
        lastContactedAt: '',
        notes: lead.notes ?? '',
        linkedDeals: [],
      })

      get().updateLead(leadId, {
        status: 'converted',
        lifecycleStage: 'customer',
        convertedContactId: contact.id,
        convertedCompanyId: companyId || undefined,
      })
      await get().addLeadEvent(leadId, 'note_added', { action: 'lead_converted', source: 'local_conversion' })
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.functions.invoke('promote-lead', {
        body: { leadId, createDeal: true },
      })
      if (error) {
        // Fallback path when edge function is unavailable/misconfigured.
        await convertLocally()
        set({ error: null })
        return true
      }
      get().updateLead(leadId, {
        status: 'converted',
        lifecycleStage: 'customer',
        convertedContactId: (data?.contactId as string) ?? undefined,
        convertedCompanyId: (data?.companyId as string) ?? undefined,
        convertedDealId: (data?.dealId as string) ?? undefined,
      })
      await get().addLeadEvent(leadId, 'note_added', { action: 'lead_converted', source: 'promote-lead' })
      return true
    }

    await convertLocally()
    return true
  },
}))
