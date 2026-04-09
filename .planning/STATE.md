---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase 07 Complete
last_updated: "2026-04-09T14:00:00.000Z"
progress:
  total_phases: 10
  completed_phases: 6
  total_plans: 28
  completed_plans: 34
---

# CRM Pro — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-31)

**Core value:** A sales team can sign up, invite their colleagues, and manage their entire pipeline in real-time with data persisted in Supabase and real-time sync across tabs.
**Current focus:** Phase 07 — gmail-integration (COMPLETE)

## Current Status

**Milestone:** v1.0 — Full SaaS Upgrade
**Phase:** 6 of 10 — COMPLETE
**Next:** Phase 7 (Gmail Integration)

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Supabase for backend | Schema already written, RLS built-in for multi-tenancy, SDK installed | 2026-03-31 |
| JWT claim for RLS (not JOIN subquery) | Performance critical — O(1) vs per-row subquery at scale | 2026-03-31 |
| normalizeRole co-located in authStore.ts (03.4) | Avoids circular dependency with permissions.ts; keeps JWT parsing self-contained in the auth layer | 2026-04-06 |
| Fallback chain for role: app_metadata first, then user_metadata (03.4) | app_metadata is server-controlled (DB trigger); user_metadata fallback preserves backwards-compat with existing mock flow | 2026-04-06 |
| Edge Functions for API key proxying | Anthropic + Gmail secrets must never reach the browser | 2026-03-31 |
| Auth Code + PKCE for Gmail OAuth | Current initTokenClient cannot obtain refresh tokens | 2026-03-31 |
| react-markdown + rehype-sanitize | Replace dangerouslySetInnerHTML in AIAgent — live XSS vector | 2026-03-31 |
| Anthropic SDK removed entirely (04.3) | dangerouslyAllowBrowser is a security anti-pattern; all AI calls go through OpenRouter fetch until Phase 7 Edge Function proxy | 2026-04-05 |
| openRouterKey replaces apiKey as the single AI key guard (04.1) | Anthropic key never stored in browser — OpenRouter is the only supported browser-side AI transport | 2026-04-05 |
| Vercel for frontend deploy | Zero-config Vite support, free tier, global CDN | 2026-03-31 |
| Free beta (no Stripe in v1.0) | Validate product before billing complexity | 2026-03-31 |
| Per-file vi.mock() for Supabase (02.0) | Inline mocking gives explicit control over each test file vs auto-hoisting | 2026-03-31 |
| vi.hoisted() for Register test mock factories (02.1) | vi.mock() is hoisted, making outer const inaccessible — vi.hoisted() evaluates at hoist time | 2026-03-31 |
| window.location.replace for PASSWORD_RECOVERY redirect (02.2) | initSupabaseAuth runs outside React component tree — React Router navigate not available | 2026-03-31 |
| vi.hoisted() for ForgotPassword/ResetPassword test mock factories (02.3) | Same pattern as 02.1 — vi.mock() hoisted above const declarations, vi.hoisted() evaluates at hoist time | 2026-03-31 |
| isLoadingAuth default is true (02.4) | Cold render holds at null until INITIAL_SESSION fires — prevents /login flash for authenticated users on hard refresh | 2026-03-31 |
| ProtectedRoute returns null while loading (02.4) | return null chosen over spinner — no layout shift, loading is invisible until Supabase resolves | 2026-03-31 |

## Blockers

(None)

## Notes

- Schema migration must come before auth (RLS depends on organizations table)
- `isLoadingAuth` must initialize as `true` to prevent race condition redirect to /login
- `onRehydrateStorage` seed hooks must be removed from all migrated stores
- Google OAuth verification (restricted scopes) takes 4-6 weeks — start application early during Phase 8
- Supabase service role key must NEVER get a VITE_ prefix

---
*Initialized: 2026-03-31*
*Last session: 2026-04-09 — Completed Phase 07 entirely (07-3 → 07-5). OAuth callback page, silent refresh on load, Inbox wired to real threads with 401 retry + contact chips, EmailComposer uses in-memory access token and logs email activities.*
