# CRM Pro — Roadmap

**Milestone:** v1.0 — Full SaaS Upgrade
**Status:** Phase 10 Pending Deploy
**Phases:** 10
**Last updated:** 2026-04-10

---

## Phases

- [x] **Phase 1: Schema & Multi-Tenancy** — Add `organization_id` + RLS to all tables; create organizations, members, invitations, and gmail_tokens tables (completed 2026-03-31)
- [x] **Phase 2: Supabase Auth** — Replace mock djb2 auth with real Supabase Auth (signup, login, session, password reset, logout) (completed 2026-04-05)
- [x] **Phase 3: Organization Onboarding** — First-login org creation, member invitations, roles, and org-scoped JWT claims (completed 2026-04-06)
- [x] **Phase 4: Security Fixes** — Remove API keys from localStorage, fix XSS, remove dangerouslyAllowBrowser, add dev warning for missing env vars (completed 2026-04-07)
- [x] **Phase 5: Core Data Stores + Real-Time** — Migrate contacts, companies, deals, activities, notifications to Supabase with real-time subscriptions (completed 2026-04-07)
- [x] **Phase 6: Secondary Stores & Real Users** — Migrate remaining stores; replace MOCK_USERS; remove AI features and Leaderboard; unify Lead=Contact (completed 2026-04-08)
- [x] **Phase 7: Gmail Integration** — Auth Code + PKCE OAuth flow; Edge Functions for token exchange and refresh; inbox, send, and contact linking (completed 2026-04-09)
- [x] **Phase 8: i18n English** — English translation file and language switcher persistence (completed 2026-04-09)
- [x] **Phase 9: Test Suite** — Vitest setup; unit tests for stores, Zod schemas, and GitHub Actions CI (completed 2026-04-10)
- [ ] **Phase 10: Vercel Deployment** — vercel.json SPA rewrite, env vars, preview deployments, production deploy, custom domain

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schema & Multi-Tenancy | 5/5 | Complete    | 2026-03-31 |
| 2. Supabase Auth | 5/5 | Complete    | 2026-04-05 |
| 3. Organization Onboarding | 4/4 | Complete   | 2026-04-06 |
| 4. Security Fixes | 4/4 | ✅ Complete | 2026-04-07 |
| 5. Core Data Stores + Real-Time | 4/4 | ✅ Complete | 2026-04-07 |
| 6. Secondary Stores & Real Users | 5/5 | ✅ Complete | 2026-04-08 |
| 7. Gmail Integration | 5/5 | ✅ Complete | 2026-04-09 |
| 8. i18n English | 3/3 | ✅ Complete | 2026-04-09 |
| 9. Test Suite | 6/6 | ✅ Complete | 2026-04-10 |
| 10. Vercel Deployment | 0/5 | Pending Deploy | - |

---

## Phase Details

---

## Phase 1: Schema & Multi-Tenancy

**Goal:** Every table has `organization_id` + RLS enforced via JWT claims; all new tables (organizations, members, invitations, gmail_tokens) are created and indexed.
**Dependencies:** None

### Plans

- 1.1: Add `organization_id` to core tables — ALTER existing contacts, companies, deals, activities, notifications tables to add `organization_id uuid NOT NULL REFERENCES organizations(id)`
- 1.2: Create organizations and organization_members tables — SQL migration for organizations, organization_members, and invitations with correct FK structure and unique constraints
- 1.3: Create gmail_tokens table — SQL migration for server-side refresh token storage (user_id, organization_id, encrypted tokens, scopes, expiry)
- 1.4: Write RLS policies on all tables — JWT claim check `(auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid` on every tenant-scoped table; replace the current auth-only blind policies
- 1.5: Add JWT claim trigger — PostgreSQL function `handle_new_member` + trigger to write `organization_id` and `role` into `auth.users.raw_app_meta_data` on organization_members insert/update

### Requirements Covered

SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05

### Done When

- [ ] Running `SELECT * FROM contacts` as a user from org A returns zero rows from org B
- [ ] `organization_members` insert fires the trigger and `auth.jwt() -> 'app_metadata' ->> 'organization_id'` is populated for that user
- [ ] `gmail_tokens` table exists with correct columns and RLS preventing cross-user reads
- [ ] All 5 SCHEMA requirements pass a manual SQL inspection against the live schema
- [ ] TypeScript `database.types.ts` reflects all new tables (regenerated via Supabase CLI)

---

## Phase 2: Supabase Auth

**Goal:** Users can register, log in, reset their password, and have their session persist across page refreshes — replacing the mock djb2 system entirely.
**Dependencies:** Phase 1

