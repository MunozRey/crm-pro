# CRM Pro Hardening Matrix (Audit-Ready)

This matrix tracks production hardening posture across security, reliability, operations, and governance.

## Scoring Legend

- **Impact**: Low / Medium / High / Critical
- **Likelihood**: Low / Medium / High
- **Priority**: P0 (urgent) / P1 (high) / P2 (planned)

## Hardening Matrix

| Domain | Risk | Impact | Likelihood | Current Control | Remaining Gap | Priority | Owner | ETA |
|---|---|---|---|---|---|---|---|---|
| Multi-tenancy | Cross-tenant data leakage | Critical | Low | `organization_id` model + RLS + claim helpers (`get_org_id`, `get_user_role`) | Periodic tenant-isolation regression in CI | P0 | Backend | 1 sprint |
| Auth/SSO | Provider misconfiguration blocks sign-in | High | Medium | Login supports Google/Azure/Apple/SAML + backend handoff contract | SCIM lifecycle and IdP drift monitoring | P1 | Backend/Auth | 2 sprints |
| Email Infra | Default provider rate limiting disrupts onboarding | High | Medium | SMTP/custom provider guidance documented | Production SMTP failover playbook | P1 | Ops | 1 sprint |
| Lead Scoring | Stale scoring due to scheduler outage | High | Medium | Backend-first maintenance + telemetry + SLA guardrail alerts | External monitor (pager integration) and weekly trend review | P0 | Ops/Backend | 1 sprint |
| Data Consistency | Lead conversion partial writes under failure | High | Low | `promote-lead` server-side conversion path | Add explicit idempotency key strategy | P1 | Backend | 2 sprints |
| Observability | Silent failures in maintenance and automations | High | Medium | `lead_score_maintenance_runs` + Settings Ops Dashboard + runbook | Centralized log sink + dashboards in external APM | P1 | Ops | 2 sprints |
| Security Posture | Function search path and definer misuse | High | Low | Search path hardening migration applied | Quarterly SQL function review checklist | P1 | Security/Backend | 1 sprint |
| Secrets Management | Secret leakage in job environments | Critical | Low | Secret-based system mode (`LEAD_MAINTENANCE_SECRET`) | Secret rotation policy + expiry calendar | P0 | Ops/Security | 1 sprint |
| Release Safety | Unverified deploy introduces regression | High | Medium | Build + lint checks used on each iteration | Pre-deploy smoke suite and release gate document | P1 | Engineering | 1 sprint |
| Governance | Limited audit completeness for enterprise asks | Medium | Medium | Audit log + maintenance telemetry + docs | Field-level security model and data retention policy | P2 | Product/Backend | 3 sprints |

## Immediate Actions (Next 7 Days)

1. Wire pager/incident channel for SLA breach outputs (`maintenance:lead:sla`).
2. Add CI task for tenant isolation smoke tests.
3. Define and document secret rotation cadence for maintenance system mode.
4. Confirm SMTP production path and fallback owner.

## 30-Day Hardening Target

- No unresolved P0 items.
- Weekly review of:
  - stale tenant trend,
  - maintenance failure rate,
  - auth/provider incidents.
- Sign-off from Backend + Ops + Product on all P1 timelines.

## Evidence References

- `docs/lead-score-maintenance-backend.md`
- `docs/lead-maintenance-runbook.md`
- `docs/lead-maintenance-ops-dashboard.md`
- `docs/production-handoff-checklist.md`
- `docs/auth-sso-backend-handoff.md`
- `docs/implementation-history.md`
