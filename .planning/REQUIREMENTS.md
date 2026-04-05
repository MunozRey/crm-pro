# Requirements: CRM Pro

**Defined:** 2026-03-31
**Core Value:** A sales team can sign up, invite their colleagues, and manage their entire pipeline in real-time — with AI that drafts emails, scores leads, and surfaces insights automatically.

## v1 Requirements

### Authentication & Organizations

- [x] **AUTH-01**: User can sign up with email and password via Supabase Auth
- [x] **AUTH-02**: User receives email verification after signup
- [x] **AUTH-03**: User can reset password via email link
- [x] **AUTH-04**: User session persists across browser refresh (onAuthStateChange + `isLoadingAuth: true` initial state to prevent race condition redirect)
- [x] **AUTH-05**: User can log out and session is fully cleared
- [ ] **AUTH-06**: New user creates an organization on first login (org name, slug)
- [ ] **AUTH-07**: User can invite team members by email (Supabase Edge Function — requires service role key)
- [ ] **AUTH-08**: Invited user receives email and can accept invitation to join organization
- [ ] **AUTH-09**: User has a role within organization (owner, admin, member)
- [ ] **AUTH-10**: All CRM data is scoped to organization via RLS — no cross-tenant data leakage

### Schema & Multi-Tenancy

- [ ] **SCHEMA-01**: All core tables (contacts, companies, deals, activities, notifications, goals, sequences, automations, templates, products) have `organization_id uuid NOT NULL` column
- [ ] **SCHEMA-02**: RLS policies on all tables enforce `organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid` (JWT claim, not subquery — performance critical)
- [ ] **SCHEMA-03**: Trigger sets `organization_id` in JWT `app_metadata` on org membership changes
- [ ] **SCHEMA-04**: `organizations` and `organization_members` tables created with correct FK structure
- [ ] **SCHEMA-05**: `gmail_tokens` table created to store refresh tokens server-side (never in browser)

### Data Migration — Core Stores

- [ ] **DATA-01**: `contactsStore` migrated from Zustand `persist` to async Supabase calls (create, read, update, delete)
- [ ] **DATA-02**: `companiesStore` migrated to Supabase
- [ ] **DATA-03**: `dealsStore` migrated to Supabase
- [ ] **DATA-04**: `activitiesStore` migrated to Supabase
- [ ] **DATA-05**: `notificationsStore` migrated to Supabase
- [ ] **DATA-06**: Seed data `onRehydrateStorage` hooks removed from all migrated stores (conflict with Supabase fetch)
- [ ] **DATA-07**: Loading states (`isLoading`, `error`) added to all migrated stores
- [ ] **DATA-08**: Optimistic updates implemented with `updated_at` timestamp guard to prevent double-apply on realtime echo

### Data Migration — Secondary Stores

- [ ] **DATA-09**: `goalsStore` migrated to Supabase
- [ ] **DATA-10**: `sequencesStore` migrated to Supabase
- [ ] **DATA-11**: `automationsStore` migrated to Supabase
- [ ] **DATA-12**: `templateStore` migrated to Supabase
- [ ] **DATA-13**: `productsStore` migrated to Supabase
- [ ] **DATA-14**: `auditStore` migrated to Supabase
- [ ] **DATA-15**: `customFieldsStore` migrated to Supabase

### Real-Time Sync

- [ ] **REALTIME-01**: Contacts table has Supabase Realtime subscription — changes by any org member appear instantly for all
- [ ] **REALTIME-02**: Deals table has Realtime subscription
- [ ] **REALTIME-03**: Activities table has Realtime subscription
- [ ] **REALTIME-04**: Notifications table has Realtime subscription

### Users & Assignment

- [ ] **USERS-01**: MOCK_USERS replaced — all "assigned to" dropdowns pull from real org members via `useAuthStore`
- [ ] **USERS-02**: Leaderboard analytics computed from real org members, not hardcoded names
- [ ] **USERS-03**: Reports module computes performance metrics from real user list

### Security Fixes

- [x] **SEC-01**: `authStore` weak djb2 hash replaced by Supabase Auth — passwords never stored locally
- [ ] **SEC-02**: Anthropic API key removed from localStorage — stored only in Supabase Edge Function env vars
- [ ] **SEC-03**: `dangerouslySetInnerHTML` in `AIAgent.tsx` replaced with `react-markdown` + `rehype-sanitize`
- [ ] **SEC-04**: `dangerouslyAllowBrowser: true` removed from `aiService.ts` — all Claude calls go through Edge Function proxy
- [ ] **SEC-05**: Gmail access token stored in memory only (not localStorage); refresh token stored in `gmail_tokens` Supabase table
- [x] **SEC-06**: Dev-mode console warning when Supabase env vars are absent (currently silent no-op)

### AI Features

