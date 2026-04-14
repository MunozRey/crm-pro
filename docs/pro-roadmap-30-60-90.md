# CRM Pro Roadmap (30/60/90)

This roadmap starts from the current implemented baseline and prioritizes features that move the product closer to HubSpot/Pipedrive-level value.

> Status refresh (2026-04-14): Navigation customization, full core i18n pack, and sell-ready baseline artifacts are already shipped. This roadmap tracks what remains after those deliveries.

## Document Control

- Status: Active
- Owner: Product
- Last updated: 2026-04-14
- Canonical: Yes

## 0-30 days (Revenue + execution fundamentals)

### Objective

Improve sales execution quality and manager visibility with measurable weekly impact.

### Deliverables

1. **Workflow Automations v1**
   - Trigger-action engine baseline:
     - lead created
     - stage changed
     - inactivity timeout
   - Actions:
     - create activity
     - assign owner
     - send internal notification.

2. **Lead Scoring v2**
   - recency decay support (event weight by age),
   - minimum confidence threshold before hot classification,
   - audit trail in score snapshots with structured reason metadata.

3. **Manager Dashboard Pack**
   - MQL->SQL conversion rate
   - stage aging heatmap
   - owner response-time KPI.

4. **Onboarding + Activation**
   - guided setup checklist per workspace,
   - first-value milestones (import contacts, create first deal, send first sequence).

### Success criteria

- 80% of new tenants complete setup checklist in first session.
- measurable reduction in stale leads/deals.
- manager weekly report can be generated from built-in dashboards only.

## 31-60 days (Enterprise readiness)

### Objective

Reduce enterprise sales blockers and increase deployability in managed environments.

### Deliverables

1. **SSO/SCIM Readiness Pack**
   - provider diagnostics UI
   - SSO connection health checks
   - user-provisioning hooks (SCIM-compatible contract for backend).

2. **Governance and Security v2**
   - field-level visibility controls for sensitive data
   - retention and delete policies
   - expanded audit coverage for auth/admin changes.

3. **API + Webhooks**
   - stable public API surface for core entities
   - outbound webhook subscriptions (lead/deal/activity lifecycle events)
   - replay/dead-letter strategy.

4. **Reliability Controls**
   - retry and idempotency for critical async flows
   - runbooks for auth/onboarding/integration incidents
   - migration safety checklist automation.

### Success criteria

- enterprise pilot can complete security checklist without custom patches.
- external systems can sync entities via API/webhooks reliably.
- admin actions are fully auditable by workspace.

## 61-90 days (Differentiation and intelligence)

### Objective

Move from “feature parity” toward differentiation through intelligence and velocity.

### Deliverables

1. **AI Copilot v2**
   - account summary
   - next-best-action recommendations
   - meeting prep briefs
   - contextual email draft generation.

2. **Forecasting and Revenue Intelligence**
   - weighted forecast by confidence and historical conversion
   - commit/best-case/worst-case views
   - slippage prediction baseline.

3. **Advanced Sequences**
   - multi-channel sequence steps
   - pause/resume + branching rules
   - outcome analytics by step.

4. **Pro UX polish**
   - role-based workspace home
   - bulk operations with preview/undo for sensitive actions
   - template library for automations and views.

### Success criteria

- forecast variance reduced month-over-month.
- users complete common sales workflows with fewer manual steps.
- tenant expansion signals improve (more active seats, more automation usage).

## Execution order recommendation

1. Automations v1
2. Lead Scoring v2
3. Manager Dashboard Pack
4. SSO/SCIM readiness
5. API/Webhooks
6. AI Copilot v2 + Forecasting

## Immediate sprint start (next coding block)

Start with **Workflow Automations v1** in this order:

1. Database schema for automation rules and execution logs.
2. Store/service layer for CRUD and trigger evaluation.
3. Minimal UI editor for rule definition.
4. Trigger integration on lead/deal state changes.
5. Execution audit view for debugging and trust.
