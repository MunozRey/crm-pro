# CRM Pro Implementation History

This document consolidates the major implementation work completed in this repository so far.
It is intended as the canonical handoff artifact for product, frontend, backend, and operations teams.

## 1) Platform and foundation

- React + TypeScript + Vite application architecture consolidated.
- Zustand stores standardized for domain data and UI state.
- Supabase integration established as primary persistence/auth/runtime backend.
- Build pipeline stabilized with passing production build (`npm run build`).

## 2) Multi-tenancy and organization model

- Tenant model implemented with organization-scoped data access:
  - `organizations`
  - `organization_members`
  - `organization_domains`
  - `organization_join_requests`
- `organization_id` propagation added to tenant-owned entities.
- RLS model enforced by tenant context and JWT claims.
- JWT helper functions and membership-driven claims update flow implemented:
  - `set_claim`
  - `get_org_id`
  - `get_user_role`
  - membership trigger path.
- Domain-based onboarding behavior implemented:
  - new domain => tenant provisioning
  - existing domain => invitation/join request flow.

## 3) Authentication and onboarding

- **User profile persistence (Supabase):** saving name, job title, phone, and avatar from the profile screen now calls `supabase.auth.updateUser` so `user_metadata` (e.g. `full_name`) survives logout/login. See **`docs/user-profile-display-names.md`** for full register, manual test checklist, and remaining gaps (CRM rows that still store display names as plain text, admin-editing other users, etc.).
- Supabase auth session bootstrap integrated into app startup.
- Login/register/forgot/reset flows connected to Supabase.
- Protected route gate implemented with tenant-resolution routing:
  - dashboard access for ready tenant
  - `/org-access-required` for invite-required users
  - `/org-setup` for users without tenant assignment.
- Tenant resolution status state added to auth store for deterministic gating.

## 4) Organization setup reliability hardening

- Original `create-org` edge-function path hardened with explicit error surfaces.
- Added self-service SQL RPC fallback path for robust org creation:
  - `create_org_self_service(p_org_name, p_slug)`
  - `SECURITY DEFINER`
  - validation + duplicate protection + membership + claim updates.
- Org setup page updated to use RPC path and show actionable error messages.

## 5) Security hardening

- Supabase advisor warning remediation applied for mutable search paths.
- Migration added to set explicit `search_path` on sensitive helper functions:
  - `handle_updated_at`
  - `set_claim`
  - `get_org_id`
  - `get_user_role`
  - `handle_new_member`.

## 6) Email tracking (HubSpot-like baseline)

- Tracking data model implemented with Supabase tables for:
  - tracking messages
  - tracking links
  - tracking events.
- Edge functions implemented:
  - `track-open`
  - `track-click`
- Outbound email flow updated to inject open pixel + rewrite links.
- Inbox tracking metrics refresh pipeline implemented.
- Timestamp semantics corrected (`openedAt` oldest, `lastOpenedAt` newest).

## 7) Leads engine (Pro baseline)

- Leads domain introduced with persistence and scoring infrastructure:
  - `leads`
  - `lead_events`
  - `lead_scoring_rules`
  - `lead_score_snapshots`.
- Leads store implemented with:
  - filtering
  - event ingestion
  - score recomputation
  - scoring-rule sync/update.
- Lead conversion path implemented:
  - local fallback conversion
  - robust server-side conversion via `promote-lead` edge function.
- Leads UI shipped with:
  - list/inbox view
  - timeline panel
  - manual scoring actions
  - scoring rules editor.
- Score safety behavior introduced:
  - hot threshold feasibility tuning
  - anti-silent-demotion guardrail
  - optional demotion mode for manual recompute.
- Batch recomputation behavior introduced for tracking-event bursts.

## 8) Localization and i18n

- Multi-language support expanded and normalized for:
  - English
  - Spanish
  - Portuguese
  - French
  - German
  - Italian.
- Login language selection available at entry point.
- Leads page i18n completed (removed hardcoded UI strings).
- Smart Views localization normalized:
  - runtime label resolution by `nameKey`
  - one-shot migration for legacy seed view names by ID and name variants
  - FR/DE/IT legacy name coverage added.
- Custom fields i18n metadata architecture implemented:
  - localized labels/placeholders/options
  - values remain language-agnostic.

## 9) UI/UX consistency improvements

- Global layout alignment unified across primary and secondary pages:
  - removed inconsistent centered `max-w-* mx-auto` wrappers where required.
- Visual consistency pass applied to settings/team/profile/detail pages.
- SSO area added in login with provider-specific logos and loading states.

## 10) SSO and enterprise auth readiness

- Login now supports provider actions for:
  - Google OAuth
  - Azure OAuth
  - Apple OAuth
  - SAML 2.0 (domain-based).