- [ ] **AI-01**: Supabase Edge Function `claude-proxy` — proxies Claude API calls, injects Anthropic key from env, returns streaming responses
- [ ] **AI-02**: Lead scoring recalculates automatically when activity is logged for a contact
- [ ] **AI-03**: AI email drafting — user selects contact + optional deal, AI generates context-aware draft using contact history and prior emails
- [ ] **AI-04**: Call summary — user pastes transcript, AI returns structured summary with key points and next steps
- [ ] **AI-05**: AIAgent chat uses Edge Function proxy instead of direct browser SDK call

### Gmail Integration

- [ ] **GMAIL-01**: Gmail OAuth uses Auth Code + PKCE flow (`initCodeClient`) — replaces current implicit token client that cannot obtain refresh tokens
- [ ] **GMAIL-02**: Edge Function `gmail-oauth-exchange` exchanges authorization code for access + refresh tokens; stores refresh token in `gmail_tokens` table
- [ ] **GMAIL-03**: Edge Function `gmail-refresh-token` refreshes access token when expired; returns short-lived token to browser only
- [ ] **GMAIL-04**: Inbox view loads real Gmail threads via API using short-lived access token
- [ ] **GMAIL-05**: Emails can be sent from within contact/deal detail pages
- [ ] **GMAIL-06**: Incoming emails matched to contacts by sender email address; linked in activity feed

### Internationalization

- [ ] **I18N-01**: English translation file `en.json` created covering all existing Spanish strings
- [ ] **I18N-02**: Language switcher in Settings (or user profile) persists language preference

### Testing

- [ ] **TEST-01**: Vitest configured with `@testing-library/react` and jsdom
- [ ] **TEST-02**: Unit tests for `leadScoring.ts` (`computeLeadScore`, `calculateLeadScore`) — pure functions, highest priority
- [ ] **TEST-03**: Unit tests for Zustand stores (contact CRUD, deal stage transitions) with Supabase client mocked
- [ ] **TEST-04**: Unit tests for Zod schemas in form validation
- [ ] **TEST-05**: GitHub Actions CI runs `vitest run` + `tsc --noEmit` on every PR

### Deployment

- [ ] **DEPLOY-01**: `vercel.json` with SPA catch-all rewrite (`"destination": "/index.html"`) — critical for React Router
- [ ] **DEPLOY-02**: Vercel project configured with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars
- [ ] **DEPLOY-03**: Preview deployments on PRs (connected to a Supabase staging project)
- [ ] **DEPLOY-04**: Production deployment on merge to `main`
- [ ] **DEPLOY-05**: Custom domain configured on Vercel

## v2 Requirements

### Billing & Monetization

- **BILL-01**: Stripe integration — subscription plans (free tier, pro, enterprise)
- **BILL-02**: Usage limits enforced per plan (contacts limit, users limit, AI calls/month)
- **BILL-03**: Billing portal for plan upgrades, invoice downloads

### Advanced AI

- **AI-ADV-01**: Automated email sequences sent by AI based on contact stage
- **AI-ADV-02**: Meeting prep brief generated from contact + company + deal data before calendar events
- **AI-ADV-03**: Deal health score with churn risk alerts

### Integrations

- **INT-01**: Slack notifications for won/lost deals and overdue activities
- **INT-02**: Calendar sync (Google Calendar bidirectional)
- **INT-03**: HubSpot/Pipedrive CSV import wizard

### Mobile

- **MOB-01**: Progressive Web App (PWA) manifest for installable mobile experience

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native iOS/Android app | Responsive web sufficient for v1.0 |
| Self-hosted / on-premise | Supabase cloud only; on-premise adds ops complexity |
| Salesforce / HubSpot API sync | Bidirectional sync is high complexity; CSV import covers v1 |
| Video call integration | Outside core sales workflow |
| AI fine-tuning on own data | Prompt engineering covers v1 needs; fine-tuning is v3+ |
| Schema-per-tenant multi-tenancy | organization_id + RLS is sufficient and simpler to operate |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01–05 | Phase 1 | Pending |
| AUTH-01–05 | Phase 2 | Pending |
| AUTH-06–10 | Phase 3 | Pending |
| SEC-01–06 | Phase 4 | Pending |
| DATA-01–08 | Phase 5 | Pending |
| REALTIME-01–04 | Phase 5 | Pending |
| DATA-09–15 | Phase 6 | Pending |
| USERS-01–03 | Phase 6 | Pending |
| AI-01–05 | Phase 7 | Pending |
| GMAIL-01–06 | Phase 8 | Pending |
| I18N-01–02 | Phase 9 | Pending |
| TEST-01–05 | Phase 10 | Pending |
| DEPLOY-01–05 | Phase 11 | Pending |

**Coverage:**
- v1 requirements: 57 total
- Mapped to phases: 57
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after initial definition*
