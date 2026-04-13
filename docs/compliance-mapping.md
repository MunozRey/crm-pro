# Compliance Mapping (SOC2 / GDPR-lite)

This document maps current CRM Pro controls to common enterprise compliance expectations.
It is a pragmatic engineering mapping (not legal advice and not a formal certification artifact).

## Scope

- Application: CRM Pro
- Backend: Supabase (Auth, Postgres, Edge Functions, RLS)
- Operational controls: lead maintenance telemetry/SLA, runbooks, handoff checklists

## Control Mapping Table

| Framework Area | Control Objective | Current Implementation | Evidence | Gap / Next Action | Owner |
|---|---|---|---|---|---|
| SOC2 - Security | Enforce least privilege access | Tenant isolation via `organization_id` + RLS + role claims (`get_org_id`, `get_user_role`) | `docs/implementation-history.md`, SQL migrations | Add scheduled tenant-isolation CI checks | Backend |
| SOC2 - Availability | Detect and respond to processing disruptions | `lead-score-maintenance` telemetry + SLA mode + notifications | `docs/lead-score-maintenance-backend.md`, `docs/lead-maintenance-runbook.md` | Add external paging integration and uptime SLO dashboard | Ops |
| SOC2 - Processing Integrity | Ensure scoring jobs run correctly and are observable | `lead_score_maintenance_runs` status/error history + Settings Ops dashboard | `docs/lead-maintenance-ops-dashboard.md` | Add anomaly thresholds and automated weekly report | Backend/Ops |
| SOC2 - Change Management | Controlled release readiness | Production handoff checklist with pre/post go-live checks | `docs/production-handoff-checklist.md` | Enforce release gate in CI/CD | Engineering |
| SOC2 - Confidentiality | Protect secrets and auth paths | Secret-based system mode (`LEAD_MAINTENANCE_SECRET`) and provider-specific auth flows | `docs/lead-score-maintenance-backend.md`, `docs/auth-sso-backend-handoff.md` | Define secret rotation cadence and audit log | Ops/Security |
| GDPR-lite - Data Segregation | Prevent cross-customer data access | Org-scoped data model and RLS per tenant | migrations + `docs/implementation-history.md` | Add documented quarterly RLS review | Backend |
| GDPR-lite - Access and Correction | Enable controlled updates to customer data | Authenticated CRUD through scoped stores and RLS | app behavior + store layer | Add explicit DSAR playbook document | Product/Backend |
| GDPR-lite - Data Minimization | Keep only necessary operational data | Scoped telemetry table for maintenance runs | `lead_score_maintenance_runs` migration | Add retention window policy for telemetry and logs | Product/Ops |
| GDPR-lite - Incident Response | Procedure for failures that may impact service/data | Incident runbook with triage/recovery/escalation | `docs/lead-maintenance-runbook.md` | Extend to broader security incident classes | Ops/Security |

## Compliance Posture Summary

- **Strong today**:
  - Tenant data segregation architecture.
  - Maintenance observability and operational runbooks.
  - Structured handoff and go-live checklists.
- **Needs hardening for enterprise audits**:
  - Formalized secret rotation evidence.
  - CI-enforced release and isolation gates.
  - Data retention and DSAR response procedure documentation.

## 30-Day Compliance Actions

1. Define and publish telemetry/log retention policy.
2. Add CI check for tenant-isolation regression.
3. Add secret rotation SOP and execution log.
4. Draft DSAR handling playbook (request intake, export, correction, deletion path).

## Evidence Bundle Index

- `docs/hardening-matrix.md`
- `docs/implementation-history.md`
- `docs/lead-score-maintenance-backend.md`
- `docs/lead-maintenance-runbook.md`
- `docs/lead-maintenance-ops-dashboard.md`
- `docs/production-handoff-checklist.md`
- `docs/auth-sso-backend-handoff.md`