- Frontend provider feature flags added:
  - `VITE_AUTH_GOOGLE_ENABLED`
  - `VITE_AUTH_AZURE_ENABLED`
  - `VITE_AUTH_APPLE_ENABLED`
  - `VITE_AUTH_SAML_ENABLED`.
- Optional backend-driven SAML domain discovery contract added:
  - `VITE_AUTH_SAML_DISCOVERY_ENDPOINT`
  - `POST { email } -> { domain }`.
- Backend handoff doc added at `docs/auth-sso-backend-handoff.md`.

## 11) Test and regression coverage additions

- Auth store tests extended for tenant resolution states.
- Custom fields i18n tests added.
- Email tracking helper tests added.
- Views legacy-localization migration regression test added.
- Email tracking batch recompute regression test added.

## 12) Operational notes

- Some auth/email behavior depends on Supabase project configuration:
  - provider enablement
  - SMTP provider and rate limits
  - SSO/SAML provider setup.
- If user sign-up is constrained by Supabase email limits, operational mitigation is:
  - custom SMTP setup
  - temporary user creation through admin channels for QA.

## 13) Current status summary

- CRM is multi-tenant, auth-protected, localized, and production-build stable.
- Leads + tracking + conversion baseline is implemented and functioning.
- SSO UI and backend handoff contract are in place.
- Remaining PRO work is primarily advanced workflow automation, analytics depth,
  enterprise governance, and integration breadth.

## 14) Lead maintenance observability and operations

- Backend-first lead score maintenance shipped and deployed:
  - edge function `lead-score-maintenance`
  - system-mode auth via `x-maintenance-secret` + `LEAD_MAINTENANCE_SECRET`
  - tenant-specific and all-tenant execution modes.
- Health and telemetry support added:
  - `mode=health` for recent run inspection
  - telemetry persisted in `lead_score_maintenance_runs`.
- SLA guardrail shipped:
  - `mode=sla` stale-tenant detection
  - optional manager/admin notifications with cooldown control.
- Operational scripts added for backend/scheduler integration:
  - `scripts/run-lead-maintenance.mjs`
  - `scripts/check-lead-maintenance-health.mjs`
  - `scripts/check-lead-maintenance-sla.mjs`
  - npm commands: `maintenance:lead:org`, `maintenance:lead:all`, `maintenance:lead:health`, `maintenance:lead:sla`.
- Settings Ops dashboard added:
  - tenant-scoped run visibility (last success, SLA state, recent errors, run list)
  - filter by run status
  - i18n coverage for EN/ES/PT (+ inherited FR/DE/IT).
- Operations runbook added:
  - incident handling, recovery procedures, and escalation checklist for maintenance SLA.
- Production handoff checklist added:
  - pre-go-live validation
  - go-live execution checks
  - post-go-live stabilization controls.
- Hardening matrix added:
  - risk-by-domain register with impact/likelihood/priority
  - owner and ETA planning for remaining hardening gaps.
- Compliance mapping added:
  - SOC2 / GDPR-lite control-to-implementation mapping
  - evidence references and 30-day compliance action plan.

## 15) Email privacy hardening (per-user mailbox)

- Mailbox privacy model hardened so each user sees/tracks only their own email telemetry.
- Tracking schema updated with explicit `user_id` ownership in:
  - `email_tracking_messages`
  - `email_tracking_links`
  - `email_tracking_events`.
- RLS policies tightened from organization-wide access to user-scoped access:
  - `user_id = auth.uid()` plus tenant guard (`organization_id = get_org_id()`).
- Gmail thread workspace access tightened to user scope to prevent cross-user visibility.
- Tracking edge functions updated to propagate `user_id` through open/click events.
- Frontend mailbox model updated with `ownerUserId` and scoped inbox rendering.
- Inbox UX now explicitly surfaces privacy scope:
  - private mailbox badges
  - owner visibility panel in local email detail.
- Legacy data continuity path added:
  - `backfill_email_tracking_user(text[])` RPC claims old tracking rows (`user_id IS NULL`)
    for the authenticated user in the active organization.
- Support/ops runbook added:
  - `docs/email-mailbox-privacy-runbook.md`.
- Email release gate checklist added:
  - `docs/email-release-checklist.md`.
- Guided smoke validation script added:
  - `docs/email-smoke-test-15min.md` for QA/support reproducible verification.

## 16) Email Ola 3 (productivity + reliability visibility)

- Inbox advanced filters expanded with high-impact operators:
  - attachment-only
  - owner-only
  - tracking-state refinements for local mailbox views.
- Inbox saved views added for reusable query/filter presets.
- Sync-state observability surfaced in Inbox:
  - healthy/syncing/stale/error status
  - last sync error detail visibility for operators.
- Settings now exposes provider-health summary cards for email operations.
- Quick replies moved from hardcoded snippets to user-persisted data model:
  - `quick_replies` table (user + org scoped)
  - composer consumes dynamic quick replies
  - template surface supports quick reply CRUD.