### Plans

- 2.1: Wire Supabase Auth signup — replace `authStore.register()` mock with `supabase.auth.signUp()`; handle email verification state in UI
- 2.2: Wire Supabase Auth login and session — replace `authStore.login()` with `supabase.auth.signInWithPassword()`; implement `onAuthStateChange` listener to hydrate `AuthUser` from the Supabase session
- 2.3: Implement password reset flow — trigger `supabase.auth.resetPasswordForEmail()` on forgot-password page; handle the `PASSWORD_RECOVERY` event in `onAuthStateChange` to show the reset form
- 2.4: Session persistence and race condition guard — implement `isLoadingAuth: true` initial state in `authStore`; prevent `ProtectedRoute` redirect until `onAuthStateChange` fires the first event
- 2.5: Implement logout — call `supabase.auth.signOut()`, clear all persisted Zustand state, redirect to `/login`

### Requirements Covered

AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, SEC-01, SEC-06

### Done When

- [ ] New user can register with email/password and receives a verification email
- [ ] Verified user can log in; refreshing the page keeps them logged in without a redirect to `/login`
- [ ] User who requests password reset receives the email link and can set a new password
- [ ] Logging out clears the session and redirects to `/login`; pressing Back does not restore the authenticated state
- [ ] Opening the app cold while not authenticated shows the login page, not a brief flash of the dashboard

---

## Phase 3: Organization Onboarding

**Goal:** A newly authenticated user can create or join an organization, invite teammates by email, and have their role enforced throughout the app.
**Dependencies:** Phase 2

### Plans

- 3.1: First-login org creation flow — detect new users with no `organization_id` in JWT claims; render an onboarding screen to collect org name and slug; insert into `organizations` and `organization_members`
- 3.2: Member invitation Edge Function — Supabase Edge Function `invite-member` using service role key to call `supabase.auth.admin.inviteUserByEmail()` with org metadata; write pending row to `invitations` table
- 3.3: Invitation acceptance flow — handle invited user's first login; read `invitations` row by token; insert into `organization_members`; fire JWT claim trigger
- 3.4: Role enforcement in UI — map org member roles (owner, admin, member) to the existing `UserRole` permission system; `PermissionGate` and `ProtectedRoute` driven by real role from Supabase, not hardcoded mock

### Requirements Covered

AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10

### Done When

- [ ] A brand-new user completing email verification lands on an org creation screen, not the dashboard
- [ ] After creating an org, the user reaches the dashboard and `auth.jwt() -> 'app_metadata' ->> 'organization_id'` is set
- [ ] An admin can send an invitation email to a new address; the invitee receives the email
- [ ] The invited user can accept the invitation and log into the same organization with the assigned role
- [ ] A `member`-role user cannot access pages or actions restricted to `admin` (e.g., Settings > Users, delete actions)

---

## Phase 4: Security Fixes

**Goal:** All API keys are off the browser, the XSS vector in AIAgent is closed, and developers get a visible warning when Supabase is not configured.
**Dependencies:** Phase 2

### Plans

- 4.1: Remove Anthropic key from localStorage — delete `apiKey` from `aiStore` persist partialize; remove the Settings UI field that saves it; key will live exclusively in Edge Function env vars after Phase 7
- 4.2: Fix XSS in AIAgent — replace `dangerouslySetInnerHTML` + hand-rolled `renderMarkdown()` with `react-markdown` + `rehype-sanitize`; audit all other `dangerouslySetInnerHTML` usages in the codebase
- 4.3: Remove `dangerouslyAllowBrowser` from aiService — delete the `new Anthropic({ dangerouslyAllowBrowser: true })` instantiation; stub all AI service calls to throw until the Edge Function proxy is wired in Phase 7
- 4.4: Dev-mode Supabase warning — in `src/lib/supabase.ts`, add `console.warn` (dev only, `import.meta.env.DEV`) when `!isSupabaseConfigured`; optionally surface a UI banner in Settings

### Requirements Covered

SEC-02, SEC-03, SEC-04, SEC-06

### Done When

- [ ] `localStorage.getItem('crm_ai')` in browser DevTools no longer contains an Anthropic API key field
- [ ] Pasting `<script>alert(1)</script>` as a simulated AI response into AIAgent renders it as escaped text, not an alert
- [ ] `aiService.ts` has no reference to `dangerouslyAllowBrowser`
- [ ] Starting the app locally without `.env.local` shows a console warning identifying the missing Supabase config

---

## Phase 5: Core Data Stores + Real-Time

