# CRM Pro — Roadmap

**Milestone:** v1.0 — Full SaaS Upgrade
**Status:** Planning
**Phases:** 11
**Last updated:** 2026-03-31

---

## Phases

- [ ] **Phase 1: Schema & Multi-Tenancy** — Add `organization_id` + RLS to all tables; create organizations, members, invitations, and gmail_tokens tables
- [ ] **Phase 2: Supabase Auth** — Replace mock djb2 auth with real Supabase Auth (signup, login, session, password reset, logout)
- [ ] **Phase 3: Organization Onboarding** — First-login org creation, member invitations, roles, and org-scoped JWT claims
- [ ] **Phase 4: Security Fixes** — Remove API keys from localStorage, fix XSS in AIAgent, remove dangerouslyAllowBrowser, add dev warning for missing env vars
- [ ] **Phase 5: Core Data Stores + Real-Time** — Migrate contacts, companies, deals, activities, notifications stores from localStorage to Supabase with real-time subscriptions
- [ ] **Phase 6: Secondary Stores & Real Users** — Migrate goals, sequences, automations, templates, products, audit, custom fields; replace MOCK_USERS with real org members
- [ ] **Phase 7: AI Features** — Edge Function proxy for Claude; lead scoring, email drafting, call summary, and AIAgent chat via proxy
- [ ] **Phase 8: Gmail Integration** — Auth Code + PKCE OAuth flow; Edge Functions for token exchange and refresh; inbox, send, and contact linking
- [ ] **Phase 9: i18n English** — English translation file and language switcher persistence
- [ ] **Phase 10: Test Suite** — Vitest setup; unit tests for lead scoring, stores, Zod schemas, and GitHub Actions CI
- [ ] **Phase 11: Vercel Deployment** — vercel.json SPA rewrite, env vars, preview deployments, production deploy, custom domain

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schema & Multi-Tenancy | 0/5 | Not started | - |
| 2. Supabase Auth | 0/5 | Not started | - |
| 3. Organization Onboarding | 0/4 | Not started | - |
| 4. Security Fixes | 0/4 | Not started | - |
| 5. Core Data Stores + Real-Time | 0/6 | Not started | - |
| 6. Secondary Stores & Real Users | 0/5 | Not started | - |
| 7. AI Features | 0/5 | Not started | - |
| 8. Gmail Integration | 0/6 | Not started | - |
| 9. i18n English | 0/3 | Not started | - |
| 10. Test Suite | 0/5 | Not started | - |
| 11. Vercel Deployment | 0/5 | Not started | - |

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

## Phase 7: AI Features

**Goal:** All Claude API calls flow through a Supabase Edge Function proxy (no key in browser), and lead scoring, email drafting, and call summary all work end-to-end.
**Dependencies:** Phase 4 (dangerouslyAllowBrowser removed), Phase 5 (contact/deal data in Supabase)

### Plans

- 7.1: Create `claude-proxy` Edge Function — Deno function that reads `ANTHROPIC_API_KEY` from env, accepts `{ model, messages, stream }` body, proxies to Anthropic API, returns streaming response; authenticate caller via Supabase JWT
- 7.2: Update aiService.ts to call Edge Function — replace all `new Anthropic(...)` calls with `fetch('/functions/v1/claude-proxy', ...)`; handle streaming response parsing; remove `openRouterKey` browser dependency
- 7.3: Wire AIAgent chat to proxy — AIAgent.tsx sends messages to `claude-proxy` Edge Function instead of browser SDK; streaming works in the chat UI
- 7.4: Implement lead scoring automation — `leadScoring.ts` `computeLeadScore` recalculates and writes to contact record whenever an activity is logged for that contact; score visible on contact list and detail page
- 7.5: Implement email drafting and call summary — email draft action on ContactDetail / DealDetail pages calls `claude-proxy` with contact + deal history context; call summary textarea on ActivityForm calls proxy with transcript input

### Requirements Covered

AI-01, AI-02, AI-03, AI-04, AI-05, SEC-02, SEC-04

### Done When

- [ ] Opening DevTools Network tab during an AI chat shows requests going to `/functions/v1/claude-proxy`, not directly to `api.anthropic.com`
- [ ] Logging an email activity for a contact triggers a lead score recalculation visible on the contact card
- [ ] Selecting a contact and clicking "Draft Email" returns a context-aware draft in under 10 seconds
- [ ] Pasting a call transcript into the call summary tool returns a structured summary with key points and next steps
- [ ] AIAgent chat streams responses in real time with no `dangerouslyAllowBrowser` in any source file

---

## Phase 8: Gmail Integration

**Goal:** Users can connect Gmail via Auth Code + PKCE, and the CRM can read their inbox, send emails from contact/deal pages, and link incoming emails to contacts automatically.
**Dependencies:** Phase 4 (token security), Phase 5 (contacts in Supabase for email linking), Phase 7 (Edge Functions infrastructure in place)

### Plans

