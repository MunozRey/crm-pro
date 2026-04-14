# Navigation Runbook (Settings + Sidebar + i18n)

Canonical document for the navigation delivery. It consolidates implementation, deployment, QA, and i18n handoff in one place.

## Document Control

- Status: Active
- Owner: Frontend
- Last updated: 2026-04-14
- Canonical: Yes

## Scope delivered

- Settings sub-tabs with deep-link support.
- Declarative and customizable left sidebar.
- Per-user persisted navigation preferences in Supabase.
- i18n coverage for EN/ES/PT/FR/DE/IT in navigation-adjacent surfaces.

## Settings tabs

`src/pages/Settings.tsx` supports URL-driven tabs:

- `?tab=general`
- `?tab=branding`
- `?tab=pipeline`
- `?tab=email`
- `?tab=permissions`
- `?tab=data`
- `?tab=navigation`
- `?tab=advanced`

Behavior:

- Tab state is controlled by `useSearchParams`.
- Direct links and refresh remain stable.
- Sections render according to current tab.

## Sidebar customization

`src/components/layout/Sidebar.tsx` renders from preferences rather than fixed order only.

Supported behavior:

- Reorder sections (`main/sales/comms/config`).
- Hide/show sections.
- Reorder and hide built-in items.
- Create custom groups and custom links.
- Apply role-based visibility on custom entries.
- Render nested custom children (submenu-ready).

Security:

- Final route visibility still passes through `canAccessRoute`.
- Preferences cannot bypass permission checks.

## Architecture and files

Core files added:

- `src/types/navigation.ts`
- `src/config/navigationDefaults.ts`
- `src/utils/navigationSanitizer.ts`
- `src/store/navigationPrefsStore.ts`

Core files updated:

- `src/components/layout/Sidebar.tsx`
- `src/pages/Settings.tsx`
- `src/hooks/useDataInit.ts`
- `supabase/schema.sql`

## Preference model

Main type: `NavigationPreferences` (`src/types/navigation.ts`).

Key properties:

- `sectionOrder`
- `hiddenSections`
- `itemOrderBySection`
- `hiddenBuiltinItems`
- `customGroups`

Design intent:

- Defaults from `createDefaultNavigationPreferences()`.
- Runtime sanitization for stale/invalid payloads.
- Safe fallback to defaults for unknown shapes.

## Persistence model

Store: `useNavigationPrefsStore`.

Persistence strategy:

- Optimistic local update (Zustand).
- Supabase upsert to `navigation_preferences`.
- Scoped by `(organization_id, user_id)`.
- Local cache retained for quick startup UX.

Initial load is triggered from `useDataInit()`.

## Required database setup

Expected table and policies:

- `public.navigation_preferences`
- unique `(organization_id, user_id)`
- read/write policy constrained to `auth.uid() = user_id`
- `updated_at` trigger via `handle_updated_at()`

## i18n coverage in this release

Languages covered:

- `en`
- `es`
- `pt`
- `fr`
- `de`
- `it`

Translation files touched:

- `src/i18n/types.ts`
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `src/i18n/pt.ts`
- `src/i18n/fr.ts`
- `src/i18n/de.ts`
- `src/i18n/it.ts`

Surfaces covered:

- Settings navigation editor labels and actions.
- Sidebar saved-view and role-driven labels.
- Related navigation-linked UI touched in this release.

## Deployment checklist

1. Apply schema updates (including `navigation_preferences`).
2. Validate RLS: a user cannot read or write another user's preferences.
3. Test deep-link entry: `/settings?tab=navigation`.
4. Reorder/hide items, refresh, and relogin to verify persistence.
5. Switch languages (`en/es/pt/fr/de/it`) and validate navigation/settings copy.
6. Confirm role-restricted routes remain hidden for disallowed profiles.

## QA checklist

- Settings tabs:
  - direct URL entry works for each tab.
  - refresh preserves active tab.
- Sidebar:
  - section/item reorder persists.
  - hidden entities remain hidden after reload.
  - custom group CRUD works.
  - role visibility works for custom groups/items.
  - invalid persisted payload falls back safely (sanitizer).

## CI/release gate

Before merge/promotion:

- `npx tsc --noEmit`
- `npm run test:run`
- `npm run build`

## Known limitations

- Some low-traffic labels may still require follow-up i18n audit in future slices.
- `Settings.tsx` still contains broad tab sections and can be split into smaller section components later.

## Suggested follow-up hardening

- Extract settings tabs into `settings/sections/*`.
- Add E2E coverage for role-visibility matrix and deep-link flows.
- Add allowlist validation for custom routes.
