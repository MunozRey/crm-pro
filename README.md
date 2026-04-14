# CRM Pro — Sales Platform

A production-grade, full-featured CRM single-page application built with React 18, TypeScript, Vite, and Tailwind CSS. Inspired by HubSpot/Pipedrive, designed for Spanish/European B2B sales teams.

## Workspace READMEs

- Main app: `README.md`
- Documentation index: `docs/README.md`
- Supabase setup and migrations: `supabase/README.md`

## Features

| Module | Features |
|---|---|
| **Dashboard** | KPI cards, revenue bar chart, deal funnel, recent activity, top deals |
| **Contacts** | Table/grid view, search, filters, bulk delete, CSV export, slide-over form |
| **Contact Detail** | Overview, Activities, Deals, Notes tabs |
| **Companies** | Table view, industry/status/size filters, company detail page |
| **Deals** | Kanban drag & drop + list view, deal detail panel, mark Won/Lost, quote builder (save/export/send) |
| **Activities** | Unified feed, overdue highlighting, quick complete/delete |
| **Reports** | Revenue forecast, Won/Lost donut, activities by type, contacts by source, conversion funnel |
| **Inbox Collaboration** | Gmail Inbox, real thread sync, pinned thread-to-CRM links, workspace-aware thread linking |
| **Pipeline Timeline** | Timeline view for stage progression and pipeline activity context |
| **Products** | Product catalog for quote line items and deal quoting workflows |
| **Audit Log** | Organization activity audit trail with filters and chronology |
| **Settings** | Tags management, pipeline stages, language (en/es/pt/fr/de/it), JSON export/import, data reset |
| **Authentication** | Supabase Auth (register/login/reset), protected routes, org bootstrap (`/org-setup`) |
| **Multi-tenancy** | Organization-scoped data via `organization_id` + RLS policies |
| **Realtime + Integrations** | Supabase Realtime sync, Gmail PKCE OAuth + refresh, pinned Gmail thread links, notifications/audit |

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- (Optional) A Supabase project for production-like mode

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

The app runs at `http://localhost:5173`. In mock mode it auto-seeds demo data; in Supabase mode data is fetched from your project.

### Environment Variables

Create a `.env.local` file in the project root:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Optional variables for maintenance scripts:

```bash
LEAD_MAINTENANCE_API_URL=http://localhost:5173/api/maintenance/lead
LEAD_MAINTENANCE_API_KEY=your_maintenance_api_key
LEAD_MAINTENANCE_ORG_ID=your_organization_id
```

## Lead Score Maintenance Runner

For backend/scheduler execution without user sessions:

```bash
# Single organization (requires LEAD_MAINTENANCE_ORG_ID)
npm run maintenance:lead:org

# All organizations
npm run maintenance:lead:all

# Health / last runs (optional LEAD_MAINTENANCE_ORG_ID filter)
npm run maintenance:lead:health

# SLA check report
npm run maintenance:lead:sla
```

Contract and headers are documented in:
- `docs/lead-score-maintenance-backend.md`

## Testing