- 8.1: Implement Auth Code + PKCE initiation — replace `initTokenClient` with `initCodeClient` in `gmailService.ts`; generate `code_verifier`, `code_challenge`, `state`; store verifier + state in `sessionStorage`; redirect to Google authorization endpoint with `access_type=offline&prompt=consent`
- 8.2: Create `gmail-oauth-exchange` Edge Function — Deno function that receives `{ code, code_verifier }` from the SPA callback; POSTs to Google token endpoint; stores `refresh_token` in `gmail_tokens` table; returns only the short-lived `access_token` to the browser
- 8.3: Create `gmail-refresh-token` Edge Function — Deno function that looks up the stored refresh token for the authenticated user; calls Google token refresh endpoint; returns a new short-lived `access_token` to the browser; access token never stored in localStorage
- 8.4: Inbox view via real Gmail API — `gmailService.ts` reads threads using the short-lived access token from memory; `emailStore.ts` access token stored in React state only (not Zustand persist); inbox renders real Gmail threads
- 8.5: Send emails from contact/deal pages — "Send Email" action on ContactDetail and DealDetail calls Gmail API send endpoint with the in-memory access token; logs sent email as an activity in the CRM
- 8.6: Link incoming emails to contacts — when loading inbox threads, match sender email addresses against `contacts` table; create activity entries linking the email thread to the matching contact

### Requirements Covered

GMAIL-01, GMAIL-02, GMAIL-03, GMAIL-04, GMAIL-05, GMAIL-06, SEC-05

### Done When

- [ ] Clicking "Connect Gmail" initiates a redirect to Google's consent screen (not a popup)
- [ ] After granting consent, the callback page exchanges the code via Edge Function and the user's inbox loads
- [ ] Closing and reopening the app silently refreshes the Gmail token without re-prompting the user
- [ ] `localStorage.getItem('crm_emails')` contains no `accessToken` field
- [ ] Receiving an email from a known contact's email address creates a linked activity in the CRM activity feed
- [ ] Sending an email from a deal detail page logs it as an activity on that deal

---

## Phase 9: i18n English

**Goal:** A complete English translation file exists and users can switch language preference from Settings with the choice persisting across sessions.
**Dependencies:** Phase 2 (user session for preference persistence)

### Plans

- 9.1: Audit all Spanish keys in `es.ts` — enumerate every key in the existing Spanish translation file; identify any keys referenced in components but missing from the file (gaps)
- 9.2: Create `en.json` with full English translations — write the English equivalent for every Spanish key; ensure parity (same key count, no missing keys that would fall back to raw key strings)
- 9.3: Language switcher and persistence — add language selector to Settings (or user profile dropdown); confirm `useI18nStore` persists the selection; verify all pages re-render in English when the switcher is toggled

### Requirements Covered

I18N-01, I18N-02

### Done When

- [ ] Switching to English in Settings causes every visible UI string to switch to English with no raw translation keys visible
- [ ] Refreshing the page after switching to English keeps the app in English
- [ ] The English translation file has the same number of keys as `es.ts` (verified by count comparison)

---

## Phase 10: Test Suite

**Goal:** Vitest is configured and running in CI; lead scoring, store actions, and form validation schemas all have unit test coverage.
**Dependencies:** Phase 7 (lead scoring must be final before testing it)

### Plans

- 10.1: Configure Vitest + testing libraries — install `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`; create `vitest.config.ts` with jsdom env, path alias, coverage config; create `src/test/setup.ts` with localStorage mock and jest-dom import
- 10.2: Write lead scoring unit tests — `src/utils/leadScoring.test.ts`; test `computeLeadScore` and `calculateLeadScore` for cold contact (score 0), hot contact (max recency), customer status bonus, and cap at 100; run in node environment (no jsdom needed)
- 10.3: Write Zustand store tests — `contactsStore.test.ts` and `dealsStore.test.ts`; mock Supabase client; test add/update/delete actions; test `getFilteredContacts` / `getFilteredDeals` selectors; reset store state in `beforeEach`
- 10.4: Write Zod schema tests — test form validation schemas for ContactForm, DealForm, ActivityForm; assert required field errors, type coercion, and valid payloads pass without ceremony
- 10.5: GitHub Actions CI workflow — create `.github/workflows/ci.yml` running `tsc --noEmit` and `vitest run` on push to `main` and on all PRs; fail the workflow if either command exits non-zero

### Requirements Covered

TEST-01, TEST-02, TEST-03, TEST-04, TEST-05

### Done When

- [ ] `npm run test:run` exits 0 with all tests passing from a clean clone
- [ ] `npm run test:coverage` shows coverage report with lead scoring utility at 100% line coverage
- [ ] Opening a PR on GitHub triggers the CI workflow and shows test + type check results in the PR checks
- [ ] A deliberate type error in `src/types/index.ts` causes the CI `tsc --noEmit` step to fail
- [ ] A deliberate logic error in `leadScoring.ts` causes at least one test to fail

