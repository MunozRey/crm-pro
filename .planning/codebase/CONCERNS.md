# Codebase Concerns

**Analysis Date:** 2026-03-31

---

## Tech Debt

### localStorage as Primary Database (Critical)
- Issue: All CRM data (contacts, companies, deals, activities, automations, sequences, email, AI conversations, attachments, audit log, notifications) is persisted exclusively in browser `localStorage` via Zustand `persist` middleware. This is a single-browser, single-user storage layer with no server-side persistence.
- Files:
  - `src/store/contactsStore.ts` (line 9: `// TODO: Replace localStorage persistence with Supabase client calls`)
  - `src/store/companiesStore.ts` (line 8: same TODO)
  - `src/store/activitiesStore.ts` (line 9: same TODO)
  - `src/store/dealsStore.ts` (line 10: same TODO)
  - `src/hooks/useLocalStorage.ts` (line 3: `// TODO: Swap this hook for Supabase real-time subscriptions`)
- Impact: Data is lost if the user clears browser storage, switches browsers, or opens the app on a second device. Multi-user collaboration is impossible — each browser instance has a fully separate dataset with no synchronization.
- Fix approach: Replace Zustand `persist` middleware with direct Supabase client calls per the migration roadmap in `README.md`. Schema and TypeScript types (`src/lib/database.types.ts`) are already prepared.

### Hardcoded Mock User List
- Issue: `MOCK_USERS` is a static array of 3 hardcoded name strings (`['David Muñoz', 'Sara López', 'Carlos Vega']`) exported from `src/utils/seedData.ts`. It is imported and rendered in 9 different files as the "assigned to" dropdown for contacts, deals, and activities. These names are disconnected from the real `AuthUser` list in `src/store/authStore.ts`.
- Files:
  - `src/utils/seedData.ts` (line 5)
  - `src/components/contacts/ContactForm.tsx` (line 9, 49, 105)
  - `src/components/deals/DealForm.tsx` (line 9, 51, 127)
  - `src/components/activities/ActivityForm.tsx` (line 9, 50, 123)
  - `src/pages/Contacts.tsx` (line 25, 259, 368)
  - `src/pages/Deals.tsx` (line 34, 476, 528)
  - `src/pages/Dashboard.tsx` (line 19, 157)
  - `src/pages/Leaderboard.tsx` (line 7, 381)
  - `src/pages/Reports.tsx` (line 17, 122)
  - `src/pages/PipelineTimeline.tsx` (line 11, 201)
- Impact: Adding or removing team members from Settings or `authStore` does not update assignment dropdowns. The Leaderboard and Reports modules compute performance metrics by iterating over `MOCK_USERS`, so new real users never appear in analytics.
- Fix approach: Replace all `MOCK_USERS` imports with a selector over `useAuthStore((s) => s.users)` that maps to `{ value: u.name, label: u.name }`.

### Weak Password Hashing in Auth Store
- Issue: `src/store/authStore.ts` implements its own password hash using a 32-bit integer djb2 variant (`simpleHash`). The comment on line 7 explicitly warns: `// Simple hash for demo purposes (in production, use bcrypt + backend)`. Hashed passwords are then persisted to `localStorage` under the key `crm_auth`.
- Files: `src/store/authStore.ts` (lines 7–16, 127–131, 395–406)
- Impact: Passwords stored in `localStorage` are recoverable with trivial effort. The hash has no salt and collides at predictable patterns. All three seed accounts use `demo123` with known hash values.
- Fix approach: This entire auth layer must be replaced by Supabase Auth (Step 4 of the migration roadmap). Do not attempt to strengthen the local hash — it is fundamentally the wrong architecture.