```bash
# Unit/integration tests (watch mode)
npm run test

# Unit/integration tests (single run)
npm run test:run

# Coverage report
npm run test:coverage

# End-to-end tests
npm run test:e2e

# End-to-end tests with browser UI
npm run test:e2e:headed
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript (strict) |
| Build | Vite 8 |
| Styling | Tailwind CSS 3 (dark theme) |
| Routing | React Router v6 |
| State | Zustand 5 (Supabase-backed stores + selective local persist) |
| Forms | React Hook Form + Zod validation |
| Charts | Recharts |
| Drag & Drop | @hello-pangea/dnd |
| Icons | lucide-react |
| Dates | date-fns |

## Project Structure

```
src/
├── components/
│   ├── layout/         # Sidebar, Topbar, Layout, ErrorBoundary
│   ├── ui/             # Button, Input, Select, Badge, Avatar, Modal, Toast, StatCard
│   ├── contacts/       # ContactForm, ContactStatusBadge
│   ├── companies/      # CompanyForm
│   ├── deals/          # DealCard, DealForm, KanbanColumn
│   ├── activities/     # ActivityForm, ActivityItem
│   └── shared/         # SearchBar, EmptyState
├── pages/              # Route containers (27 pages): CRM modules, auth, inbox, timeline, audit, products
├── store/              # Zustand stores (19): auth, CRM domains, inbox, settings, templates, products, audit
├── types/              # All TypeScript interfaces (index.ts)
├── hooks/              # useLocalStorage, useSearch, useFilters
└── utils/              # formatters, constants, seedData, scoring/health engines
```

## Architecture Decisions

### State Management (Zustand)
Each domain uses Zustand with Supabase fetch/insert/update/delete and optional optimistic UI. In Supabase mode, auth state avoids rehydrating demo users.

### Persistence Strategy
Primary persistence is Supabase (tables + RLS). Local persistence is used only for safe client state (for example language preference and selected UI preferences).

### Form Validation
React Hook Form + Zod schemas validate all forms client-side before submission. Each schema uses strict types (no `.default()` to avoid Zod v4 type inference issues with optional fields).

### Routing
React Router v6 with nested layouts. Each page is wrapped in an `ErrorBoundary` component to prevent cascading failures.

### Component Size
All components are kept under 200 lines. Large pages (Contacts, Deals) delegate form logic to dedicated `*Form` components.

## Current Status

- Supabase Auth, org onboarding, and RLS multi-tenancy are implemented.
- Core CRM stores are wired to Supabase and realtime subscriptions are active.
- i18n coverage exists for English, Spanish, Portuguese, French, German, and Italian.
- Test suite is passing (`105` tests).
- Gmail integration is hardened (PKCE + server refresh + resilient inbox load + persisted thread links + workspace-aware thread-link migration `20260410195500_gmail_thread_workspace.sql`).
- Post-phase UX/UI upgrades are shipped (quote export/email polish, localized inbox timestamps, language-aware calendar labels, lazy-loaded chart-heavy routes).
- Quote workflow now supports save, print-to-PDF export, and email send from deal detail.
- Build hardening is applied: chart-heavy routes are lazy-loaded (`Dashboard`, `Reports`, `Forecast`) and the production build no longer triggers chunk-size warnings at the configured threshold.
- Next major milestone: deployment/release hardening (Phase 10).

## Documentation Index

- Docs index:
  - `docs/README.md`
- Full implementation history and technical handoff:
  - `docs/implementation-history.md`
- PRO roadmap (30/60/90) with execution priorities:
  - `docs/pro-roadmap-30-60-90.md`
- Execution backlog (operational checklist):
  - `docs/pro-backlog.md`
- SSO backend integration contract and provider handoff:
  - `docs/auth-sso-backend-handoff.md`
- User profile display name behavior:
  - `docs/user-profile-display-names.md`
- Navigation i18n release handoff:
  - `docs/navigation-i18n-release-handoff.md`
- Navigation + Settings + Sidebar runbook:
  - `docs/navigation-settings-sidebar-runbook.md`
- Lead scoring backend maintenance scheduler contract:
  - `docs/lead-score-maintenance-backend.md`
- Lead maintenance Ops dashboard (Settings) behavior:
  - `docs/lead-maintenance-ops-dashboard.md`
- Lead maintenance incident/run operations runbook:
  - `docs/lead-maintenance-runbook.md`
- Theme system (system/light/dark):
  - `docs/theme-system.md`
- Email mailbox privacy runbook (support/ops):
  - `docs/email-mailbox-privacy-runbook.md`
- Email release readiness checklist:
  - `docs/email-release-checklist.md`
- Email 15-minute smoke test script (QA/support):
  - `docs/email-smoke-test-15min.md`
- Sell-ready release checklist:
  - `docs/sell-ready-release-checklist.md`
- Sell-ready QA evidence (current baseline):
  - `docs/qa-evidence-sell-ready-baseline.md`
- Sell-ready Go/No-Go review:
  - `docs/go-no-go-sell-ready-baseline.md`
- Production handoff and go-live checklist:
  - `docs/production-handoff-checklist.md`
- Audit-ready hardening matrix:
  - `docs/hardening-matrix.md`
- SOC2 / GDPR-lite compliance mapping:
  - `docs/compliance-mapping.md`

## Seed Data
In mock mode, the app ships with realistic Spanish/European B2B seed data:
- **25 contacts** across companies in fintech, SaaS, insurance, banking, retail
- **10 companies** including Bankia, Factorial, Mapfre, Inditex, Cabify, Deloitte
- **18 deals** across all pipeline stages (€500–€50,000)
- **30 activities** (calls, emails, meetings, tasks, LinkedIn, notes)
- **4 demo emails** linked to real contacts/companies/deals for Inbox and quote demo flows
- **3 mock users**: David Muñoz (Sales Manager), Sara López (AE), Carlos Vega (SDR)

To reset demo data: **Settings → Restaurar datos demo**.

In Supabase mode, demo users are not rehydrated into organization sessions.
