# PRO Backlog (Execution Board)

This is the actionable backlog derived from the 30/60/90 roadmap.

## In progress now

- [x] Workflow Automations v1
  - [x] Persist automation executions (run logs, status, error)
  - [x] Trigger evaluator for lead/deal state transitions
  - [x] Action runner for create-activity/notify/assign
- [x] Lead Scoring v2
  - [x] Recency decay support
  - [x] Structured reason metadata in snapshots
  - [x] Confidence threshold strategy for hot labels
- [x] Lead Maintenance Operations Pack
  - [x] Backend-first maintenance function
  - [x] Scheduler runner + health checker + SLA checker scripts
  - [x] Telemetry table (`lead_score_maintenance_runs`)
  - [x] Settings Ops Dashboard with status filter
  - [x] SLA guardrail alerts for stale tenants
- [x] Operations Documentation Pack
  - [x] Backend contract (`lead-score-maintenance`)
  - [x] Ops dashboard technical doc
  - [x] Incident runbook
  - [x] Production handoff checklist
  - [x] Hardening matrix (audit-ready)
  - [x] Compliance mapping (SOC2 / GDPR-lite)
- [x] Email Privacy Hardening Pack
  - [x] Per-user mailbox isolation in Inbox (`ownerUserId`)
  - [x] User-scoped RLS for tracking tables
  - [x] User-scoped RLS for Gmail thread workspace
  - [x] Tracking edge functions propagate `user_id`
  - [x] Legacy tracking backfill RPC (`backfill_email_tracking_user`)
  - [x] Inbox privacy badges + owner visibility panel
  - [x] Support runbook (`docs/email-mailbox-privacy-runbook.md`)
  - [x] Email release checklist (`docs/email-release-checklist.md`)
  - [x] 15-min smoke test script (`docs/email-smoke-test-15min.md`)
- [x] Email Ola 3 (phased)
  - [x] Inbox advanced filters + saved views
  - [x] Inbox sync status indicators + provider health panel
  - [x] Quick replies/snippets persisted per user (`quick_replies`)

## Reference docs (team register)

- **User profile, display names, CRM consistency:** `docs/user-profile-display-names.md` — what is implemented (`user_metadata` persistence), manual test checklist, and open gaps (CRM rows with plain-text names, editing other users from admin, etc.).

## Next

- [ ] Productization Baseline (sell-ready across industries)
  - [ ] Pipeline configurability by tenant
    - [ ] Rename stages/entities per organization (no fixed "deal/prospect" wording)
    - [ ] Stage probability + SLA defaults configurable in Settings
    - [ ] Multiple pipeline templates (SaaS, Services, Real Estate, Insurance)
  - [ ] Dynamic RBAC and permission profiles
    - [ ] Role builder per organization (module/action matrix)
    - [ ] Preset bundles: Admin, Manager, Rep, Read-only
    - [ ] Audit trail for permission changes
  - [ ] Full regionalization (i18n + locale)
    - [ ] Remove remaining hardcoded UI strings
    - [ ] Locale-aware dates, currencies, number formats, timezone defaults
    - [ ] Translation QA checklist per release (EN/ES/PT + fallback strategy)
  - [ ] White-label starter pack
    - [x] Tenant branding (logo, colors, app name)
    - [x] Custom domain/subdomain strategy
    - [x] Custom legal links (privacy/terms) per tenant
- [ ] Integration and ecosystem baseline
  - [ ] Provider abstraction (Google/Microsoft email, calendar)
  - [ ] CRM import/export hardening (mapping presets per industry)
  - [ ] Webhooks v1 with retry policy and signed payloads
- [ ] Enterprise trust and compliance baseline
  - [ ] Data retention policies per tenant
  - [ ] DSR flows (export/delete user data)
  - [ ] Backup/restore runbook and disaster recovery test cadence
- [ ] Manager Dashboard Pack
  - [ ] MQL->SQL conversion KPI
  - [ ] Stage aging heatmap
  - [ ] Owner response-time KPI
- [ ] API + Webhooks baseline
  - [ ] Public endpoint policy and versioning
  - [ ] Webhook subscriptions with retries

## Later

- [ ] SSO/SCIM enterprise readiness
- [ ] Governance and field-level security
- [ ] AI copilot v2
- [ ] Forecasting intelligence

## Sell-Readiness Matrix (Go-To-Market)

Use this matrix as release gates before onboarding broader customer segments.

| Capability | Current | Target | Priority |
|---|---|---|---|
| Multi-industry adaptability | Partial (custom fields, single opinionated flow) | Tenant-configurable pipelines + naming + templates | P0 |
| Language/locale quality | Partial (EN/ES/PT, some hardcoded strings found) | 100% UI i18n + locale-aware formatting | P0 |
| Enterprise permissions | Basic role model | Dynamic RBAC with profile presets + auditability | P0 |
| Branding/white-label | Limited | Full tenant branding + legal customization | P1 |
| Integrations | Partial (email-focused) | Connector abstraction + webhooks + import mapping | P1 |
| Compliance operations | Good baseline docs | Executable controls (retention, DSR, DR drills) | P1 |
| Sales enablement packaging | Low | Vertical onboarding templates + deployment playbooks | P2 |

