# CRM Pro — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-31)

**Core value:** A sales team can sign up, invite their colleagues, and manage their entire pipeline in real-time — with AI that drafts emails, scores leads, and surfaces insights automatically.
**Current focus:** Phase 1 — Schema & Multi-Tenancy

## Current Status

**Milestone:** v1.0 — Full SaaS Upgrade
**Phase:** 1 of 11 — Schema & Multi-Tenancy
**Plan:** Not started

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Supabase for backend | Schema already written, RLS built-in for multi-tenancy, SDK installed | 2026-03-31 |
| JWT claim for RLS (not JOIN subquery) | Performance critical — O(1) vs per-row subquery at scale | 2026-03-31 |
| Edge Functions for API key proxying | Anthropic + Gmail secrets must never reach the browser | 2026-03-31 |
| Auth Code + PKCE for Gmail OAuth | Current initTokenClient cannot obtain refresh tokens | 2026-03-31 |
| react-markdown + rehype-sanitize | Replace dangerouslySetInnerHTML in AIAgent — live XSS vector | 2026-03-31 |
| Vercel for frontend deploy | Zero-config Vite support, free tier, global CDN | 2026-03-31 |
| Free beta (no Stripe in v1.0) | Validate product before billing complexity | 2026-03-31 |

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
