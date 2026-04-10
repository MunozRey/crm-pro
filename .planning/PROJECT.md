# CRM Pro

## What This Is

CRM Pro is a full-featured B2B SaaS CRM for Spanish and European sales teams, built to compete with HubSpot and Pipedrive. It covers the full sales lifecycle — contacts, companies, deals pipeline, activities, sequences, forecasting, AI-assisted selling, and Gmail integration — with multi-tenant organization isolation so any business can sign up and use it independently.

The product is now operating as a Supabase-backed SaaS app (auth, multi-tenant RLS, real-time stores, hardened Gmail OAuth/token flow, and 6-language i18n coverage). The next milestone is deployment hardening and production release on Vercel.

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

- [ ] Phase 10 Vercel deployment and release checklist
- [ ] Production environment validation (Supabase vars, Edge Functions, redirects)
- [ ] End-to-end UAT for organization bootstrap, team invitations, Gmail flows, and quote export/email flows
- [ ] Optional: load org members from `organization_members` table into Team Management (currently uses session-scoped users in Zustand)

### Out of Scope

- Stripe billing / paid plans — free beta first; monetization after product-market fit
- Native mobile app — responsive web is sufficient for v1.0
- Self-hosted / on-premise deployment — Supabase cloud only in v1.0
- Third-party CRM import (Salesforce, HubSpot) — manual CSV import covers v1.0
- Video call integration — outside core sales workflow for now

## Context

**Current state:** Core modules are backed by Supabase with org-scoped data and RLS. Auth/session is handled by Supabase Auth, stores fetch from Supabase, and tests are green (101/101). Recent hardening fixes removed demo-user bleed in Supabase mode, stabilized org creation session checks, fixed UUID field mapping for deals/activities inserts, and added Gmail thread-link persistence with remote migration/deploy.

**Known critical issues (current):**
- Team list is still partially driven by local auth-state user list and not fully hydrated from `organization_members`
- Deployment and environment validation for production are still pending (Phase 10)

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
| Supabase for backend | Schema and RLS model aligned with org isolation requirements | Adopted |
| Supabase Edge Functions for sensitive operations | Keeps service role and external API credentials out of browser | Adopted |
| Organizations via RLS + JWT claims | O(1) tenant resolution and strict row isolation | Adopted |
| i18n 6-language baseline (en/es/pt/fr/de/it) | Reduces UX fragmentation for international teams and demos | Adopted |
| Supabase mode must not rehydrate demo users | Prevents cross-org confusion and invalid team state | Adopted |
| Persisted Gmail thread links (`gmail_thread_links`) | Enables explicit CRM linkage and avoids re-matching drift across sessions | Adopted |
| Quote actions inside deal detail (export/email) | Keeps quoting workflow inside one screen with fewer context switches | Adopted |

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
*Last updated: 2026-04-10 after Gmail hardening + quote workflow updates*
