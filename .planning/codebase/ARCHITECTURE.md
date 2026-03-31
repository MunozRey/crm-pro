# Architecture

**Analysis Date:** 2026-03-31

## Pattern Overview

**Overall:** Single-Page Application (SPA) with client-side state management, local-first persistence, and optional Supabase backend

**Key Characteristics:**
- All application state lives in Zustand stores persisted to `localStorage` via `zustand/middleware/persist`
- No traditional API layer — stores mutate state directly and write to localStorage; Supabase integration is stubbed with TODO markers for future replacement
- Permission-based routing guard wraps every protected page with a role-checked `ProtectedRoute` component
- Automations run entirely in-process via store-to-store calls (no server-side triggers)

## Layers

**Entry Point:**
- Purpose: Bootstrap React tree into the DOM
- Location: `src/main.tsx`
- Contains: `createRoot` call, `StrictMode` wrapper, global CSS import
- Depends on: `src/App.tsx`
- Used by: Browser / Vite dev server

**Router / App Shell:**
- Purpose: Define all routes, enforce auth, wrap pages in layout
- Location: `src/App.tsx`
- Contains: `BrowserRouter`, `Routes`, `ProtectedPage` wrapper component, `initSupabaseAuth()` call on mount
- Depends on: All page components, `authStore`, `ProtectedRoute`, `Layout`, `ErrorBoundary`
- Used by: `main.tsx`

**Layout Shell:**
- Purpose: Persistent chrome around every authenticated page
- Location: `src/components/layout/Layout.tsx`
- Contains: `Sidebar`, `Topbar`, `ToastContainer`, `CommandPalette`, session-expiry polling (60s interval)
- Depends on: `authStore`, `toastStore`, `i18n`
- Used by: `ProtectedPage` in `App.tsx`

**Pages:**
- Purpose: Full-page views, one per route; own their local UI state
- Location: `src/pages/`
- Contains: Feature orchestration — pulls data from stores, renders domain components and UI primitives
- Depends on: Domain stores, domain components, UI components, services, utils
- Used by: `App.tsx` router

**Domain Stores (Zustand):**
- Purpose: Single source of truth for each domain entity; persist to `localStorage`
- Location: `src/store/`
- Contains: State shape, CRUD actions, computed selectors, filter state
- Depends on: `src/types/`, `src/utils/constants.ts`, peer stores (via `getState()` for cross-store calls)
- Used by: Pages and domain components

**Domain Components:**
- Purpose: Feature-specific presentational/smart components scoped to one domain
- Location: `src/components/activities/`, `src/components/ai/`, `src/components/companies/`, `src/components/contacts/`, `src/components/deals/`, `src/components/email/`, `src/components/import/`
- Contains: Forms, cards, lists, kanban columns for a single domain
- Depends on: Domain stores, UI primitives, utils
- Used by: Pages

**Shared / UI Components:**
- Purpose: Reusable, domain-agnostic primitives
- Location: `src/components/shared/` (SearchBar, SmartViewBar, EmptyState, AttachmentsList, CustomFieldRenderer), `src/components/ui/` (Button, Modal, Badge, Avatar, Input, Select, Textarea, Toast, StatCard, SkeletonRow, AnimatedCounter)
- Depends on: No stores (stateless or minimal local state only)
- Used by: All domain components and pages

**Auth Components:**
- Purpose: Route protection and permission-gated rendering
- Location: `src/components/auth/`
- Contains: `ProtectedRoute.tsx` (redirects unauthenticated users, blocks insufficient roles), `PermissionGate` (inline render guard)
- Depends on: `authStore`, `src/utils/permissions.ts`
- Used by: `App.tsx`, pages

**Services:**
- Purpose: Stateless functions that call external APIs
- Location: `src/services/`
- Contains: `aiService.ts` (Anthropic SDK + OpenRouter HTTP calls), `gmailService.ts` (Google Identity Services OAuth + Gmail REST API)
- Depends on: `src/types/`, `src/store/aiStore` (reads API key/model config)
- Used by: Pages and domain components that need AI enrichment or Gmail

