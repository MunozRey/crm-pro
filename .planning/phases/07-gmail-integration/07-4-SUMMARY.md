> [!NOTE]
> Historical snapshot: this phase file is kept for audit/history and may be outdated.
> Source of truth for current status and priorities: `.planning/STATE.md` and `.planning/ROADMAP.md`.

> [!NOTE]
> Historical snapshot: this phase document is preserved for implementation history.
> Source of truth for current status and priorities:  and .

> **Historical Snapshot:** This phase document is retained for historical context. Current source of truth is `.planning/STATE.md` and `.planning/ROADMAP.md`.

---
phase: 07-gmail-integration
plan: 4
status: complete
completed: "2026-04-09"
---

# Plan 07-4 Summary — Inbox Wired to Real Gmail Data

## What was built

**`src/pages/Inbox.tsx`** — Surgical refactor to use the full PKCE + in-memory token flow:

- `connected` now checks both `gmailAddress` (persisted) AND `isTokenValid()` (in-memory token active)
- `contactByEmail` — `useMemo` map built from `contactsStore` for O(1) email→contact lookup
- `extractEmail` — parses `"Name <email@example.com>"` or bare address
- `refreshAndRetry<T>` — wraps any async call; on 401 calls `gmail-refresh-token` Edge Function, updates context, retries once
- `handleLoadThreads` — replaces direct `loadThreads(accessToken)` calls; uses `refreshAndRetry`
- Contact chip in `ThreadItem` — `Link` to `/contacts/:id` with brand styling; shown only when sender email matches a CRM contact
- Disconnect button — now calls `clearGmailToken()` before `disconnectGmail()` to clear both context and store

## Key decisions

| Decision | Reason |
|----------|--------|
| `!!gmailAddress && isTokenValid()` for `connected` | `isGmailConnected()` only checked persisted address — token could be expired |
| `refreshAndRetry` wraps any `(token) => Promise<T>` | Generic enough for future use (send, search, etc.) |
| `e.stopPropagation()` on contact chip | Prevents thread selection event firing when clicking chip link |
| `clearGmailToken()` on disconnect | Ensures in-memory token is cleared immediately without waiting for page reload |

## Files modified

- `src/pages/Inbox.tsx` — useMemo/Link/supabase imports; connected logic; refreshAndRetry; handleLoadThreads; contact chip in ThreadItem; disconnect clears context
