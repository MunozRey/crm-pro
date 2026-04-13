# Lead Maintenance Runbook (Ops)

This runbook is for on-call and operations teams maintaining lead score maintenance in production.

## Scope

- Edge Function: `lead-score-maintenance`
- Telemetry table: `public.lead_score_maintenance_runs`
- Scripts:
  - `npm run maintenance:lead:org`
  - `npm run maintenance:lead:all`
  - `npm run maintenance:lead:health`
  - `npm run maintenance:lead:sla`

## Required Environment

Set these variables in the scheduler/job environment:

- `SUPABASE_FUNCTIONS_URL` (example: `https://<project-ref>.supabase.co/functions/v1`)
- `SUPABASE_ANON_KEY`
- `LEAD_MAINTENANCE_SECRET`
- `LEAD_MAINTENANCE_ORG_ID` (only for single-tenant runs)
- Optional SLA tuning:
  - `LEAD_MAINTENANCE_SLA_HOURS` (default `8`)
  - `LEAD_MAINTENANCE_SLA_COOLDOWN_HOURS` (default `6`)
  - `LEAD_MAINTENANCE_SLA_NOTIFY_MANAGERS` (default `true`)

## Normal Schedule

Recommended:

- Maintenance run (all tenants): every `30 minutes`
- SLA guardrail check: every `30-60 minutes`
- Health snapshot export/monitoring: every `15-30 minutes`

## Health Check Procedure

1. Run:
   - `npm run maintenance:lead:health`
2. Verify response:
   - `success: true`
   - recent runs show `status: success`
   - `processed` is non-zero for orgs with active leads
3. If needed, narrow by one tenant:
   - set `LEAD_MAINTENANCE_ORG_ID`
   - rerun health command

## Incident Types and Actions

### 1) No recent successful runs

Symptoms:

- SLA breach alert appears
- health output has only `running`/`error` or stale success timestamps

Actions:

1. Run immediate global maintenance:
   - `npm run maintenance:lead:all`
2. Re-check health:
   - `npm run maintenance:lead:health`
3. Run SLA check:
   - `npm run maintenance:lead:sla`
4. If still failing, inspect latest `error_message` and continue with section "Execution failures".

### 2) Execution failures (`status=error`)

Symptoms:

- New rows in telemetry table with `status: error`
- `error_message` populated

Actions:

1. Capture error text from:
   - Settings → Lead Maintenance Ops
   - or `npm run maintenance:lead:health`
2. Validate environment variables in scheduler:
   - wrong/missing `LEAD_MAINTENANCE_SECRET`
   - wrong `SUPABASE_FUNCTIONS_URL`
3. Validate Supabase function deployment:
   - redeploy function if needed
4. Trigger single-tenant run for validation:
   - set `LEAD_MAINTENANCE_ORG_ID`
   - `npm run maintenance:lead:org`
5. Confirm recovery with health + SLA checks.

### 3) High stale tenant count in SLA mode

Symptoms:

- `maintenance:lead:sla` returns high `staleCount`

Actions:

1. Execute global run:
   - `npm run maintenance:lead:all`
2. Re-run SLA check.
3. If stale remains high:
   - confirm scheduler frequency and runtime stability
   - temporarily reduce `LEAD_MAINTENANCE_SLA_HOURS` only if justified for detection
   - review alert cooldown settings (`LEAD_MAINTENANCE_SLA_COOLDOWN_HOURS`).

## Recovery Validation Checklist

- [ ] `maintenance:lead:all` completes with `success: true`
- [ ] `maintenance:lead:health` shows recent `success` rows
- [ ] `maintenance:lead:sla` returns expected `staleCount` trend
- [ ] Settings Ops panel shows healthy SLA for active tenants
- [ ] No new burst of `status=error` rows in telemetry

## Escalation Guidance

Escalate to backend team when:

- Repeated `status=error` persists after environment validation
- Function works for some tenants but fails deterministically for specific tenants
- `processed` counts collapse unexpectedly while lead volume is stable
- Table/query permission issues appear after RLS or migration changes

## Related Documentation

- Contract/API: `docs/lead-score-maintenance-backend.md`
- Settings panel behavior: `docs/lead-maintenance-ops-dashboard.md`
- Implementation timeline: `docs/implementation-history.md`