### Suggested execution order

1. P0: Adaptability + i18n/locale + RBAC
2. P1: White-label + integrations + compliance controls
3. P2: Vertical packs and partner/channel enablement

## Sprint Plan (2 weeks)

Goal: ship the first "sell-ready" baseline for heterogeneous companies with measurable acceptance criteria.

### Sprint 1 (Week 1) — P0 foundation

- [x] Story: Remove hardcoded UI text in critical workflows
  - Scope: contacts, companies, deals, activities, auth, settings primary forms/modals.
  - Acceptance:
    - [x] No hardcoded labels in audited files (EN/ES/PT path uses i18n keys).
    - [x] Language switch reflects immediately without mixed-language UI.
    - [x] Regression pass on create/edit flows for contact/company/deal/activity.
- [x] Story: Locale-aware formatting baseline
  - Scope: date/time, currency, number formatting helpers.
  - Acceptance:
    - [x] `en/es/pt` render dates and numbers using locale utilities.
    - [x] Currency in dashboards/reports respects org setting + locale.
    - [x] Unit tests for formatter utilities and fallback behavior.
- [ ] Story: Pipeline naming configurability (MVP)
  - Scope: allow per-tenant labels for key business nouns/stages.
  - Acceptance:
    - [ ] Tenant can rename at least 5 key labels (lead/deal/stage names) from Settings.
    - [ ] UI surfaces configured labels in list/board/detail views.
    - [ ] Safe fallback to defaults when labels are incomplete.

### Sprint 2 (Week 2) — commercialization controls

- [x] Story: RBAC profile presets + matrix editor (MVP)
  - Scope: settings UI + backend persistence for permission profiles.
  - Acceptance:
    - [x] Presets available: Admin, Manager, Rep, Read-only.
    - [x] Tenant admin can clone/edit a profile and assign to users.
    - [x] Permission changes logged in audit entries.
- [x] Story: White-label starter
  - Scope: logo, primary color, app display name, custom domain and legal links.
  - Acceptance:
    - [x] Branding config persisted per organization.
    - [x] Sidebar/header/login reflect tenant branding.
    - [x] Reset-to-default path works safely.
- [x] Story: Release readiness and QA gate
  - Scope: documentation + smoke tests + release checklist.
  - Acceptance:
    - [x] "Sell-ready P0/P1 baseline" checklist completed.
    - [x] QA evidence for EN/ES/PT and role-based access scenarios.
    - [x] Go/no-go review document linked in docs.

### Definition of Done (this 2-week cycle)

- [ ] Critical customer journey works end-to-end in EN/ES/PT (login, create contact/company/deal/activity, report view).
- [x] Tenant can customize key business labels and basic branding.
- [x] Permission presets are usable in production-like environments.
- [x] QA checklist + release notes completed and archived in `docs/`.

## Execution Board (2-week operating view)

### Todo

- [x] [S] Audit remaining hardcoded strings in high-traffic modules
- [x] [M] Implement locale utility wrappers (date, number, currency)
- [x] [M] Add formatter tests + fallback scenarios
- [x] [L] Pipeline label configurability in Settings (tenant-scoped)
- [x] [L] Apply dynamic labels in list/board/detail views
- [x] [L] RBAC preset model + persistence
- [x] [M] RBAC preset assignment UI (admin flow)
- [x] [M] Permission change audit logging
- [x] [M] White-label config model (logo, color, app name)
- [x] [M] Apply branding to login/header/sidebar
- [x] [S] Release checklist template for sell-ready baseline
- [x] [S] QA evidence template (EN/ES/PT + role matrix)

### Doing

- [ ] (Move active items here daily; max 2 in parallel)

### Done

- [x] Lead maintenance operations pack
- [x] Ops documentation pack
- [x] Sell-readiness matrix with P0/P1/P2 priorities
- [x] 2-week sprint plan with acceptance criteria

## Suggested Daily Sequence

### Week 1 (Foundation / P0)

- Day 1: hardcoded-i18n audit + ticket slicing
- Day 2: i18n cleanup on core create/edit flows
- Day 3: locale formatter utilities + unit tests
- Day 4: pipeline label settings (persistence + API/store wiring)
- Day 5: dynamic label rendering + regression QA pass

### Week 2 (Commercial controls / P1)

- Day 6: RBAC data model + preset seeds
- Day 7: RBAC management UI + assignment flow
- Day 8: audit trail for permission changes + verification
- Day 9: white-label settings + UI application
- Day 10: QA evidence, release notes, go/no-go review

## Work-In-Progress Limits (recommended)

- Max 2 concurrent tasks per engineer
- No new feature start if critical QA bug is open
- Merge gate: acceptance checklist + i18n/locale smoke pass
