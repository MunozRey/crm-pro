# CRM Pro — Sales Platform

A production-grade, full-featured CRM single-page application built with React 18, TypeScript, Vite, and Tailwind CSS. Inspired by HubSpot/Pipedrive, designed for Spanish/European B2B sales teams.

## Features

| Module | Features |
|---|---|
| **Dashboard** | KPI cards, revenue bar chart, deal funnel, recent activity, top deals |
| **Contacts** | Table/grid view, search, filters, bulk delete, CSV export, slide-over form |
| **Contact Detail** | Overview, Activities, Deals, Notes tabs |
| **Companies** | Table view, industry/status/size filters, company detail page |
| **Deals** | Kanban drag & drop + list view, deal detail panel, mark Won/Lost |
| **Activities** | Unified feed, overdue highlighting, quick complete/delete |
| **Reports** | Revenue forecast, Won/Lost donut, activities by type, contacts by source, conversion funnel |
| **Settings** | Tags management, pipeline stages, mock users, JSON export/import, data reset |

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The app runs at `http://localhost:5173` and auto-seeds with 25 contacts, 10 companies, 18 deals, and 30 activities on first load.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript (strict) |
| Build | Vite 8 |
| Styling | Tailwind CSS 3 (dark theme) |
| Routing | React Router v6 |
| State | Zustand 5 with `persist` middleware |
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
├── pages/              # Dashboard, Contacts, ContactDetail, Companies, CompanyDetail,
│                       # Deals, Activities, Reports, Settings
├── store/              # Zustand stores: contacts, companies, deals, activities, settings, toast
├── types/              # All TypeScript interfaces (index.ts)
├── hooks/              # useLocalStorage, useSearch, useFilters
└── utils/              # formatters, constants, seedData
```

## Architecture Decisions

### State Management (Zustand)
Each domain (contacts, companies, deals, activities) has its own Zustand store with `persist` middleware that auto-saves to `localStorage`. Stores hydrate from seed data on first load (empty localStorage).

### Persistence Strategy
All data persists in `localStorage` under namespaced keys (`crm_contacts`, `crm_companies`, etc.). The `useLocalStorage` hook provides a raw key-value interface for simple values.

### Form Validation
React Hook Form + Zod schemas validate all forms client-side before submission. Each schema uses strict types (no `.default()` to avoid Zod v4 type inference issues with optional fields).

### Routing
React Router v6 with nested layouts. Each page is wrapped in an `ErrorBoundary` component to prevent cascading failures.

### Component Size
All components are kept under 200 lines. Large pages (Contacts, Deals) delegate form logic to dedicated `*Form` components.

## Supabase Migration Roadmap

The app is architected for a clean swap from localStorage to Supabase:

### Step 1: Schema
Create Supabase tables matching the TypeScript interfaces in `src/types/index.ts`. Enable Row Level Security (RLS) with user-based policies.

### Step 2: Replace localStorage stores
Each Zustand store has a `// TODO: Replace localStorage persistence with Supabase` comment. Replace the `persist` middleware with direct Supabase client calls:

```ts
// Before (localStorage via Zustand persist)
set((state) => ({ contacts: [contact, ...state.contacts] }))

// After (Supabase)
const { data } = await supabase.from('contacts').insert(contact).select().single()
set((state) => ({ contacts: [data, ...state.contacts] }))
```

### Step 3: Real-time subscriptions
Add Supabase real-time listeners to sync across browser tabs:

```ts
supabase
  .channel('contacts')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' },
    (payload) => { /* update store */ })
  .subscribe()
```

### Step 4: Auth
Use Supabase Auth (`@supabase/auth-ui-react`) to replace the mock user system. The `assignedTo` string fields become foreign keys to `auth.users`.

### Step 5: Replace `useLocalStorage` hook
The `src/hooks/useLocalStorage.ts` hook has a `// TODO: Swap for Supabase real-time subscriptions` comment. Update the hook to use `supabase.from(...).select()` for reads and `.upsert()` for writes.

## Seed Data
The app ships with realistic Spanish/European B2B seed data:
- **25 contacts** across companies in fintech, SaaS, insurance, banking, retail
- **10 companies** including Bankia, Factorial, Mapfre, Inditex, Cabify, Deloitte
- **18 deals** across all pipeline stages (€500–€50,000)
- **30 activities** (calls, emails, meetings, tasks, LinkedIn, notes)
- **3 mock users**: David Muñoz (Sales Manager), Sara López (AE), Carlos Vega (SDR)

To reset seed data: **Settings → Restaurar datos demo**.
