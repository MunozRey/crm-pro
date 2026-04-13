import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const HOT_THRESHOLD = 70
const HOT_SIGNAL_WINDOW_DAYS = 30
const SYSTEM_SECRET_HEADER = 'x-maintenance-secret'
const DEFAULT_SLA_HOURS = 8
const DEFAULT_SLA_COOLDOWN_HOURS = 6

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let maintenanceRunId: string | null = null
  let maintenanceRunMeta: { mode: string; organization_id: string | null } | null = null
  let processed = 0

  try {
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const url = new URL(req.url)
    const mode = url.searchParams.get('mode')
    const body = await req.json().catch(() => ({})) as {
      organizationId?: string
      runAllOrgs?: boolean
      thresholdHours?: number
      cooldownHours?: number
      notifyManagers?: boolean
    }
    const providedSecret = req.headers.get(SYSTEM_SECRET_HEADER)
    const configuredSecret = Deno.env.get('LEAD_MAINTENANCE_SECRET') ?? ''
    const systemMode = Boolean(configuredSecret) && providedSecret === configuredSecret

    if (mode === 'health') {
      if (!systemMode) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const orgId = url.searchParams.get('organizationId') ?? body.organizationId
      let query = adminClient
        .from('lead_score_maintenance_runs')
        .select('id,organization_id,mode,status,processed,error_message,started_at,finished_at')
        .order('started_at', { ascending: false })
        .limit(20)
      if (orgId) query = query.eq('organization_id', orgId)
      const { data, error } = await query
      if (error) throw error
      return new Response(JSON.stringify({ success: true, runs: data ?? [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (mode === 'sla') {
      if (!systemMode) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const thresholdHours = Number(url.searchParams.get('thresholdHours') ?? body.thresholdHours ?? DEFAULT_SLA_HOURS)
      const cooldownHours = Number(url.searchParams.get('cooldownHours') ?? body.cooldownHours ?? DEFAULT_SLA_COOLDOWN_HOURS)
      const notifyManagers = String(url.searchParams.get('notifyManagers') ?? body.notifyManagers ?? 'true') !== 'false'
      const now = Date.now()
      const staleBeforeIso = new Date(now - thresholdHours * 3_600_000).toISOString()
      const notifySinceIso = new Date(now - cooldownHours * 3_600_000).toISOString()

      const [{ data: orgs, error: orgErr }, { data: recentRuns, error: runErr }] = await Promise.all([
        adminClient.from('organizations').select('id,name').limit(10000),
        adminClient
          .from('lead_score_maintenance_runs')
          .select('organization_id,status,finished_at,started_at')
          .eq('status', 'success')
          .order('finished_at', { ascending: false })
          .limit(10000),
      ])
      if (orgErr) throw orgErr
      if (runErr) throw runErr

      const lastSuccessByOrg = new Map<string, string>()
      for (const row of (recentRuns ?? []) as Array<{ organization_id: string | null; finished_at?: string | null; started_at?: string | null }>) {
        if (!row.organization_id) continue
        const ts = row.finished_at ?? row.started_at
        if (!ts) continue
        if (!lastSuccessByOrg.has(row.organization_id)) lastSuccessByOrg.set(row.organization_id, ts)
      }

      const staleOrgs = ((orgs ?? []) as Array<{ id: string; name: string }>).flatMap((org) => {
        const last = lastSuccessByOrg.get(org.id)
        if (last && new Date(last).toISOString() > staleBeforeIso) return []
        return [{ organizationId: org.id, organizationName: org.name, lastSuccessAt: last ?? null }]
      })

      let alerted = 0
      if (notifyManagers && staleOrgs.length) {
        for (const stale of staleOrgs) {
          const { data: priorAlerts } = await adminClient
            .from('notifications')
            .select('id')
            .eq('organization_id', stale.organizationId)
            .eq('type', 'system')
            .eq('title', 'Lead maintenance SLA breach')
            .gte('created_at', notifySinceIso)
            .limit(1)

          if ((priorAlerts ?? []).length > 0) continue

          const { data: managers } = await adminClient
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', stale.organizationId)
            .eq('is_active', true)
            .in('role', ['admin', 'manager'])

          for (const mgr of (managers ?? []) as Array<{ user_id: string }>) {
            await adminClient.from('notifications').insert({
              organization_id: stale.organizationId,
              type: 'system',
              title: 'Lead maintenance SLA breach',
              message: `No successful lead maintenance run in the last ${thresholdHours} hours.`,
              entity_type: 'lead',
              entity_id: null,
              user_id: mgr.user_id,
              is_read: false,
            })
            alerted += 1
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        thresholdHours,
        cooldownHours,
        staleCount: staleOrgs.length,
        alerted,
        staleOrganizations: staleOrgs,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let organizationIds: string[] = []
    if (systemMode) {
      if (body.organizationId) {
        organizationIds = [body.organizationId]
      } else if (body.runAllOrgs) {
        const { data: orgs } = await adminClient.from('organizations').select('id').limit(10000)
        organizationIds = (orgs ?? []).map((row) => row.id as string)
      } else {
        return new Response(JSON.stringify({ error: 'In system mode provide organizationId or runAllOrgs=true' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const callerClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      )
      const { data: { user }, error: userErr } = await callerClient.auth.getUser()
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: membership } = await adminClient
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (!membership?.organization_id) {
        return new Response(JSON.stringify({ error: 'No organization membership found' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      organizationIds = [membership.organization_id as string]
    }

    const runMode = organizationIds.length > 1 ? 'all_orgs' : 'single_org'
    const startedAtIso = new Date().toISOString()
    maintenanceRunMeta = {
      mode: runMode,
      organization_id: organizationIds.length === 1 ? organizationIds[0] : null,
    }
    const { data: insertedRun, error: runInsertError } = await adminClient
      .from('lead_score_maintenance_runs')
      .insert({
        organization_id: maintenanceRunMeta.organization_id,
        mode: maintenanceRunMeta.mode,
        status: 'running',
        processed: 0,
        started_at: startedAtIso,
      })
      .select('id')
      .single()
    if (runInsertError) throw runInsertError
    maintenanceRunId = (insertedRun as { id?: string } | null)?.id ?? null

    for (const organizationId of organizationIds) {
      const [{ data: leads }, { data: rules }, { data: events }] = await Promise.all([
        adminClient
          .from('leads')
          .select('id,first_name,last_name,score,last_engaged_at,company_name,job_title,source,tags')
          .eq('organization_id', organizationId)
          .neq('status', 'converted')
          .limit(2000),
        adminClient
          .from('lead_scoring_rules')
          .select('key,points')
          .eq('organization_id', organizationId)
          .eq('is_enabled', true),
        adminClient
          .from('lead_events')
          .select('lead_id,event_type,created_at')
          .eq('organization_id', organizationId)
          .limit(10000),
      ])

      const eventsByLead = new Map<string, Array<{ event_type?: string; created_at?: string }>>()
      for (const ev of (events ?? []) as Array<{ lead_id: string; event_type?: string; created_at?: string }>) {
        if (!eventsByLead.has(ev.lead_id)) eventsByLead.set(ev.lead_id, [])
        eventsByLead.get(ev.lead_id)!.push(ev)
      }

      const managers = await adminClient
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .in('role', ['admin', 'manager'])

      for (const lead of (leads ?? []) as Array<Record<string, unknown>>) {
      let score = 0
      const leadId = lead.id as string
      const prevScore = (lead.score as number) ?? 0
      const tags = (lead.tags as string[]) ?? []

      if (lead.last_engaged_at) score += 20
      if (lead.company_name) score += 15
      if (lead.job_title) score += 10
      if (lead.source === 'referral') score += 20
      if (lead.source === 'linkedin') score += 15
      if (tags.some((tag) => ['VIP', 'Decision Maker', 'Hot Lead'].includes(tag))) score += 25

      let eventScore = 0
      let recentSignalCount = 0
      const leadEvents = eventsByLead.get(leadId) ?? []
      for (const rule of (rules ?? []) as Array<{ key?: string; points?: number }>) {
        const key = rule.key ?? ''
        const delta = rule.points ?? 0
        for (const ev of leadEvents) {
          if (ev.event_type !== key) continue
          eventScore += delta * recencyDecayWeight(ev.created_at)
          if (daysSince(ev.created_at) <= HOT_SIGNAL_WINDOW_DAYS) recentSignalCount += 1
        }
      }
      score += eventScore

      let computedScore = Math.max(0, Math.min(100, Math.round(score)))
      if (computedScore >= HOT_THRESHOLD && recentSignalCount === 0 && daysSince(lead.last_engaged_at as string | undefined) > HOT_SIGNAL_WINDOW_DAYS) {
        computedScore = HOT_THRESHOLD - 1
      }
      const nextScore = computedScore
      if (nextScore !== prevScore) {
        await adminClient
          .from('leads')
          .update({ score: nextScore, updated_at: new Date().toISOString() })
          .eq('id', leadId)
      }

      const reasonPayload = {
        reason: 'scheduled_decay_backend',
        computedScore,
        persistedScore: nextScore,
        allowDemotion: true,
        confidence: {
          threshold: HOT_THRESHOLD,
          recentSignalWindowDays: HOT_SIGNAL_WINDOW_DAYS,
          recentSignals: recentSignalCount,
          hasRecentEngagement: daysSince(lead.last_engaged_at as string | undefined) <= HOT_SIGNAL_WINDOW_DAYS,
        },
        factors: {
          baselineSignals: {
            hasLastEngagedAt: Boolean(lead.last_engaged_at),
            hasCompany: Boolean(lead.company_name),
            hasJobTitle: Boolean(lead.job_title),
            source: lead.source as string,
            hotTags: tags.filter((tag) => ['VIP', 'Decision Maker', 'Hot Lead'].includes(tag)),
          },
          eventScore: Math.round(eventScore),
        },
      }
      await adminClient.from('lead_score_snapshots').insert({
        organization_id: organizationId,
        lead_id: leadId,
        score: nextScore,
        reason: JSON.stringify(reasonPayload),
      })

      const dropped = prevScore - nextScore
        if (dropped >= 10 || (prevScore >= HOT_THRESHOLD && nextScore < HOT_THRESHOLD)) {
          for (const mgr of (managers.data ?? []) as Array<{ user_id: string }>) {
            await adminClient.from('notifications').insert({
              organization_id: organizationId,
              type: 'system',
              title: 'Lead confidence dropped',
              message: `${lead.first_name as string} ${lead.last_name as string} dropped from ${prevScore} to ${nextScore}.`,
              entity_type: 'lead',
              entity_id: leadId,
              user_id: mgr.user_id,
              is_read: false,
            })
          }
        }
        processed += 1
      }
    }

    if (maintenanceRunId) {
      await adminClient
        .from('lead_score_maintenance_runs')
        .update({
          status: 'success',
          processed,
          finished_at: new Date().toISOString(),
        })
        .eq('id', maintenanceRunId)
    }

    return new Response(JSON.stringify({ success: true, processed, runId: maintenanceRunId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    try {
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      const msg = (err as Error).message
      const finishedAt = new Date().toISOString()
      if (maintenanceRunId) {
        await adminClient
          .from('lead_score_maintenance_runs')
          .update({
            status: 'error',
            processed,
            error_message: msg,
            finished_at: finishedAt,
          })
          .eq('id', maintenanceRunId)
      } else if (maintenanceRunMeta) {
        await adminClient.from('lead_score_maintenance_runs').insert({
          organization_id: maintenanceRunMeta.organization_id,
          mode: maintenanceRunMeta.mode,
          status: 'error',
          processed: 0,
          error_message: msg,
          started_at: finishedAt,
          finished_at: finishedAt,
        })
      }
    } catch {
      // Ignore telemetry failure.
    }
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
