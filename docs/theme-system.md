# Theme System (System / Light / Dark)

This CRM now supports three theme preferences:

## Document Control

- Status: Active
- Owner: Frontend
- Last updated: 2026-04-14
- Canonical: Yes

- `system` (default): follows OS/browser preference.
- `light`: always light mode.
- `dark`: always dark mode.

## Behavior

- Theme preference is stored in persisted settings (`crm_settings` localStorage key).
- On app boot, the theme is applied before render from localStorage when available.
- While the app is open:
  - If preference is `system`, OS theme changes are applied automatically.
  - If preference is `light` or `dark`, OS changes are ignored.

## Implementation Notes

- Source of truth:
  - `src/store/settingsStore.ts` (`settings.themePreference`)
- Theme resolution and DOM application:
  - `src/lib/theme.ts`
- Boot-time apply:
  - `src/main.tsx`
- Runtime sync:
  - `src/App.tsx`
- User selector:
  - `src/pages/Settings.tsx`

## Styling Strategy

- Global CSS variables define semantic surfaces/text:
  - `--bg-main`, `--bg-panel`, `--bg-elevated`, `--text-main`, `--text-muted`, `--border-soft`
- `:root.light` overrides variable values.
- Existing dark-first utility classes are adapted for light mode via scoped `.light` overrides in `src/index.css`.

## Extending Theme Coverage

When adding new UI:

1. Prefer semantic classes/components (`glass`, design tokens) over fixed dark hex colors.
2. If new hardcoded dark utility classes are required, add `.light` overrides in `src/index.css`.
3. Validate both modes manually on key pages (`Dashboard`, `Contacts`, `Deals`, `Settings`).
