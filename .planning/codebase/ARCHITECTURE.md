# Architecture

**Analysis Date:** 2026-04-10

## Pattern Overview

**Overall:** React SPA with Supabase-backed data/auth, org-scoped RLS, and Zustand stores as client orchestration.

**Key Characteristics:**
- Supabase is the primary backend for auth, persistence, and realtime sync.
- Zustand remains the app state layer, with selective persistence for safe client state.
- Route-level protection is handled through `ProtectedRoute` + permission checks.
- Gmail integration uses PKCE + Edge Functions for secure token exchange/refresh.

## Layers

**App Shell + Routing (`src/App.tsx`):**
- Declares routes and protected wrappers.
- Initializes auth/session sync.
- Uses lazy loading for chart-heavy routes (`Dashboard`, `Reports`, `Forecast`).

**Pages (`src/pages/*`):**
- Route containers that compose store data, domain components, and services.
- Main business UX for CRM entities, inbox, reporting, settings.

**Stores (`src/store/*`):**
- Domain-specific Zustand stores.
- Supabase CRUD + realtime subscriptions where applicable.
- Local mock/demo mode remains supported when Supabase config is absent.

**Services (`src/services/*`):**
- Stateless integration adapters (`gmailService`, `aiService`, etc.).
- Security-sensitive OAuth/token steps are delegated to Supabase Edge Functions.

**Data/Infra (`supabase/*`):**
- SQL migrations and Edge Functions for server-side responsibilities.
- Includes Gmail token and thread-link persistence support.

## Core Flows

**Auth + Org Scope:**
1. Session initializes from Supabase.
2. Org/role context is resolved.
3. RLS enforces tenant isolation on all scoped data operations.

**CRM CRUD:**
1. UI dispatches store action.
2. Store persists to Supabase (with optimistic UX where implemented).
3. Realtime updates fan out to active clients.

**Gmail:**
1. User connects via Google OAuth PKCE.
2. Code exchange and refresh token handling happen in Edge Functions.
3. Short-lived access tokens are used client-side; inbox loads/syncs threads.
4. Thread links can be pinned/unpinned and persisted (`gmail_thread_links`).

## Cross-Cutting Concerns

- **i18n:** 6 languages (`en`, `es`, `pt`, `fr`, `de`, `it`) with centralized translation hooks.
- **Security:** no browser-side refresh token storage; service-role logic isolated to Edge Functions.
- **Accessibility:** icon-only controls require `aria-label`/`title`.
- **Quality gates:** `npm run build` + `npm run test:run` must pass before release/merge.

---

*Architecture analysis: 2026-04-10*