### Supabase Client Returns `null` Without Configuration
- Issue: `src/lib/supabase.ts` exports `supabase` as `null` when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars are absent. `initSupabaseAuth()` in `authStore.ts` guards with `if (!isSupabaseConfigured || !supabase) return`, which silently no-ops. Any call to `supabase?.from(...)` across the app will silently do nothing until env vars are set.
- Files: `src/lib/supabase.ts` (lines 7–13), `src/store/authStore.ts` (line 410)
- Impact: It is impossible to tell at runtime whether Supabase is inactive due to missing config vs. a network error. The app falls back to localStorage with zero warning to the user.
- Fix approach: Add a development-mode console warning when `!isSupabaseConfigured` so the misconfiguration is visible during setup. Optionally surface a UI banner in Settings.

---

## Security Considerations

### API Keys Stored in localStorage
- Risk: The Anthropic API key and OpenRouter API key entered by users are persisted in `localStorage` under the key `crm_ai` (see `src/store/aiStore.ts`, lines 99–100). The Gmail OAuth access token is stored under `crm_emails` (see `src/store/emailStore.ts`, lines 182–187). Any JavaScript running on the same origin (e.g., a browser extension or XSS payload) can read these keys.
- Files: `src/store/aiStore.ts` (partialize at line 98), `src/store/emailStore.ts` (partialize at line 182)
- Current mitigation: The app is a single-origin SPA with no third-party script injection today.
- Recommendations: API keys should be stored in `sessionStorage` (not persisted across tabs) or better, proxied server-side so they never touch the browser. Gmail tokens should be refreshed server-side.

### XSS via Unsanitized AI-Generated Markdown
- Risk: `src/pages/AIAgent.tsx` renders AI assistant responses using a custom `renderMarkdown()` function (lines 14–23) and injects the result via `dangerouslySetInnerHTML` (lines 315, 335). The `renderMarkdown` function uses `String.replace` with no HTML escaping — a response containing `<script>` tags or attribute injection payloads would execute in the DOM.
- Files: `src/pages/AIAgent.tsx` (lines 14–23, 315, 335)
- Current mitigation: Content originates from Anthropic/OpenRouter APIs, which typically do not inject HTML. However, prompt injection attacks could cause the AI to produce malicious HTML.
- Recommendations: Sanitize with a library such as `DOMPurify` before calling `dangerouslySetInnerHTML`, or use a proper markdown renderer like `react-markdown` that escapes HTML by default.

### No CSRF Protection or Session Invalidation
- Risk: Session tokens are UUID strings generated client-side and stored in `localStorage`. There is no server-side session store, so a stolen token cannot be invalidated. Session expiry (24 hours) is also enforced purely client-side in `isAuthenticated()`.
- Files: `src/store/authStore.ts` (lines 168–173, 387–392)
- Current mitigation: Only applies once Supabase auth replaces this system.
- Recommendations: Migrate to Supabase Auth which provides server-side session management and token revocation.

---

## Missing Backend Features (Incomplete Implementations)

### Email Tracking Has No Server-Side Component
- Issue: `src/store/emailStore.ts` exposes `trackEmailOpen` and `trackEmailClick` actions that increment counters in localStorage. There is no tracking pixel, no webhook endpoint, and no mechanism for the email recipient's open/click events to reach the CRM. The UI in `src/pages/Inbox.tsx` (lines 56–80) and `src/pages/ContactDetail.tsx` displays these counters as if they represent real data.
- Files: `src/store/emailStore.ts` (lines 74–103), `src/components/email/EmailComposer.tsx` (lines 46, 110, 295)
- Impact: Email tracking data is always zero (unless manually called in code). The feature appears functional in the UI but tracks nothing.
- Fix approach: Requires a backend endpoint that receives pixel GET requests, looks up the email by ID, and increments the counter in the database.

### Automations Execute Only in the Current Browser Session
- Issue: `src/store/automationsStore.ts` fires automation rules synchronously in `executeRulesForTrigger()` (lines 134–198). Rules only execute when a deal stage changes in the currently open browser tab. There is no background job runner, no scheduled trigger system, and no server-side event processing.
- Files: `src/store/automationsStore.ts` (lines 134–198)
- Impact: Automations are demo-only. They do not run when the user is offline, in a different tab, or on a different device. The `executionCount` and `lastExecutedAt` fields tracked in localStorage have no meaning in a multi-device context.
- Fix approach: Requires Supabase Edge Functions or a background job service (e.g., pg_cron) triggered by database row changes.

