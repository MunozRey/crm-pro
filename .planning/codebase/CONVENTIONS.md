# Coding Conventions

**Analysis Date:** 2026-04-10

## Naming Patterns

**Files:**
- React components: PascalCase `.tsx` — `ContactForm.tsx`, `DealCard.tsx`, `ErrorBoundary.tsx`
- Zustand stores: camelCase with `Store` suffix — `contactsStore.ts`, `dealsStore.ts`, `toastStore.ts`
- Hooks: camelCase with `use` prefix — `useFilters.ts`, `useSearch.ts`, `useLocalStorage.ts`
- Utilities: camelCase descriptive nouns — `formatters.ts`, `leadScoring.ts`, `permissions.ts`
- Constants: camelCase nouns — `constants.ts`, `seedData.ts`
- Types: `index.ts` in `src/types/`, auth types in `src/types/auth.ts`

**Functions:**
- Utility functions: camelCase verbs — `formatCurrency`, `formatDate`, `getInitials`, `truncate`
- Store actions: camelCase verbs — `addContact`, `updateDeal`, `deleteContact`, `bulkDelete`
- Store selectors: camelCase `get` prefix — `getById`, `getFilteredContacts`, `getDealsByStage`
- React components: PascalCase — `ContactForm`, `Button`, `SlideOver`, `ConfirmDialog`
- React hooks: `use` prefix — `useFilters`, `useSearch`, `useTranslations`
- Permission helpers: camelCase `has`/`can` prefix — `hasPermission`, `hasAnyPermission`, `canAccessRoute`

**Variables:**
- camelCase throughout — `defaultFilters`, `variantClasses`, `sizeClasses`
- Constants (enum-like objects): `SCREAMING_SNAKE_CASE` — `CONTACT_STATUS_LABELS`, `DEAL_STAGE_COLORS`, `LS_KEYS`, `ROLE_PERMISSIONS`
- Boolean state flags: `is` / `has` prefix — `isLoading`, `isOpen`, `hasError`, `hasActiveFilters`

**TypeScript Types/Interfaces:**
- Interfaces for object shapes: PascalCase `interface` — `Contact`, `Deal`, `ButtonProps`, `ContactsState`
- Union string types: PascalCase `type` — `ContactStatus`, `DealStage`, `ButtonVariant`, `ToastType`
- Inferred form types use `z.infer<typeof schema>` — `type FormValues = z.infer<typeof schema>`

## TypeScript Configuration

**Strict Mode:** Enabled (`"strict": true` in `tsconfig.json`)

**Notable settings:**
- Target: ES2022
- Module resolution: `bundler` (Vite-optimized)
- `noUnusedLocals: false` — unused locals are NOT errors
- `noUnusedParameters: false` — unused params are NOT errors
- `noFallthroughCasesInSwitch: true` — switch fallthrough is an error
- Path alias: `@/*` maps to `./src/*`
- `isolatedModules: true` — each file is a separate module

**Import style:**
- Use `import type` for type-only imports: `import type { Contact } from '../types'`
- Separate type imports from value imports in the same file

## Code Style

**Formatting:**
- Formatting is mostly project-conventional (2 spaces, single quotes); lint diagnostics are enforced in-editor and must stay clean on touched files
- Indentation: 2 spaces (observed throughout)
- Quotes: single quotes for strings
- No trailing semicolons on type/interface lines; function bodies use no explicit style enforcement
- Arrow functions preferred for callbacks; function declarations for named exports

**Linting:**
- Lint/a11y checks are actively used during development (including accessibility labels for icon-only controls)

## Import Organization

**Order observed:**
1. React and React ecosystem (`react`, `react-router-dom`)
2. Third-party libraries (`zustand`, `lucide-react`, `react-hook-form`, `zod`)
3. Internal stores (`../../store/contactsStore`)
4. Internal types (`../../types`, `../types`)
5. Internal utils (`../../utils/formatters`)
6. Internal components (`../ui/Button`)

**Path Aliases:**
- `@/*` is configured but **not observed in use** — all imports use relative paths (`../../store/`, `../ui/`)

## Component Patterns

**UI Primitive Components** (`src/components/ui/`):
- Accept HTML element props via `extends HTMLButtonAttributes`, `extends InputHTMLAttributes`, etc.
- Use `forwardRef` for form elements that need ref forwarding: `Input`, `Select`, `Textarea`
- Always set `displayName` on forwardRef components: `Input.displayName = 'Input'`
- Use variant/size lookup tables (`Record<Variant, string>`) instead of inline conditionals:
  ```typescript
  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'btn-gradient text-white font-semibold',
    danger: 'bg-red-500/15 ...',
  }
  ```
- Spread remaining props with `...props` to maintain native element behavior
- Default props via destructuring defaults: `variant = 'primary'`, `size = 'md'`

