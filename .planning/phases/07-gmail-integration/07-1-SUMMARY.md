---
phase: 07-gmail-integration
plan: 1
subsystem: gmail-oauth
tags: [gmail, oauth, pkce, security, zustand]
dependency_graph:
  requires: []
  provides: [GmailTokenContext, initiateGmailOAuth, emailStore-v2]
  affects: [src/pages/Inbox.tsx, src/pages/Settings.tsx, src/components/layout/Sidebar.tsx, src/App.tsx]
tech_stack:
  added: [GmailTokenContext, PKCE OAuth, Web Crypto API]
  patterns: [in-memory token storage, PKCE with SHA-256, sessionStorage for OAuth state]
key_files:
  created:
    - src/contexts/GmailTokenContext.tsx
  modified:
    - src/services/gmailService.ts
    - src/store/emailStore.ts
    - src/App.tsx
    - src/pages/Inbox.tsx
    - src/pages/Settings.tsx
    - src/components/layout/Sidebar.tsx
decisions:
  - GmailTokenContext holds access token in React state only — never localStorage or sessionStorage
  - initiateGmailOAuth uses Web Crypto API (crypto.subtle) for PKCE SHA-256 challenge
  - emailStore version bumped to 2 with migrate() to strip legacy gmailTokens from existing localStorage
  - isGmailConnected() now checks gmailAddress presence; token validity managed by GmailTokenContext
metrics:
  duration: 15m
  completed: "2026-04-09"
  tasks_completed: 3
  files_changed: 6
---

# Phase 07 Plan 1: Gmail OAuth Foundation Summary

In-memory Gmail access token context with PKCE OAuth initiation replacing the implicit initTokenClient flow; emailStore cleaned of all token persistence.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create GmailTokenContext | cffd8c50 | src/contexts/GmailTokenContext.tsx, src/App.tsx |
| 2 | Replace requestGmailAccess with PKCE initiateGmailOAuth | d1d5a5cf | src/services/gmailService.ts |
| 3 | Clean emailStore — remove gmailTokens, bump version | 0a787adb | src/store/emailStore.ts, src/pages/Inbox.tsx, src/pages/Settings.tsx, src/components/layout/Sidebar.tsx |

## What Was Built

**GmailTokenContext** (`src/contexts/GmailTokenContext.tsx`): React Context providing `setGmailToken`, `clearGmailToken`, and `isTokenValid()`. Access token held in `useState` — never written to localStorage or sessionStorage. Wraps `AppRoutes` in `App.tsx`.

**initiateGmailOAuth** (`src/services/gmailService.ts`): PKCE OAuth initiation using `crypto.getRandomValues` (64-byte verifier) and `crypto.subtle.digest('SHA-256')` for the challenge. Stores `gmail_oauth_verifier` and `gmail_oauth_state` in sessionStorage, then redirects to `https://accounts.google.com/o/oauth2/v2/auth` with `code_challenge_method: S256`. Old `requestGmailAccess`, `isGISLoaded`, and `initTokenClient` window global declaration fully removed.

**emailStore v2** (`src/store/emailStore.ts`): `gmailTokens` field removed from interface, initial state, and `partialize`. `sendEmail` and `loadThreads` now accept `accessToken: string` as a parameter. `isGmailConnected()` returns `!!get().gmailAddress`. `disconnectGmail()` clears `gmailAddress` and `threads`. Persist version bumped to 2 with `migrate()` that deletes stale `gmailTokens` from existing localStorage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed callers of removed emailStore API and requestGmailAccess**
- **Found during:** Task 3 (TypeScript compilation check)
- **Issue:** Inbox.tsx used `requestGmailAccess`, `setGmailTokens`, `gmailTokens`, and called `loadThreads()` with no arguments. Settings.tsx used `requestGmailAccess` and `setGmailTokens`. Sidebar.tsx read `gmailTokens` directly from store state.
- **Fix:** Updated all three callers to use `initiateGmailOAuth`, `useGmailToken()` context, and the new `loadThreads(accessToken)` signature. Sidebar uses `isGmailConnected()` method instead of direct field access.
- **Files modified:** src/pages/Inbox.tsx, src/pages/Settings.tsx, src/components/layout/Sidebar.tsx
- **Commit:** 0a787adb

**2. [Rule 1 - Bug] revokeGmailAccess no longer depends on window.google GIS script**
- **Found during:** Task 2 (removing GIS declarations)
- **Issue:** Old `revokeGmailAccess` called `window.google.accounts.oauth2.revoke` which required the GIS script to be loaded — but we're removing that dependency.
- **Fix:** Replaced with `fetch` to `https://oauth2.googleapis.com/revoke?token=...` — works without GIS.
- **Files modified:** src/services/gmailService.ts
- **Commit:** d1d5a5cf

## Known Stubs

None — no hardcoded placeholder data introduced in this plan. The OAuth callback route (`/auth/gmail/callback`) does not exist yet; it will be implemented in Plan 07-2.

## Self-Check: PASSED

- src/contexts/GmailTokenContext.tsx: FOUND
- src/services/gmailService.ts: FOUND (initiateGmailOAuth exported, requestGmailAccess removed)
- src/store/emailStore.ts: FOUND (gmailTokens absent, version 2, migrate present)
- src/App.tsx: FOUND (GmailTokenProvider wraps AppRoutes)
- TypeScript: 0 errors