### Sequences Send No Real Emails
- Issue: `src/store/sequencesStore.ts` stores `EmailSequence` and `SequenceEnrollment` records in localStorage. There is no scheduler that advances enrolled contacts through sequence steps, and no code that actually sends emails on a schedule.
- Files: `src/store/sequencesStore.ts`, `src/pages/Sequences.tsx`
- Impact: Enrolling a contact in a sequence records the enrollment but nothing happens. Step advancement, email sending, and wait-period timers are all absent.
- Fix approach: Requires a backend scheduler (cron job or queue) that checks enrollment progress daily and dispatches emails via the Gmail API or a transactional email provider.

### Calendar Has No External Sync
- Issue: `src/pages/Calendar.tsx` (861 lines) is a fully custom month/week calendar view that reads only from the `activitiesStore`. There is no Google Calendar sync, no iCal export, and no meeting scheduling integration.
- Files: `src/pages/Calendar.tsx`
- Impact: Events created in the CRM calendar are invisible to external calendars. Meetings booked externally do not appear in the CRM.

---

## Fragile Areas

### Oversized Page Components
- Issue: Several page components far exceed the 200-line guideline stated in `README.md`. These files handle multiple concerns (data fetching, filtering, form state, modal orchestration, analytics) inside a single component tree.
  - `src/pages/Deals.tsx` — 924 lines
  - `src/pages/Settings.tsx` — 922 lines
  - `src/pages/Calendar.tsx` — 861 lines
  - `src/pages/Sequences.tsx` — 825 lines
  - `src/pages/ContactDetail.tsx` — 782 lines
  - `src/pages/Forecast.tsx` — 726 lines
  - `src/pages/Leaderboard.tsx` — 715 lines
- Impact: Difficult to test individual units. State and side effects are tightly coupled. Adding features risks unintentional regressions across unrelated UI sections in the same file.
- Safe modification: Identify self-contained modal/panel sub-components (e.g., the deal detail panel in `Deals.tsx`, the custom fields section in `Settings.tsx`) and extract them to `src/components/` with clear prop interfaces before making changes.

### AI JSON Parsing Without Error Handling
- Issue: All AI service functions in `src/services/aiService.ts` parse responses with raw `JSON.parse(text)` calls (lines 184, 223, 297, 360, 421, 515). If the LLM returns a response with markdown fences, partial JSON, or a refusal message, the parse will throw an unhandled exception that propagates to the calling page component.
- Files: `src/services/aiService.ts` (lines 184, 223, 297, 360, 421, 515)
- Impact: Any malformed AI response silently breaks the enrichment or daily brief workflow with an unhandled promise rejection.
- Fix approach: Wrap each `JSON.parse` in a try/catch, strip common markdown fences (`` ```json `` ... `` ``` ``), and return a typed error object instead of throwing.

### Error Boundary Does Not Log Errors
- Issue: `src/components/layout/ErrorBoundary.tsx` (line 26) contains the comment `// In production this would log to an error tracking service (Sentry, etc.)` but calls `void error` and `void info` — discarding both the error and its component stack.
- Files: `src/components/layout/ErrorBoundary.tsx` (lines 25–28)
- Impact: Runtime errors in production are invisible. There is no crash reporting, no alerting, and no way to discover which components are failing for which users.
- Fix approach: Integrate Sentry (or equivalent) and call `Sentry.captureException(error, { extra: { componentStack: info.componentStack } })` in `componentDidCatch`.

### Audit Log Capped at 500 Entries in localStorage
- Issue: `src/store/auditStore.ts` slices the audit log to a maximum of 500 entries (line 8: `const MAX_ENTRIES = 500`) and stores them in `localStorage`. On an active team, this cap will be reached quickly, dropping the oldest entries.
- Files: `src/store/auditStore.ts` (lines 8, 40–43)
- Impact: Audit trail is unreliable for compliance or forensic purposes. Entries are also lost when localStorage is cleared.
- Fix approach: Persist audit entries to a server-side table on migration to Supabase (the schema in `supabase/schema.sql` does not yet include an audit table).

