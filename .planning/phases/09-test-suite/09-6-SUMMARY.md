---
phase: 09-test-suite
plan: 6
title: Complete i18n Coverage
subsystem: i18n
tags: [i18n, translations, auth, orgSetup, invitations, errors]
dependency-graph:
  requires: []
  provides: [I18N-01, I18N-02]
  affects: [ForgotPassword, OrgSetup, AcceptInvite, Register, Login, Settings, Inbox]
tech-stack:
  added: []
  patterns: [useTranslations, useI18nStore, TranslationSchema]
key-files:
  created: []
  modified:
    - src/i18n/es.ts
    - src/i18n/en.ts
    - src/i18n/pt.ts
    - src/i18n/types.ts
    - src/pages/ForgotPassword.tsx
    - src/pages/OrgSetup.tsx
    - src/pages/AcceptInvite.tsx
    - src/pages/Register.tsx
    - src/pages/Login.tsx
    - src/pages/Settings.tsx
    - src/pages/Inbox.tsx
decisions:
  - Added new top-level `email` section (gmailApiLabel, googleClientIdLabel) since no email section existed yet
  - Used useI18nStore in ThreadView sub-component to get language for dynamic toLocaleString locale
metrics:
  duration: ~25min
  completed: 2026-04-09
  tasks-completed: 5
  files-modified: 11
---

# Phase 09 Plan 6: Complete i18n Coverage Summary

## One-liner
Full i18n parity across es/en/pt: added orgSetup, invitations, errors, email sections plus 9 new auth keys; replaced all 30+ hardcoded strings across 7 component files.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Read existing translation files | Done |
| 2 | Add missing keys to all 3 language files | Done |
| 3 | Update TranslationSchema type (types.ts) | Done |
| 4 | Replace hardcoded strings in 7 components | Done |
| 5 | Verify TypeScript compilation (`npx tsc --noEmit`) | Done — exits 0 |

## Changes Made

### Translation files (es.ts, en.ts, pt.ts)

All three files received identical structural additions with language-appropriate values:

**auth section additions (9 new keys):**
- `forgotPasswordTitle`, `checkEmailTitle`, `checkEmailSent`, `checkEmailInstructions`
- `sendLink`, `backToLogin`, `realAuthEnabled`, `emailPlaceholder`, `checkEmailConfirmation`

**New sections added:**
- `orgSetup` (11 keys): title, subtitle, orgNameLabel, orgNamePlaceholder, slugLabel, slugHint, createButton, 4 error keys
- `invitations` (4 keys): invalidToken, invalidOrExpired, alreadyAccepted, expired
- `errors` (4 keys): supabaseNotConfigured, gmailConnectionError, invitationSendError, duplicateTag
- `email` (2 keys): gmailApiLabel, googleClientIdLabel

### types.ts
Added matching TypeScript interface blocks for all 5 new/extended sections.

### Component updates

- **ForgotPassword.tsx**: Added `useTranslations` import; replaced 6 hardcoded strings (title, check email heading, recovery sent message, instructions, send link button, back to login links) with `t.auth.*`
- **OrgSetup.tsx**: Added `useTranslations` import; replaced 7 hardcoded strings (title, subtitle, labels, placeholder, slug hint, create button, 4 error messages) with `t.orgSetup.*`
- **AcceptInvite.tsx**: Added `useTranslations` import; replaced 5 error strings with `t.invitations.*` and `t.errors.supabaseNotConfigured`
- **Register.tsx**: Replaced `"Real authentication enabled"`, `"Check your email"`, `"We sent a confirmation link to"`, `"tu@empresa.com"` with `t.auth.*`
- **Login.tsx**: Replaced `"Real authentication enabled"`, `"tu@empresa.com"`, `"¿Olvidaste tu contraseña?"` with `t.auth.*`
- **Settings.tsx**: Replaced `'Duplicate tag'`, `'Error al conectar Gmail'`, `'Gmail API'`, `'Google OAuth Client ID'` with `t.errors.*` and `t.email.*`
- **Inbox.tsx**: Replaced `'Error al conectar Gmail'` with `t.errors.gmailConnectionError`; fixed `toLocaleString('es', ...)` to use `language` from `useI18nStore` dynamically

## Deviations from Plan

### Auto-added: email section
The plan mentioned `email.gmailApiLabel` and `email.googleClientIdLabel` but no `email` section existed in the translation files or types. Added the new `email` section (2 keys) to all 3 language files and types.ts. This was necessary to satisfy the plan's requirement without modifying the `settings` section.

### Extra replacement: Login.tsx forgotPassword link
The plan didn't explicitly list the `¿Olvidaste tu contraseña?` link in Login.tsx, but it was a hardcoded Spanish string in the same file. Replaced it with the existing `t.auth.forgotPassword` key as an obvious deviation per Rule 2 (missing coverage).

## Known Stubs
None — all new translation keys are fully wired to live component strings.

## Self-Check

Commits:
- `ab57429c` feat(09-6): complete i18n — orgSetup, invitations, errors, auth pages

Files verified as modified: src/i18n/es.ts, en.ts, pt.ts, types.ts, src/pages/ForgotPassword.tsx, OrgSetup.tsx, AcceptInvite.tsx, Register.tsx, Login.tsx, Settings.tsx, Inbox.tsx

`npx tsc --noEmit` — exits 0 (no output = no errors).

## Self-Check: PASSED