**Goal:** Contacts, companies, deals, activities, and notifications are fully persisted in Supabase with optimistic updates, loading states, and real-time sync across browser tabs.
**Dependencies:** Phase 3 (org context in JWT required for RLS to pass)

### Plans

- 5.1: Migrate contactsStore to Supabase — replace `persist` middleware with async Supabase CRUD calls; add `isLoading`/`error` state; implement optimistic updates with `updated_at` guard; remove `onRehydrateStorage` seed hook
- 5.2: Migrate companiesStore and activitiesStore to Supabase — same migration pattern as contacts; wire `organization_id` on all inserts
- 5.3: Migrate dealsStore to Supabase — migrate deal CRUD; preserve cross-store side effects (audit log, notifications, automations trigger) after each Supabase mutation
- 5.4: Migrate notificationsStore to Supabase — migrate notifications CRUD; ensure in-app notification bell reads from Supabase, not localStorage
- 5.5: Add Realtime subscriptions to contacts, deals, activities, notifications — `supabase.channel().on('postgres_changes', ...)` for each table; merge incoming events with optimistic state using `updated_at` guard to prevent double-apply
- 5.6: Remove seed data hooks and localStorage fallbacks — delete all `onRehydrateStorage` seed callbacks from migrated stores; remove `LS_KEYS` references for migrated entities; add `DATA-06` / `DATA-07` / `DATA-08` compliance to each store

### Requirements Covered

DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, REALTIME-01, REALTIME-02, REALTIME-03, REALTIME-04

### Done When

- [ ] Creating a contact in one browser tab appears in a second logged-in tab within 2 seconds without a manual refresh
- [ ] Refreshing the page after creating a deal shows the deal (data survived the page reload via Supabase, not localStorage)
- [ ] A network error during a contact save shows an error message in the UI (loading/error states working)
- [ ] `localStorage.getItem('crm_contacts')` returns `null` after the migration (no localStorage fallback active)
- [ ] Two users in the same org both see the same pipeline board; a user in a different org cannot see their data

---

## Phase 6: Secondary Stores & Real Users

**Goal:** All remaining stores are migrated to Supabase, MOCK_USERS is eliminated everywhere, and analytics reflect real org members.
**Dependencies:** Phase 5

### Plans

- 6.1: Migrate goalsStore, sequencesStore, automationsStore to Supabase — write SQL migrations for missing tables; replace localStorage persist with Supabase CRUD in each store
- 6.2: Migrate templateStore, productsStore to Supabase — SQL migrations + store migration; these are simpler read-heavy stores with no cross-store side effects
- 6.3: Migrate auditStore and customFieldsStore to Supabase — SQL migrations for audit_log and custom_fields tables; remove 500-entry localStorage cap; preserve audit log calls from all CRUD stores
- 6.4: Replace MOCK_USERS in all 9 files — swap `MOCK_USERS` import with `useAuthStore((s) => s.users)` selector mapped to `{ value, label }` in ContactForm, DealForm, ActivityForm, Contacts, Deals, Dashboard, Leaderboard, Reports, PipelineTimeline
- 6.5: Fix analytics for real users — Leaderboard and Reports computed metrics must iterate over real `organization_members` fetched from Supabase, not the hardcoded array; `USERS-02` and `USERS-03` compliance

### Requirements Covered

DATA-09, DATA-10, DATA-11, DATA-12, DATA-13, DATA-14, DATA-15, USERS-01, USERS-02, USERS-03

### Done When

- [ ] Creating a sales goal persists across page refreshes (stored in Supabase, not localStorage)
- [ ] Inviting a new team member causes their name to appear in "Assigned to" dropdowns without any code change
- [ ] The Leaderboard shows the invited team member's activity stats once they log activities
- [ ] `localStorage.getItem('crm_audit')` returns `null`; audit entries are queryable from the Supabase dashboard
- [ ] Reports page shows only real org members in the performance breakdown, not "David Muñoz / Sara López / Carlos Vega"

---

## Phase 7: Gmail Integration

**Goal:** Users can connect Gmail via Auth Code + PKCE, and the CRM can read their inbox, send emails from contact/deal pages, and link incoming emails to contacts automatically.
**Dependencies:** Phase 5 (contacts in Supabase for email linking)

**Plans:** 5/5 plans executed