**Utilities:**
- Purpose: Pure functions with no side effects
- Location: `src/utils/`
- Contains: `permissions.ts` (role→permission map), `constants.ts` (label/color maps, `LS_KEYS`), `formatters.ts`, `leadScoring.ts`, `dealHealth.ts`, `followUpEngine.ts`, `duplicateDetection.ts`, `seedData.ts`
- Depends on: `src/types/` only
- Used by: Stores, services, components, pages

**Types:**
- Purpose: Shared TypeScript interfaces and union types
- Location: `src/types/index.ts`, `src/types/auth.ts`
- Contains: All domain entity interfaces (`Contact`, `Company`, `Deal`, `Activity`, etc.), filter types, auth types (`AuthUser`, `UserRole`, `Permission`, `Session`, `Organization`)
- Depends on: Nothing
- Used by: All layers

**i18n:**
- Purpose: Multi-language support (ES / EN / PT)
- Location: `src/i18n/`
- Contains: `useI18nStore` (Zustand persisted store for current language), `useTranslations()` hook, translation files (`es.ts`, `en.pt`, `pt.ts`)
- Depends on: Nothing
- Used by: All components and pages

**Supabase Client:**
- Purpose: Optional Supabase connection — only active when env vars are present
- Location: `src/lib/supabase.ts`
- Contains: `createClient` call, `isSupabaseConfigured` boolean guard
- Depends on: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` env vars
- Used by: `authStore` (session sync only); data stores currently use localStorage exclusively

## Data Flow

**Standard User Action (CRUD):**

1. User interacts with a component inside a `src/pages/` file
2. Component calls a store action (e.g., `useContactsStore.getState().addContact(data)`)
3. Store action creates the entity with `uuidv4()`, calls `set()` to update Zustand state
4. Zustand `persist` middleware serialises updated state to `localStorage` under the corresponding `LS_KEYS` key
5. Store action calls `useAuditStore.getState().logAction(...)` as a side effect
6. React re-renders subscribed components automatically via Zustand selector subscriptions

**Deal Stage Move (with cross-store side effects):**

1. `useDealsStore.moveDeal(id, newStage)` is called
2. Store updates deal's `stage` field and timestamps
3. `useAuditStore.logAction('deal_stage_changed', ...)` is called synchronously
4. `useNotificationsStore.notify(...)` fires a toast/notification for `closed_won` / `closed_lost` / stage changes
5. `import('./automationsStore')` is dynamically imported (avoids circular dependency at module init) and `executeRulesForTrigger` is called to fire any matching `AutomationRule`

**AI Enrichment Flow:**

1. Page calls `enrichContact(contact, apiKey)` or `enrichDeal(deal, apiKey)` from `src/services/aiService.ts`
2. Service reads `selectedModel` and `openRouterKey` from `useAIStore.getState()`
3. Service calls Anthropic SDK directly from the browser (`dangerouslyAllowBrowser: true`) or routes via OpenRouter fetch
4. Response is parsed and stored in `useAIStore` (`saveContactEnrichment` / `saveDealEnrichment`)

**Authentication Flow:**

1. On app mount, `initSupabaseAuth()` is called from `App.tsx` `useEffect`
2. If `isSupabaseConfigured` is false, auth falls back to the local mock system in `authStore`
3. Local login: credentials validated against in-memory `users` + `passwords` (simple hash), `session` object stored in persisted Zustand state
4. `ProtectedRoute` checks `isAuthenticated()` (session expiry check) on every render; expired sessions are caught by the 60s interval in `Layout.tsx`

**State Management:**

- All persistent state is in Zustand stores using the `persist` middleware
- Each store serialises to its own `localStorage` key (defined in `LS_KEYS` in `src/utils/constants.ts`)
- `authStore` uses key `crm_auth`; it does not use `LS_KEYS` — its key is hardcoded
- `toastStore` is the only store without `persist` (ephemeral UI toasts only)
- Seed data is injected via `onRehydrateStorage` callbacks: if a store rehydrates empty, seed data is loaded

## Key Abstractions

**`ProtectedPage` (inline component in `App.tsx`):**
- Purpose: Composes `ProtectedRoute` + `Layout` + `ErrorBoundary` into one wrapper to reduce route definition verbosity
- Examples: Every route in `App.tsx` except `/login` and `/register`
- Pattern: Renders `<ProtectedRoute><Layout><ErrorBoundary>{children}</ErrorBoundary></Layout></ProtectedRoute>`

**`PermissionGate`:**
- Purpose: Conditionally renders children based on the current user's permission; used for inline UI guards (e.g., hiding delete buttons from `sales_rep`)
- Examples: Used in `src/pages/Dashboard.tsx`, `src/pages/Deals.tsx`
- Pattern: Reads `currentUser.role` from `authStore` and calls `hasPermission()`

**Zustand Store Pattern:**
- Purpose: Each domain has exactly one store file; stores expose both state and actions as a flat interface
- Examples: `src/store/contactsStore.ts`, `src/store/dealsStore.ts`, `src/store/activitiesStore.ts`
- Pattern: `create<State>()(persist((set, get) => ({ ...state, ...actions }), { name: LS_KEYS.x }))`

**`SmartView`:**
- Purpose: User-saved filter presets that apply dynamic filter criteria to list views
- Examples: `src/store/viewsStore.ts`, rendered via `src/components/shared/SmartViewBar.tsx`
- Pattern: Array of `SmartViewFilter` objects (field + operator + value) applied in-memory against store data

## Entry Points

**Browser Entry:**
- Location: `src/main.tsx`
- Triggers: Vite dev server / production bundle load
- Responsibilities: Mount React root, import global CSS

**App Router:**
- Location: `src/App.tsx`
- Triggers: React mount
- Responsibilities: Initialise Supabase auth listener, declare all 30 routes, enforce auth + permissions on each

**`initSupabaseAuth` (exported function):**
- Location: `src/store/authStore.ts`
- Triggers: `App.tsx` `useEffect` on mount
- Responsibilities: Get initial Supabase session, subscribe to `onAuthStateChange`, map Supabase user to `AuthUser` shape

## Error Handling

**Strategy:** React ErrorBoundary wrapping every page; toast notifications for user-facing operation errors

**Patterns:**
- `src/components/layout/ErrorBoundary.tsx` catches unhandled render errors per page, preventing full app crash
- Store actions return `{ success: boolean; error?: string }` objects for login/register/user operations; callers display errors inline
- AI service calls wrapped in `try/catch`; errors surfaced via `toast.error()`
- Automations store wraps dynamic import in `.catch(() => {})` to treat automation failures as non-critical
- Gmail service returns typed error results rather than throwing

## Cross-Cutting Concerns

**Logging / Audit:** Every CRUD mutation in domain stores calls `useAuditStore.getState().logAction(...)` — persisted to `localStorage` up to 500 entries (`src/store/auditStore.ts`)

**Validation:** Performed inline within store actions (email uniqueness, user limits, session expiry) — no dedicated validation library

**Authentication:** `useAuthStore` with session token (UUID) and 24-hour expiry; `ProtectedRoute` guards routes; `hasPermission()` utility guards individual actions

**Internationalisation:** `useTranslations()` hook used in all pages and most components; language stored in `useI18nStore` with `persist`; 3 locales: `es` (default), `en`, `pt`

**Notifications:** `useNotificationsStore` for persistent in-app notifications; `useToastStore` for ephemeral snackbar toasts; `toast` convenience object exported from `src/store/toastStore.ts`

---

*Architecture analysis: 2026-03-31*
