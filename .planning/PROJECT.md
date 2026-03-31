# CRM Pro

## What This Is

CRM Pro is a full-featured B2B SaaS CRM for Spanish and European sales teams, built to compete with HubSpot and Pipedrive. It covers the full sales lifecycle — contacts, companies, deals pipeline, activities, sequences, forecasting, AI-assisted selling, and Gmail integration — with multi-tenant organization isolation so any business can sign up and use it independently.

The product is functionally complete as a frontend SPA (React 18 + TypeScript + Tailwind). The next milestone converts it into a real SaaS: replacing localStorage with Supabase, adding real authentication, multi-tenant RLS, Gmail OAuth, production AI features, and deploying to Vercel.

## Core Value

A sales team can sign up, invite their colleagues, and manage their entire pipeline in real-time from day one — with AI that drafts emails, scores leads, and surfaces insights automatically.

## Requirements

### Validated

- ✓ Contacts CRUD with filters, bulk actions, CSV export, and slide-over form — existing
- ✓ Companies CRUD with industry/status/size filters and detail page — existing
- ✓ Deals Kanban + list view with drag & drop, mark Won/Lost — existing
- ✓ Activities feed with overdue highlighting and quick complete — existing
- ✓ Dashboard with KPI cards, revenue bar chart, deal funnel, recent activity — existing
- ✓ Reports: revenue forecast, won/lost donut, activities by type, conversion funnel — existing
- ✓ Calendar view for scheduled activities — existing
- ✓ Email sequences builder (Sequences page) — existing
- ✓ Automation rules engine (Automations page) — existing
- ✓ AI Agent chat interface (placeholder, Anthropic SDK wired) — existing
- ✓ Gmail Inbox integrated view (OAuth flow incomplete) — existing
- ✓ Forecast page with revenue projections — existing
- ✓ Leaderboard and team performance metrics — existing
- ✓ Sales Goals tracking — existing
- ✓ Pipeline Timeline view — existing
- ✓ Email Templates library — existing
- ✓ Products catalog — existing
- ✓ Team Management (roles, mock users) — existing
- ✓ Audit Log — existing
- ✓ Notifications system — existing
- ✓ i18n infrastructure ready (Spanish + English) — existing
- ✓ Settings: tags, pipeline stages, users, JSON export/import, data reset — existing
- ✓ TypeScript strict mode throughout — existing
- ✓ Supabase schema.sql and database.types.ts already written — existing

### Active

- [ ] Supabase Auth — real registration, login, password reset, session management (replace mock djb2 hash auth)
- [ ] Multi-tenant organization isolation — every entity (contacts, companies, deals, etc.) scoped to an `organization_id` via Supabase RLS
- [ ] Supabase persistence — all Zustand stores migrated from localStorage to Supabase (contacts, companies, deals, activities, goals, sequences, automations, templates, products, notifications, audit log)
- [ ] Real-time sync — Supabase Realtime subscriptions so multiple users see changes instantly
- [ ] Replace MOCK_USERS — all "assigned to" dropdowns and analytics driven by real org members from Supabase
- [ ] Gmail OAuth flow — complete OAuth2 PKCE, store refresh token server-side, send/receive emails linked to contacts and deals
- [ ] AI lead scoring — automatic score recalculation based on activity, engagement, deal stage
- [ ] AI email drafting — context-aware email drafts from contact + deal history via Anthropic Claude
- [ ] AI call summary — paste call transcript, get structured summary + next steps
- [ ] Secure API key storage — Anthropic key proxied server-side, never in localStorage
- [ ] Fix XSS in AIAgent — sanitize AI markdown output (replace dangerouslySetInnerHTML)
- [ ] Vercel deploy — production build, env vars, custom domain
- [ ] i18n English translations — add en.json alongside existing es.json
- [ ] Vitest test suite — unit tests for stores, utils, and scoring logic

### Out of Scope

- Stripe billing / paid plans — free beta first; monetization after product-market fit
- Native mobile app — responsive web is sufficient for v1.0
- Self-hosted / on-premise deployment — Supabase cloud only in v1.0
- Third-party CRM import (Salesforce, HubSpot) — manual CSV import covers v1.0
- Video call integration — outside core sales workflow for now

## Context

**Current state:** The app is a fully functional frontend SPA persisting all data in `localStorage` via Zustand `persist` middleware. It has realistic seed data (25 contacts, 10 companies, 18 deals, 30 activities) for development. The Supabase schema, TypeScript database types (`src/lib/database.types.ts`), and Supabase client stub (`src/lib/supabase.ts`) are already written and waiting for env vars.

**Known critical issues (from codebase map):**
- Auth uses a homegrown djb2 hash stored in localStorage — completely insecure, must be replaced by Supabase Auth
- API keys (Anthropic, Gmail tokens) stored in localStorage — XSS risk
- `dangerouslySetInnerHTML` in AIAgent.tsx with unsanitized AI markdown — XSS vector
- MOCK_USERS hardcoded in 9 files — analytics and assignment dropdowns won't reflect real users until replaced
- Supabase client returns `null` silently when env vars absent — debugging is invisible

**Tech stack:** React 18, TypeScript (strict), Vite 8, Tailwind CSS 3, Zustand 5, React Router v6, React Hook Form + Zod v4, Recharts, @hello-pangea/dnd, @supabase/supabase-js, @anthropic-ai/sdk, date-fns, lucide-react

**Target market:** Spanish and European B2B sales teams. UI in Spanish with i18n infrastructure ready for English.

## Constraints

- **Tech stack**: React + Supabase + Vercel — no backend server; Supabase Edge Functions for sensitive operations (API key proxying, Gmail OAuth token exchange)
- **Auth**: Supabase Auth only — no custom auth, no third-party OAuth providers beyond Google (Gmail)
- **Multi-tenancy**: RLS at database level — no application-layer tenant filtering
- **Budget**: Free tier first — Supabase free, Vercel free, Anthropic pay-per-use
- **Backwards compatibility**: Seed data reset on first Supabase migration — localStorage data is not migrated

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase for backend | Schema already written, SDK installed, RLS built-in for multi-tenancy | — Pending |
| Supabase Edge Functions for API key proxying | Anthropic keys must never touch the browser | — Pending |
| Vercel for frontend deploy | Zero-config Vite support, free tier, global CDN | — Pending |
| Organizations via RLS (not application layer) | Security-first multi-tenancy; scales to thousands of orgs | — Pending |
| Free beta (no Stripe in v1.0) | Validate product before adding billing complexity | — Pending |
| i18n: Spanish + English in v1.0 | Infrastructure already exists; adding English is low cost | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-31 after initialization*
