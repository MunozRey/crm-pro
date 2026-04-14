# Production Handoff Checklist

This checklist is the operational handoff for go-live and post-go-live stabilization.

## Document Control

- Status: Active
- Owner: Ops/Engineering
- Last updated: 2026-04-14
- Canonical: Yes

## 1) Pre-Go-Live (T-7 to T-1 days)

- [ ] **Environment Variables**
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
  - [ ] `LEAD_MAINTENANCE_SECRET`
  - [ ] `SUPABASE_FUNCTIONS_URL`
  - [ ] `SUPABASE_ANON_KEY`
- [ ] **Auth Providers**
  - [ ] Google enabled and callback URL validated
  - [ ] Azure enabled and callback URL validated
  - [ ] Apple enabled and callback URL validated
  - [ ] SAML configured (if enterprise rollout requires it)
- [ ] **Database and RLS**
  - [ ] Latest migrations applied
  - [ ] Tenant isolation smoke test completed
  - [ ] `lead_score_maintenance_runs` table visible per tenant under RLS
- [ ] **Edge Functions**
  - [ ] `lead-score-maintenance` deployed
  - [ ] `track-open` deployed
  - [ ] `track-click` deployed
  - [ ] `promote-lead` deployed
  - [ ] `create-org` deployed (or RPC path validated)
- [ ] **Schedulers**
  - [ ] `maintenance:lead:all` scheduled every 30 min
  - [ ] `maintenance:lead:sla` scheduled every 30-60 min
  - [ ] `maintenance:lead:health` monitored every 15-30 min
- [ ] **Monitoring**
  - [ ] Alert route defined for SLA breaches
  - [ ] On-call owner assigned
  - [ ] Incident channel and escalation contacts confirmed

## 2) Go-Live Day (T0)

- [ ] Run manual baseline commands:
  - [ ] `npm run maintenance:lead:all`
  - [ ] `npm run maintenance:lead:health`
  - [ ] `npm run maintenance:lead:sla`
- [ ] Validate Settings panel:
  - [ ] `Settings -> Lead Maintenance Ops` loads
  - [ ] last successful run updates
  - [ ] no unexpected error bursts
- [ ] Validate auth/login:
  - [ ] email/password
  - [ ] at least one enabled SSO provider
- [ ] Validate core flows:
  - [ ] create organization
  - [ ] add lead
  - [ ] recompute lead score
  - [ ] convert lead to contact/company/deal

## 3) Post-Go-Live (T+1 to T+7 days)

- [ ] Daily checks:
  - [ ] stale tenant count trend is stable/down
  - [ ] telemetry run status mostly `success`
  - [ ] error messages triaged within SLA
- [ ] Capacity checks:
  - [ ] Supabase rate limits acceptable
  - [ ] SMTP/email provider health stable
  - [ ] edge function latency acceptable
- [ ] Product checks:
  - [ ] smart views localization consistent
  - [ ] lead scoring confidence behavior acceptable
  - [ ] workflow automation logs consistent

## 4) Rollback and Recovery

- [ ] Recovery path documented in:
  - `docs/lead-maintenance-runbook.md`
- [ ] Last known good deployment references stored
- [ ] Database backup/restore process validated

## 5) Sign-Off

- [ ] Backend owner sign-off
- [ ] Frontend owner sign-off
- [ ] Ops/Infra owner sign-off
- [ ] Product owner sign-off

## Related Docs

- `docs/lead-score-maintenance-backend.md`
- `docs/lead-maintenance-runbook.md`
- `docs/lead-maintenance-ops-dashboard.md`
- `docs/auth-sso-backend-handoff.md`
- `docs/implementation-history.md`