---

## Scaling Limits

### localStorage Quota (~5–10 MB)
- Current capacity: All stores combined (contacts, companies, deals, activities, emails, AI conversations, attachments, automations, sequences, audit, notifications, auth) are written to `localStorage`. Modern browsers enforce a 5–10 MB quota per origin.
- Limit: With the seed dataset (25 contacts, 18 deals, 30 activities) the usage is negligible. With a real sales team generating hundreds of records, AI enrichment results (stored per contact and per deal in `src/store/aiStore.ts`), and email thread caches, the quota will be exceeded, causing silent write failures in `useLocalStorage.ts` (errors are caught and discarded at lines 18–21).
- Scaling path: Migrate to Supabase as the primary store. Use `sessionStorage` only for ephemeral UI state.

### No Pagination in Any List View
- Issue: `getFilteredContacts()`, `getFilteredDeals()`, and equivalent selectors return full in-memory arrays. Every list view (`Contacts`, `Deals`, `Activities`, `Companies`) renders all matching records at once.
- Files: `src/store/contactsStore.ts` (lines 98–115), `src/pages/Contacts.tsx`, `src/pages/Deals.tsx`
- Impact: With thousands of records, initial render and filter operations will block the main thread. The Leaderboard (`src/pages/Leaderboard.tsx`) and Reports (`src/pages/Reports.tsx`) run multiple full-array `.map()` / `.filter()` / `.reduce()` passes on every render.
- Scaling path: Implement cursor-based or offset pagination at the store/selector level. Use `useMemo` on filter selectors (some pages already do this for Forecast/Reports).

---

## Dependencies at Risk

### `dangerouslyAllowBrowser: true` in Anthropic SDK
- Risk: `src/services/aiService.ts` (line 7) instantiates the Anthropic SDK with `dangerouslyAllowBrowser: true`. This flag exists because the SDK is designed for server-side use — calling it from the browser exposes the API key in network requests visible in DevTools.
- Impact: Any user of the deployed app who opens DevTools can extract the Anthropic API key from XHR request headers and use it for their own API calls at the owner's expense.
- Migration plan: Move AI calls to a Supabase Edge Function or Next.js API route. The browser calls the proxy; the proxy holds the key server-side.

### Supabase Schema Gaps Relative to Application Data
- Risk: `supabase/schema.sql` defines tables for `contacts`, `companies`, `deals`, `activities`, and `notifications` only. The following application stores have no corresponding schema:
  - `src/store/automationsStore.ts` — automation rules and execution history
  - `src/store/sequencesStore.ts` — email sequences and enrollments
  - `src/store/emailStore.ts` — CRM email log and Gmail tokens
  - `src/store/aiStore.ts` — AI conversations, enrichments, API keys
  - `src/store/customFieldsStore.ts` — custom field definitions
  - `src/store/attachmentsStore.ts` — file attachment metadata
  - `src/store/auditStore.ts` — audit log entries
  - `src/store/goalsStore.ts` — sales goals
  - `src/store/templateStore.ts` — email templates
- Impact: A partial Supabase migration (only the entities in the schema) would leave 9 stores still on localStorage, defeating the purpose of the migration.
- Migration plan: Design and add SQL migrations for each missing entity before beginning the store migration. Note that `src/lib/database.types.ts` only types the 4 existing tables.

---

## Test Coverage Gaps

### No Test Files Exist
- What's not tested: The entire codebase has no test files. There is no `jest.config.*`, no `vitest.config.*`, and no `*.test.*` or `*.spec.*` files anywhere in the project.
- Files: All of `src/`
- Risk: Any change to store logic, utility functions, AI service parsing, or form validation has zero automated coverage. The seed data reset in Settings, the automation execution engine, and all Zod schemas are entirely untested.
- Priority: High — before migrating stores to Supabase, unit tests for store actions and AI service JSON parsing should be in place to catch regressions.

---

*Concerns audit: 2026-03-31*