Plans:
- [x] 07-1-PLAN.md — PKCE OAuth initiation + GmailTokenContext + emailStore cleanup (Wave 1)
- [x] 07-2-PLAN.md — gmail_tokens schema + gmail-oauth-exchange + gmail-refresh-token Edge Functions (Wave 1)
- [x] 07-3-PLAN.md — GmailCallback page + App.tsx route + useDataInit silent refresh (Wave 2)
- [x] 07-4-PLAN.md — Inbox wired to real Gmail threads + contact email matching chips (Wave 3)
- [x] 07-5-PLAN.md — Send email from ContactDetail/Deals + activity logging on send (Wave 4)
- [x] 07-HARDENING — Dynamic redirect URI, refresh/retry in Inbox+Composer, persisted `gmail_thread_links`, pin/unpin links, demo linked emails

### Requirements Covered

GMAIL-01, GMAIL-02, GMAIL-03, GMAIL-04, GMAIL-05, GMAIL-06, SEC-05

### Done When

- [ ] Clicking "Connect Gmail" initiates a redirect to Google's consent screen (not a popup)
- [ ] After granting consent, the callback page exchanges the code via Edge Function and the user's inbox loads
- [ ] Closing and reopening the app silently refreshes the Gmail token without re-prompting the user
- [x] `localStorage.getItem('crm_emails*')` contains no persisted Gmail access token field
- [x] Receiving an email from a known contact's email address shows a contact chip in the inbox thread list
- [x] Sending an email from a deal detail page logs it as an activity on that deal
- [x] User can pin/unpin thread-to-CRM linkage and keep it stable across sessions

---

## Phase 8: i18n English

**Goal:** A complete English translation file exists and users can switch language preference from Settings with the choice persisting across sessions.
**Dependencies:** Phase 2 (user session for preference persistence)

### Plans

- 8.1: Audit all Spanish keys in `es.ts` — enumerate every key in the existing Spanish translation file; identify any keys referenced in components but missing from the file (gaps)
- 8.2: Complete `en.ts` with full English translations — ensure parity (same key count, no missing keys that would fall back to raw key strings)
- 8.3: Language switcher and persistence — add language selector to Settings; confirm `useI18nStore` persists the selection; verify all pages re-render in English when the switcher is toggled

### Requirements Covered

I18N-01, I18N-02

### Done When

- [ ] Switching to English in Settings causes every visible UI string to switch to English with no raw translation keys visible
- [ ] Refreshing the page after switching to English keeps the app in English
- [ ] The English translation file has the same number of keys as `es.ts` (verified by count comparison)

---

## Phase 9: Test Suite

**Goal:** Vitest is configured and running in CI; store actions and form validation schemas all have unit test coverage.
**Dependencies:** None

### Plans

- 9.1: Configure Vitest + testing libraries — install `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`; create `vitest.config.ts` with jsdom env, path alias, coverage config; create `src/test/setup.ts`
- 9.2: Write Zustand store tests — `contactsStore.test.ts` and `dealsStore.test.ts`; mock Supabase client; test add/update/delete actions; test `getFilteredContacts` / `getFilteredDeals` selectors; reset store state in `beforeEach`
- 9.3: Write Zod schema tests — test form validation schemas for ContactForm, DealForm, ActivityForm; assert required field errors, type coercion, and valid payloads pass without ceremony
- 9.4: Write utility tests — followUpEngine, formatters, permissions
- 9.5: GitHub Actions CI workflow — create `.github/workflows/ci.yml` running `tsc --noEmit` and `vitest run` on push to `main` and on all PRs; fail the workflow if either command exits non-zero

### Requirements Covered

TEST-01, TEST-02, TEST-03, TEST-04, TEST-05

### Done When

- [ ] `npm run test:run` exits 0 with all tests passing from a clean clone
- [ ] `npm run test:coverage` shows coverage report
- [ ] Opening a PR on GitHub triggers the CI workflow and shows test + type check results in the PR checks
- [ ] A deliberate type error in `src/types/index.ts` causes the CI `tsc --noEmit` step to fail
- [ ] A deliberate logic error in a utility causes at least one test to fail

---

## Phase 10: Vercel Deployment

**Goal:** The app is deployed to Vercel with correct SPA routing, staging and production environments pointing to separate Supabase projects, and a custom domain serving the production build.
**Dependencies:** Phase 9 (CI must pass before production deploy)

### Plans

- 10.1: Create `vercel.json` — add SPA catch-all rewrite `{ "source": "/(.*)", "destination": "/index.html" }` at repo root; verify React Router deep links work on direct load
- 10.2: Connect repo to Vercel and configure env vars — link GitHub repo to Vercel project; set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production and Preview environments separately
- 10.3: Verify preview deployments — push a feature branch; confirm Vercel creates a preview URL hitting staging Supabase, not production
- 10.4: Production deploy on main merge — merge to `main`; confirm Vercel deploys to production; smoke test: signup, login, create contact, log activity
- 10.5: Configure custom domain — add domain in Vercel; add CNAME or A record at registrar; confirm TLS certificate is auto-provisioned by Vercel