**Named Exports:** All components use named exports, never default exports (except `App.tsx`)

**Props Interfaces:**
- Always defined inline above the component
- Extend HTML element interfaces for form primitives
- Optional props use `?` — `avatar?: string`, `loading?: boolean`

**Conditional Rendering:**
- Short-circuit `&&` for simple show/hide
- Ternary for either/or render
- Early `if (!isOpen) return null` for gating entire renders

## Store Patterns (Zustand)

**Structure:**
```typescript
// 1. Define State interface (includes both state and actions)
export interface ContactsState {
  contacts: Contact[]
  isLoading: boolean
  // Actions
  addContact: (...) => Contact
  // Selectors
  getById: (id: string) => Contact | undefined
}

// 2. Create store (Supabase-backed in configured environments)
export const useContactsStore = create<ContactsState>()(
  (set, get) => ({ ... })
)
```

**State Updates:** Always use immutable spread: `set((state) => ({ contacts: [...state.contacts, item] }))`

**Cross-store access:** Stores call other stores via `useXStore.getState().action()` (not hooks — avoids React context requirement)

**Selector usage in components:**
```typescript
const contacts = useContactsStore((s) => s.contacts)  // selector function
```

**Cross-store calls:** Prefer direct static imports + `useXStore.getState()` unless there is a proven circular-dependency issue.

**Seeded initial data:** Demo seeds are used in mock mode; Supabase mode must avoid rehydrating demo users/data into real org sessions.

## Form Validation Pattern

**Stack:** `react-hook-form` + `zod` + `@hookform/resolvers`

**Pattern:**
```typescript
// 1. Define schema at module level
const schema = z.object({
  firstName: z.string().min(1, 'Nombre requerido'),
  email: z.string().email('Email inválido'),
  status: z.enum(['lead', 'prospect', 'customer', 'churned']),
})

// 2. Infer type from schema
type FormValues = z.infer<typeof schema>

// 3. Initialize form with zodResolver
const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: { firstName: contact?.firstName ?? '' }
})

// 4. Pass errors to UI primitives
<Input label="Nombre" error={errors.firstName?.message} {...register('firstName')} />
```

All form components (`ContactForm`, `DealForm`, `CompanyForm`) follow this exact pattern.

## Error Handling

**React Error Boundary:** Class component at `src/components/layout/ErrorBoundary.tsx` wraps every protected page. Catches render errors, shows a reset UI.

**Toast notifications:** `src/store/toastStore.ts` provides a global toast system:
```typescript
// Use the convenience object outside React components:
import { toast } from '../../store/toastStore'
toast.success('Contacto creado')
toast.error('Error al guardar')

// Use the hook inside components:
const { addToast } = useToastStore()
```

**Async errors:** Prefer explicit error handling with user-facing toasts for actionable failures. Most data stores are async Supabase-backed.

**Type narrowing:** Nullish coalescing `??` and optional chaining `?.` preferred over explicit null checks:
```typescript
deal?.title ?? ''
contact.jobTitle ?? ''
```

## Comments

**Section dividers:** Box-drawing comment headers used to section files:
```typescript
// ─── Contact ────────────────────────────────────────────────────────────────
```

**TODO markers:** Use sparingly for bounded follow-ups; avoid stale migration TODOs that no longer apply.
```typescript
// TODO: Phase 10 deploy checklist item pending external infra setup
// TODO: Replace manual smoke with automated integration test for this flow
```

**Inline rationale comments:** Used for non-obvious decisions:
```typescript
// Keep org scope from JWT claims to avoid per-row subqueries
// Refresh Gmail token server-side on demand after 401
```

## Constants and Label Maps

All human-readable labels and color mappings live in `src/utils/constants.ts` as typed `Record<EnumType, string>` objects. This pattern must be followed for new entity types:

```typescript
export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead',
  closed_won: 'Ganado',
}

export const DEAL_STAGE_COLORS: Record<DealStage, string> = {
  lead: 'blue',
  closed_won: 'emerald',
}
```

The color strings in `*_COLORS` maps are Tailwind color names (used as Badge variant props), not hex values — except for chart-related colors which use hex.

## Internationalization

**i18n system:** Custom Zustand-backed i18n at `src/i18n/`. Supported languages: `en`, `es`, `pt`, `fr`, `de`, `it`.

**Usage:**
```typescript
// In React components:
const t = useTranslations()
<span>{t.nav.contacts}</span>

// Outside React (stores, utils):
const t = getTranslations()
```

**String literals in UI:** The codebase mixes hardcoded Spanish strings (especially in forms and error messages) with i18n-translated strings. New UI strings should use the `t` object from `useTranslations()`.

---

*Convention analysis: 2026-04-10*