---

## Phase 11: Vercel Deployment

**Goal:** The app is deployed to Vercel with correct SPA routing, staging and production environments pointing to separate Supabase projects, and a custom domain serving the production build.
**Dependencies:** Phase 10 (CI must pass before production deploy)

### Plans

- 11.1: Create `vercel.json` — add SPA catch-all rewrite `{ "source": "/(.*)", "destination": "/index.html" }` at repo root; verify React Router deep links work on direct load
- 11.2: Connect repo to Vercel and configure env vars — link GitHub repo to Vercel project; set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production (prod Supabase project) and Preview (staging Supabase project) environments separately
- 11.3: Verify preview deployments — push a feature branch; confirm Vercel creates a preview URL; confirm the preview URL hits the staging Supabase project, not production
- 11.4: Production deploy on main merge — merge to `main`; confirm Vercel deploys to production; smoke test: signup, login, create contact, log activity all work on the live URL
- 11.5: Configure custom domain — add domain in Vercel Project Settings > Domains; add CNAME or A record at registrar; wait for DNS propagation; confirm TLS certificate is auto-provisioned by Vercel

### Requirements Covered

DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05

### Done When

- [ ] Navigating directly to `https://yourdomain.com/contacts` returns the Contacts page, not a 404
- [ ] A PR branch gets an automatic preview URL posted as a comment on the PR
- [ ] The preview URL's network requests hit the staging Supabase URL (verified in DevTools)
- [ ] Merging to `main` triggers a production deployment that completes successfully
- [ ] The custom domain serves the app over HTTPS with a valid TLS certificate

---

## Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 1 | Pending |
| SCHEMA-02 | Phase 1 | Pending |
| SCHEMA-03 | Phase 1 | Pending |
| SCHEMA-04 | Phase 1 | Pending |
| SCHEMA-05 | Phase 1 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| SEC-01 | Phase 2 | Pending |
| SEC-06 | Phase 2 | Pending |
| AUTH-06 | Phase 3 | Pending |
| AUTH-07 | Phase 3 | Pending |
| AUTH-08 | Phase 3 | Pending |
| AUTH-09 | Phase 3 | Pending |
| AUTH-10 | Phase 3 | Pending |
| SEC-02 | Phase 4 | Pending |
| SEC-03 | Phase 4 | Pending |
| SEC-04 | Phase 4 | Pending |
| SEC-06 | Phase 4 | Pending |
| DATA-01 | Phase 5 | Pending |
| DATA-02 | Phase 5 | Pending |
| DATA-03 | Phase 5 | Pending |
| DATA-04 | Phase 5 | Pending |
| DATA-05 | Phase 5 | Pending |
| DATA-06 | Phase 5 | Pending |
| DATA-07 | Phase 5 | Pending |
| DATA-08 | Phase 5 | Pending |
| REALTIME-01 | Phase 5 | Pending |
| REALTIME-02 | Phase 5 | Pending |
| REALTIME-03 | Phase 5 | Pending |
| REALTIME-04 | Phase 5 | Pending |
| DATA-09 | Phase 6 | Pending |
| DATA-10 | Phase 6 | Pending |
| DATA-11 | Phase 6 | Pending |
| DATA-12 | Phase 6 | Pending |
| DATA-13 | Phase 6 | Pending |
| DATA-14 | Phase 6 | Pending |
| DATA-15 | Phase 6 | Pending |
| USERS-01 | Phase 6 | Pending |
| USERS-02 | Phase 6 | Pending |
| USERS-03 | Phase 6 | Pending |
| AI-01 | Phase 7 | Pending |
| AI-02 | Phase 7 | Pending |
| AI-03 | Phase 7 | Pending |
| AI-04 | Phase 7 | Pending |
| AI-05 | Phase 7 | Pending |
| GMAIL-01 | Phase 8 | Pending |
| GMAIL-02 | Phase 8 | Pending |
| GMAIL-03 | Phase 8 | Pending |
| GMAIL-04 | Phase 8 | Pending |
| GMAIL-05 | Phase 8 | Pending |
| GMAIL-06 | Phase 8 | Pending |
| SEC-05 | Phase 8 | Pending |
| I18N-01 | Phase 9 | Pending |
| I18N-02 | Phase 9 | Pending |
| TEST-01 | Phase 10 | Pending |
| TEST-02 | Phase 10 | Pending |
| TEST-03 | Phase 10 | Pending |
| TEST-04 | Phase 10 | Pending |
| TEST-05 | Phase 10 | Pending |
| DEPLOY-01 | Phase 11 | Pending |
| DEPLOY-02 | Phase 11 | Pending |
| DEPLOY-03 | Phase 11 | Pending |
| DEPLOY-04 | Phase 11 | Pending |
| DEPLOY-05 | Phase 11 | Pending |

**v1 requirements mapped: 57/57 ✓**

---

*Roadmap created: 2026-03-31*
