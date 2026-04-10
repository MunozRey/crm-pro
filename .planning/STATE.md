---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase 10 Ready
last_updated: "2026-04-10T13:35:00.000Z"
progress:
  total_phases: 10
  completed_phases: 9
  total_plans: 37
  completed_plans: 43
---

# CRM Pro — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-10)

**Core value:** A sales team can sign up, invite their colleagues, and manage their entire pipeline in real-time with data persisted in Supabase and real-time sync across tabs.
**Current focus:** Phase 10 — Vercel Deployment (next up)

## Current Status

**Milestone:** v1.0 — Full SaaS Upgrade
**Phase:** 9 of 10 — COMPLETE
**Next:** Phase 10 (Vercel Deployment)

## Completed Phases

| Phase | Description | Completed |
|-------|-------------|-----------|
| 01 | Schema & Multi-Tenancy | 2026-03-31 |
| 02 | Supabase Auth | 2026-04-05 |
| 03 | Organization Onboarding | 2026-04-06 |
| 04 | Security Fixes | 2026-04-07 |
| 05 | Core Data Stores + Real-Time | 2026-04-07 |
| 06 | Secondary Stores & Real Users | 2026-04-08 |
| 07 | Gmail Integration | 2026-04-09 |
| 08 | i18n English | 2026-04-09 |
| 09 | Test Suite + i18n completo | 2026-04-10 |
| 09b | Post-Phase hardening (Gmail + UX + Quotes) | 2026-04-10 |

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Supabase for backend | Schema already written, RLS built-in for multi-tenancy, SDK installed | 2026-03-31 |
| JWT claim for RLS (not JOIN subquery) | Performance critical — O(1) vs per-row subquery at scale | 2026-03-31 |
| normalizeRole co-located in authStore.ts (03.4) | Avoids circular dependency with permissions.ts; keeps JWT parsing self-contained in the auth layer | 2026-04-06 |
| Fallback chain for role: app_metadata first, then user_metadata (03.4) | app_metadata is server-controlled (DB trigger); user_metadata fallback preserves backwards-compat with existing mock flow | 2026-04-06 |
| Edge Functions for API key proxying | Anthropic + Gmail secrets must never reach the browser | 2026-03-31 |
| Auth Code + PKCE for Gmail OAuth | initTokenClient cannot obtain refresh tokens | 2026-03-31 |
| react-markdown + rehype-sanitize | Replace dangerouslySetInnerHTML in AIAgent — live XSS vector | 2026-03-31 |
| Anthropic SDK removed entirely (04.3) | dangerouslyAllowBrowser is a security anti-pattern; all AI calls go through OpenRouter fetch | 2026-04-05 |
| openRouterKey replaces apiKey as the single AI key guard (04.1) | Anthropic key never stored in browser | 2026-04-05 |
| Vercel for frontend deploy | Zero-config Vite support, free tier, global CDN | 2026-03-31 |
| Free beta (no Stripe in v1.0) | Validate product before billing complexity | 2026-03-31 |
| Per-file vi.mock() for Supabase (02.0) | Inline mocking gives explicit control over each test file vs auto-hoisting | 2026-03-31 |
| vi.hoisted() for test mock factories (02.1–02.3) | vi.mock() is hoisted above const declarations — vi.hoisted() evaluates at hoist time | 2026-03-31 |
| isLoadingAuth default is true (02.4) | Cold render holds at null until INITIAL_SESSION fires — prevents /login flash on hard refresh | 2026-03-31 |
| ProtectedRoute returns null while loading (02.4) | No layout shift; loading is invisible until Supabase resolves | 2026-03-31 |
| GmailTokenContext for in-memory access token (07-1) | Access token never persisted to localStorage — only email address stored in Zustand | 2026-04-09 |
| supabase! non-null assertion inside isSupabaseConfigured guards (07) | isSupabaseConfigured is a boolean flag, not a TypeScript type guard | 2026-04-09 |
| Activity logging in EmailComposer (07-5) | Single source of truth — avoids duplicating logic across ContactDetail, Deals, Inbox | 2026-04-09 |
| Phase 08 i18n was pre-implemented | en.ts already had full key parity with es.ts; language switcher + persistence already in Settings | 2026-04-09 |
| create-org Edge Function bypasses RLS (09) | Supabase project uses ECC P-256 JWT signing — PostgREST can't verify with legacy anon key; service role in Edge Function is the correct pattern | 2026-04-10 |
| Zod schemas extracted to src/lib/schemas/ (09-3) | Unexported schemas inside .tsx files are untestable; extraction enables isolated unit tests | 2026-04-10 |
| Per-file vi.mock() without vi.hoisted() for store tests (09-2) | Mock data defined inside factory body avoids hoisting issues with top-level variable references | 2026-04-10 |
| Supabase mode must never rehydrate demo users (post-Phase 09 fix) | `persist.merge` was re-injecting `SEED_USERS` and leaked demo users into real org sessions | 2026-04-10 |
| Org creation validates session via `supabase.auth.getUser()` in page flow | Avoids false "not authenticated" errors caused by stale local Zustand user during org bootstrap | 2026-04-10 |
| Deal/activity creation must map UUID fields correctly | Sending display names to UUID columns (`assigned_to`, `created_by`) caused inserts to fail and optimistic records to roll back | 2026-04-10 |
| Gmail redirect URI uses dynamic origin | Prevents OAuth callback failures when running on non-5173 local ports and preview URLs | 2026-04-10 |
| Gmail token refresh is on-demand in Inbox + composer | Avoids false disconnected states when in-memory token expires but server refresh token is valid | 2026-04-10 |
| Gmail thread links persisted (`gmail_thread_links`) | Enables pin/unpin of thread-to-CRM relationships and stable context across sessions | 2026-04-10 |
| Demo email seeds linked to deals/contacts | Improves first-run demo quality for Inbox, follow-ups, and quote-email scenarios | 2026-04-10 |
| Quote builder supports export/email actions | Reduces workflow friction by enabling immediate sharing from deal detail | 2026-04-10 |

## Blockers

(None)

## Notes

- Schema migration must come before auth (RLS depends on organizations table)
- `isLoadingAuth` must initialize as `true` to prevent race condition redirect to /login
- `onRehydrateStorage` seed hooks removed from all migrated stores
- Google OAuth verification (restricted scopes) takes 4-6 weeks — start application process before Phase 10 deploy
- Supabase service role key must NEVER get a VITE_ prefix
- Phase 10 (Vercel Deployment) requires the repo to be pushed to GitHub first
- Post-Phase 09 hardening: `authStore` Supabase branch starts with empty users/passwords and keeps runtime users org-scoped.
- Post-Phase 09 hardening: calendar week labels no longer hardcoded in Spanish (`hour`/`all day` now language-aware).
- Supabase remote already includes migration `20260410160000_gmail_thread_links.sql`.

---
*Initialized: 2026-03-31*
*Last session: 2026-04-10 — Gmail hardening shipped (dynamic redirect URI, refresh+retry, persisted thread links + migration + function deploy), Quote Builder extended with export/email actions, and demo inbox seeded with linked deal emails. Test/build remain green.*
