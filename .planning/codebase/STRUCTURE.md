# Codebase Structure

**Analysis Date:** 2026-04-10

## Directory Layout

```
CRM/
├── public/                     # Static assets served as-is by Vite
├── src/
│   ├── assets/                 # Static assets imported by components
│   ├── components/
│   │   ├── activities/         # Activity-domain components (forms, list items)
│   │   ├── ai/                 # AI copilot widgets
│   │   ├── auth/               # Route guard and permission gate components
│   │   ├── companies/          # Company-domain components
│   │   ├── contacts/           # Contact-domain components
│   │   ├── deals/              # Deal-domain components (kanban, forms)
│   │   ├── email/              # Email composer / inbox components
│   │   ├── import/             # CSV/JSON import wizard components
│   │   ├── layout/             # App shell (Sidebar, Topbar, Layout, ErrorBoundary, CommandPalette)
│   │   ├── shared/             # Cross-domain reusable components
│   │   └── ui/                 # Primitive design-system components
│   ├── constants/              # AI model list (aiModels.ts)
│   ├── hooks/                  # Custom React hooks
│   ├── i18n/                   # Translations and language store
│   ├── lib/                    # External client setup (supabase.ts, database.types.ts)
│   ├── pages/                  # One file per route — full-page view components
│   ├── services/               # Stateless external API callers
│   ├── store/                  # Zustand stores (one file per domain)
│   ├── types/                  # TypeScript interfaces and union types
│   ├── utils/                  # Pure helper functions and constants
│   ├── App.tsx                 # Router definition, app-level effects
│   ├── main.tsx                # React DOM entry point
│   └── index.css               # Global Tailwind CSS entry
├── supabase/                   # Supabase schema and migrations
├── index.html                  # Vite HTML shell
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Directory Purposes

**`src/pages/`:**
- Purpose: One file per application route; these are route-level containers that orchestrate stores and domain components
- Contains: 27 `.tsx` files — one per named route
- Key files:
  - `src/pages/Dashboard.tsx` — KPI cards, charts, activity feed
  - `src/pages/Contacts.tsx` — contacts list with filters and smart views
  - `src/pages/ContactDetail.tsx` — single-contact detail view with timeline
  - `src/pages/Deals.tsx` — kanban / list deal pipeline + quote builder (save/export/email)
  - `src/pages/Companies.tsx` — companies list
  - `src/pages/CompanyDetail.tsx` — single-company view
  - `src/pages/Activities.tsx` — activity log with filters
  - `src/pages/Inbox.tsx` — Gmail integration inbox
  - `src/pages/Reports.tsx` — charts and pipeline reports
  - `src/pages/Settings.tsx` — pipeline stage, tag, currency config
  - `src/pages/Automations.tsx` — rule builder for automated actions
  - `src/pages/Sequences.tsx` — email sequence builder
  - `src/pages/TeamManagement.tsx` — user CRUD, role management, invitations
  - `src/pages/Login.tsx`, `src/pages/Register.tsx` — public auth pages

**`src/store/`:**
- Purpose: All persistent application state; each file is one Zustand store
- Contains: 19 store files
- Key files:
  - `src/store/authStore.ts` — current user, session, org, all users, passwords, invitations; also exports `initSupabaseAuth()`
  - `src/store/contactsStore.ts` — contacts array, filter state, CRUD + bulk ops
  - `src/store/dealsStore.ts` — deals array, kanban/list view mode, stage-move logic with side effects
  - `src/store/activitiesStore.ts` — activities with contact/deal associations
  - `src/store/companiesStore.ts` — companies with linked contacts/deals
  - `src/store/aiStore.ts` — model selection, conversations, enrichment cache
  - `src/store/settingsStore.ts` — pipeline stages, tags, currency
  - `src/store/auditStore.ts` — audit log (max 500 entries, FIFO)
  - `src/store/notificationsStore.ts` — in-app notifications with type-level mute preferences
  - `src/store/toastStore.ts` — ephemeral UI toasts (not persisted)
  - `src/store/automationsStore.ts` — automation rules; `executeRulesForTrigger()` called by dealsStore
  - `src/store/sequencesStore.ts` — email sequences and enrollments
  - `src/store/emailStore.ts` — composed emails, Gmail threads, and persisted thread links
  - `src/store/templateStore.ts` — email template library
  - `src/store/goalsStore.ts` — sales goals per user per period
  - `src/store/productsStore.ts` — product catalog for deal quotes
  - `src/store/customFieldsStore.ts` — custom field definitions and values
  - `src/store/attachmentsStore.ts` — file attachments stored as base64 strings
  - `src/store/viewsStore.ts` — smart view (saved filter preset) definitions

**`src/components/layout/`:**
- Purpose: Persistent app chrome shown on every authenticated page
- Key files:
  - `src/components/layout/Layout.tsx` — top-level authenticated shell (Sidebar + Topbar + main content area)
  - `src/components/layout/Sidebar.tsx` — left navigation with role-filtered nav items
  - `src/components/layout/Topbar.tsx` — top bar with search trigger, notifications bell, user avatar
  - `src/components/layout/CommandPalette.tsx` — `Cmd+K` global search/action overlay
  - `src/components/layout/ErrorBoundary.tsx` — React error boundary wrapping each page

**`src/components/ui/`:**
- Purpose: Primitive design-system components; no domain logic, no store access
- Key files: `Button.tsx`, `Modal.tsx` (includes `SlideOver`, `ConfirmDialog`), `Badge.tsx`, `Avatar.tsx`, `Input.tsx`, `Select.tsx`, `Textarea.tsx`, `Toast.tsx`, `StatCard.tsx`, `SkeletonRow.tsx`, `AnimatedCounter.tsx`

**`src/components/shared/`:**
- Purpose: Cross-domain smart components that may access stores or apply cross-cutting logic
- Key files:
  - `src/components/shared/SearchBar.tsx` — text search input with debounce
  - `src/components/shared/SmartViewBar.tsx` — renders saved smart view filter tabs
  - `src/components/shared/EmptyState.tsx` — empty list placeholder with icon and CTA
  - `src/components/shared/CustomFieldRenderer.tsx` — renders and edits custom field values
  - `src/components/shared/AttachmentsList.tsx` — file attachment viewer/uploader

**`src/components/auth/`:**
- Purpose: Authentication and authorisation enforcement in the component tree
- Key files:
  - `src/components/auth/ProtectedRoute.tsx` — redirects to `/login` if unauthenticated; shows access-denied UI if permission missing
  - `src/components/auth/PermissionGate.tsx` — inline conditional render based on `hasPermission()`

**`src/components/deals/`:**
- Purpose: Deal-specific presentational components
- Key files:
  - `src/components/deals/KanbanColumn.tsx` — drag-and-drop column using `@hello-pangea/dnd`
  - `src/components/deals/DealCard.tsx` — deal card rendered inside kanban columns
  - `src/components/deals/DealForm.tsx` — create/edit deal form with quote items

**`src/services/`:**
- Purpose: Functions that call external APIs; stateless (read config from stores via `getState()`, do not `set`)
- Key files:
  - `src/services/aiService.ts` — OpenRouter HTTP integration; exports `enrichContact()`, `enrichDeal()`, `streamChatMessage()`, etc.
  - `src/services/gmailService.ts` — PKCE helpers + Gmail REST API calls (threads/messages/attachments)

**`src/utils/`:**
- Purpose: Pure functions with no side effects or store access
- Key files:
  - `src/utils/permissions.ts` — `ROLE_PERMISSIONS` map, `hasPermission()`, `canAccessRoute()`, role label/color maps
  - `src/utils/constants.ts` — label/color maps for all status enums, `LS_KEYS` object (localStorage key names), `DEAL_STAGES_ORDER`
  - `src/utils/formatters.ts` — `formatCurrency()`, `formatDate()`, `formatRelativeDate()`
  - `src/utils/seedData.ts` — `seedContacts`, `seedDeals`, `seedSettings`, `seedEmails` used for mock/demo population
  - `src/utils/leadScoring.ts` — `computeLeadScore()` returning `LeadScoreBreakdown`
  - `src/utils/dealHealth.ts` — `computeDealHealth()` returning a health status indicator
  - `src/utils/followUpEngine.ts` — derives `FollowUpReminder` list from contacts + activities
  - `src/utils/duplicateDetection.ts` — detects duplicate contacts by email, name, phone

**`src/types/`:**
- Purpose: All TypeScript interfaces — single source of structural truth
- Key files:
  - `src/types/index.ts` — all domain types: `Contact`, `Company`, `Deal`, `Activity`, `CRMEmail`, `EmailTemplate`, `AutomationRule`, `Product`, `QuoteItem`, `SmartView`, `Attachment`, filter interfaces, etc.
  - `src/types/auth.ts` — `AuthUser`, `UserRole`, `Permission`, `Organization`, `Invitation`, `Session`

**`src/lib/`:**
- Purpose: External library client instantiation
- Key files:
  - `src/lib/supabase.ts` — conditional Supabase client; exports `supabase` (null if not configured) and `isSupabaseConfigured` boolean
  - `src/lib/database.types.ts` — auto-generated Supabase TypeScript types

**`src/i18n/`:**
- Purpose: Internationalisation — translations and language state
- Key files:
  - `src/i18n/index.ts` — `useI18nStore` (persisted Zustand), `useTranslations()` hook, `LANGUAGE_LABELS`, `LANGUAGE_FLAGS`
  - `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/pt.ts`, `src/i18n/fr.ts`, `src/i18n/de.ts`, `src/i18n/it.ts` — translation objects

**`src/hooks/`:**
- Purpose: Generic React hooks not tied to a specific domain
- Key files:
  - `src/hooks/useFilters.ts` — generic local filter state hook (`useState` wrapper with `setFilter`, `clearFilters`, `hasActiveFilters`)
  - `src/hooks/useSearch.ts` — search string state with debounce
  - `src/hooks/useLocalStorage.ts` — raw `localStorage` read/write hook

**`src/constants/`:**
- Purpose: Non-utility constants (currently AI model definitions)
- Key files:
  - `src/constants/aiModels.ts` — list of available AI model IDs and labels; `isOpenRouterModel()` helper

**`supabase/`:**
- Purpose: Database schema for future Supabase migration
- Key files: `supabase/schema.sql` — full SQL schema for all CRM tables

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React DOM bootstrap
- `src/App.tsx`: Route definitions and auth initialisation

**Configuration:**
- `vite.config.ts`: Vite build config
- `tailwind.config.js`: Tailwind theme config
- `tsconfig.json`: TypeScript project config
- `.env.example`: Required environment variable template

**Core Logic:**
- `src/store/authStore.ts`: Authentication, session management, user/org CRUD
- `src/store/dealsStore.ts`: Deal pipeline logic including cross-store side effects
- `src/services/aiService.ts`: All AI API calls
- `src/utils/permissions.ts`: Role-based access control matrix

**Type Definitions:**
- `src/types/index.ts`: All domain entity types
- `src/types/auth.ts`: Auth and permission types

## Naming Conventions

**Files:**
- Pages: PascalCase matching the route concept — `ContactDetail.tsx`, `PipelineTimeline.tsx`
- Store files: camelCase with `Store` suffix — `contactsStore.ts`, `dealsStore.ts`
- Component files: PascalCase — `KanbanColumn.tsx`, `DealCard.tsx`
- Utility files: camelCase describing function — `leadScoring.ts`, `dealHealth.ts`
- Type files: `index.ts` (main types), `auth.ts` (auth types)

**Exported identifiers:**
- Store hooks: `use` prefix + PascalCase domain + `Store` — `useContactsStore`, `useDealsStore`
- Page components: PascalCase matching filename — `export function Contacts()`
- UI components: PascalCase — `export function Button()`
- Utility functions: camelCase — `formatCurrency`, `hasPermission`, `computeLeadScore`
- Constants: SCREAMING_SNAKE_CASE — `LS_KEYS`, `DEAL_STAGE_LABELS`, `ROLE_PERMISSIONS`

**Directories:**
- Component subdirectories: lowercase domain name — `contacts/`, `deals/`, `shared/`, `ui/`
- Top-level `src/` subdirectories: lowercase purpose — `store/`, `pages/`, `types/`, `utils/`, `hooks/`

## Where to Add New Code

**New Feature (new route):**
- Page component: `src/pages/MyFeature.tsx`
- Route entry: Add `<Route>` in `src/App.tsx` inside `AppRoutes`, wrapped in `<ProtectedPage>`
- Store (if needed): `src/store/myFeatureStore.ts` — follow the `create<State>()(persist(...))` pattern; add key to `LS_KEYS` in `src/utils/constants.ts`
- Tests: `tests/**` (Vitest configured) and/or colocated tests when appropriate

**New Domain Component:**
- Place inside the matching domain directory: `src/components/deals/MyDealWidget.tsx`
- If cross-domain: `src/components/shared/MyWidget.tsx`

**New UI Primitive:**
- `src/components/ui/MyPrimitive.tsx` — must not import from stores or domain components

**New Entity Type:**
- Add interface to `src/types/index.ts`
- Add auth-related types to `src/types/auth.ts`

**New Utility Function:**
- If pure logic: add to the relevant file in `src/utils/` or create `src/utils/myHelper.ts`
- If external API: create `src/services/myService.ts`

**New Permission:**
- Add the permission string to the `Permission` union in `src/types/auth.ts`
- Add it to the relevant role arrays in `src/utils/permissions.ts` under `ROLE_PERMISSIONS`
- Add route mapping in `NAV_PERMISSIONS` if it gates a route

**New Translation Key:**
- Add to all locale files: `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/pt.ts`, `src/i18n/fr.ts`, `src/i18n/de.ts`, `src/i18n/it.ts`
- Add TypeScript signature to `src/i18n/types.ts` (the `Translations` interface)

**New i18n Language:**
- Create `src/i18n/xx.ts` with a full `Translations` object
- Register in `translations` map in `src/i18n/index.ts`
- Add to `LANGUAGE_LABELS` and `LANGUAGE_FLAGS` maps

## Special Directories

**`src/store/`:**
- Purpose: All Zustand stores — do not place non-store logic here
- Generated: No
- Committed: Yes

**`supabase/`:**
- Purpose: SQL schema, migrations, and Edge Functions for the active Supabase-backed runtime
- Generated: Mixed (hand-authored + generated artifacts)
- Committed: Yes

**`public/`:**
- Purpose: Static files copied verbatim to the Vite build output
- Generated: No
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning documents — codebase maps, phase plans
- Generated: Yes (by GSD tooling)
- Committed: Yes

---

*Structure analysis: 2026-04-10*
