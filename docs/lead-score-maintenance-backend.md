# Lead Score Maintenance Backend Contract

This document defines how backend jobs can execute lead score maintenance without requiring an end-user session.

## Document Control

- Status: Active
- Owner: Backend
- Last updated: 2026-04-14
- Canonical: Yes

## Edge Function

- Function name: `lead-score-maintenance`
- Path: `supabase/functions/lead-score-maintenance/index.ts`

## Auth Modes

- User mode (existing behavior):
  - Requires `Authorization: Bearer <user_jwt>`
  - Recomputes only the caller's active organization
- System mode (new, scheduler-ready):
  - Requires header `x-maintenance-secret: <LEAD_MAINTENANCE_SECRET>`
  - Secret value must match the Edge Function env var `LEAD_MAINTENANCE_SECRET`
  - Does not require user JWT

## Request Body (System mode)

Use exactly one of:

- Single tenant run:
  - `{ "organizationId": "<uuid>" }`
- Global run (all tenants):
  - `{ "runAllOrgs": true }`

## Response

- Success: `{ "success": true, "processed": <number> }`
- `processed` is the number of leads recomputed in this execution.
- Includes `runId` when telemetry is persisted.

## Health / Execution Status

- Endpoint: `POST /functions/v1/lead-score-maintenance?mode=health`
- Auth: requires `x-maintenance-secret` header (system mode).
- Optional filter:
  - query `organizationId=<uuid>` or body `{ "organizationId": "<uuid>" }`
- Returns latest execution rows from `public.lead_score_maintenance_runs`.

Example:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/lead-score-maintenance?mode=health&organizationId=<org-id>" \
  -H "Content-Type: application/json" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "x-maintenance-secret: <LEAD_MAINTENANCE_SECRET>" \
  -d '{}'
```

## SLA Guardrails

- Endpoint: `POST /functions/v1/lead-score-maintenance?mode=sla`
- Auth: requires `x-maintenance-secret` header (system mode).
- Parameters (query or body):
  - `thresholdHours` (default `8`): max age since last successful run per tenant
  - `cooldownHours` (default `6`): notification cooldown to avoid alert spam
  - `notifyManagers` (default `true`): send notification to `admin` and `manager` users in stale tenants
- Returns stale tenants and number of alerts emitted.

Example:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/lead-score-maintenance?mode=sla" \
  -H "Content-Type: application/json" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "x-maintenance-secret: <LEAD_MAINTENANCE_SECRET>" \
  -d '{ "thresholdHours": 8, "cooldownHours": 6, "notifyManagers": true }'
```

## Example (Single Tenant)

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/lead-score-maintenance" \
  -H "Content-Type: application/json" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "x-maintenance-secret: <LEAD_MAINTENANCE_SECRET>" \
  -d '{ "organizationId": "00000000-0000-0000-0000-000000000000" }'
```

## Example (All Tenants)

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/lead-score-maintenance" \
  -H "Content-Type: application/json" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "x-maintenance-secret: <LEAD_MAINTENANCE_SECRET>" \
  -d '{ "runAllOrgs": true }'
```

## What the function does

- Recomputes lead score with recency decay and confidence gate
- Writes snapshots to `lead_score_snapshots`
- Sends manager/admin notifications when score drops significantly
- Persists job telemetry in `lead_score_maintenance_runs` with status, counts, and errors

## Operations

- Incident and on-call procedure:
  - `docs/lead-maintenance-runbook.md`