### Requirements Covered

DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05

### Done When

- [ ] Navigating directly to `/contacts` returns the Contacts page, not a 404
- [ ] A PR branch gets an automatic preview URL
- [ ] The preview URL hits staging Supabase (verified in DevTools)
- [ ] Merging to `main` triggers a production deployment that completes successfully
- [ ] The custom domain serves the app over HTTPS with a valid TLS certificate

---

## Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 1 | ✅ Complete |
| SCHEMA-02 | Phase 1 | ✅ Complete |
| SCHEMA-03 | Phase 1 | ✅ Complete |
| SCHEMA-04 | Phase 1 | ✅ Complete |
| SCHEMA-05 | Phase 1 | ✅ Complete |
| AUTH-01 | Phase 2 | ✅ Complete |
| AUTH-02 | Phase 2 | ✅ Complete |
| AUTH-03 | Phase 2 | ✅ Complete |
| AUTH-04 | Phase 2 | ✅ Complete |
| AUTH-05 | Phase 2 | ✅ Complete |
| SEC-01 | Phase 2 | ✅ Complete |
| SEC-06 | Phase 2 | ✅ Complete |
| AUTH-06 | Phase 3 | ✅ Complete |
| AUTH-07 | Phase 3 | ✅ Complete |
| AUTH-08 | Phase 3 | ✅ Complete |
| AUTH-09 | Phase 3 | ✅ Complete |
| AUTH-10 | Phase 3 | ✅ Complete |
| SEC-02 | Phase 4 | ✅ Complete |
| SEC-03 | Phase 4 | ✅ Complete |
| SEC-04 | Phase 4 | ✅ Complete |
| DATA-01 | Phase 5 | ✅ Complete |
| DATA-02 | Phase 5 | ✅ Complete |
| DATA-03 | Phase 5 | ✅ Complete |
| DATA-04 | Phase 5 | ✅ Complete |
| DATA-05 | Phase 5 | ✅ Complete |
| DATA-06 | Phase 5 | ✅ Complete |
| DATA-07 | Phase 5 | ✅ Complete |
| DATA-08 | Phase 5 | ✅ Complete |
| REALTIME-01 | Phase 5 | ✅ Complete |
| REALTIME-02 | Phase 5 | ✅ Complete |
| REALTIME-03 | Phase 5 | ✅ Complete |
| REALTIME-04 | Phase 5 | ✅ Complete |
| DATA-09 | Phase 6 | ✅ Complete |
| DATA-10 | Phase 6 | ✅ Complete |
| DATA-11 | Phase 6 | ✅ Complete |
| DATA-12 | Phase 6 | ✅ Complete |
| DATA-13 | Phase 6 | ✅ Complete |
| DATA-14 | Phase 6 | ✅ Complete |
| DATA-15 | Phase 6 | ✅ Complete |
| USERS-01 | Phase 6 | ✅ Complete |
| USERS-02 | Phase 6 | ✅ Complete |
| USERS-03 | Phase 6 | ✅ Complete |
| GMAIL-01 | Phase 7 | ✅ Complete |
| GMAIL-02 | Phase 7 | ✅ Complete |
| GMAIL-03 | Phase 7 | ✅ Complete |
| GMAIL-04 | Phase 7 | ✅ Complete |
| GMAIL-05 | Phase 7 | ✅ Complete |
| GMAIL-06 | Phase 7 | ✅ Complete |
| SEC-05 | Phase 7 | ✅ Complete |
| I18N-01 | Phase 8 | ✅ Complete |
| I18N-02 | Phase 8 | ✅ Complete |
| TEST-01 | Phase 9 | ✅ Complete |
| TEST-02 | Phase 9 | ✅ Complete |
| TEST-03 | Phase 9 | ✅ Complete |
| TEST-04 | Phase 9 | ✅ Complete |
| TEST-05 | Phase 9 | ✅ Complete |
| DEPLOY-01 | Phase 10 | Pending Deploy |
| DEPLOY-02 | Phase 10 | Pending Deploy |
| DEPLOY-03 | Phase 10 | Pending Deploy |
| DEPLOY-04 | Phase 10 | Pending Deploy |
| DEPLOY-05 | Phase 10 | Pending Deploy |

**Requirements mapped:** see the table above for per-requirement status; only Phase 10 deployment requirements remain pending for release readiness.

---

*Roadmap created: 2026-03-31*
