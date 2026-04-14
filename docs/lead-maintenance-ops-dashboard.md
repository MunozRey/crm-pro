# Lead Maintenance Ops Dashboard

This document describes the operational dashboard added to `Settings` for lead score maintenance observability.

## Document Control

- Status: Active
- Owner: Ops/Frontend
- Last updated: 2026-04-14
- Canonical: Yes

## Goal

Provide tenant-scoped operational visibility without requiring direct access to Supabase Dashboard.

## UI Location

- Page: `src/pages/Settings.tsx`
- Section: **Lead Maintenance Ops**

## What it shows

- Last successful maintenance run age
- SLA state (healthy/breached against 8h window)
- Recent error count
- Recent run list from `lead_score_maintenance_runs`:
  - mode (`single_org` / `all_orgs`)
  - status (`success` / `running` / `error`)
  - processed lead count
  - error message when available

## Filters

- Status filter buttons:
  - all
  - success
  - running
  - error

## Data source

- Table: `public.lead_score_maintenance_runs`
- Query shape in UI:
  - ordered by `started_at DESC`
  - limited to latest 15 records
- RLS ensures users only see records for their tenant.

## i18n support

The panel uses translation keys under `settings.*` and is fully wired for:

- `en`
- `es`
- `pt`
- `fr` / `de` / `it` (inherits base keys through spread from `en`)

## Related backend pieces

- Edge Function:
  - `supabase/functions/lead-score-maintenance/index.ts`
- Telemetry table migration:
  - `supabase/migrations/20260413152000_lead_score_maintenance_runs.sql`
- Backend contract:
  - `docs/lead-score-maintenance-backend.md`
