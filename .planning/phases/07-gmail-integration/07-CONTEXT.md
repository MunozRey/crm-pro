# Phase 7: Gmail Integration - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire Gmail OAuth to use Auth Code + PKCE (replacing the current implicit `initTokenClient` flow that cannot obtain refresh tokens), store refresh tokens server-side in `gmail_tokens` via two Edge Functions, and make the existing Inbox UI load real Gmail data. Also: send emails from ContactDetail/DealDetail via EmailComposer SlideOver, and auto-link incoming emails to contacts by sender address.

**What this phase does NOT include:**
- Rebuilding the Inbox UI (already fully built in `src/pages/Inbox.tsx`)
- Rebuilding EmailComposer (already exists in `src/components/email/EmailComposer.tsx`)
- Gmail push notifications / webhooks (out of scope for v1)

</domain>

<decisions>
## Implementation Decisions

### OAuth Callback Flow
- **D-01:** Use a dedicated `/auth/gmail/callback` React Router route to receive the Google redirect. This is the `redirect_uri` registered in Google Cloud Console.
- **D-02:** The callback page shows a **full-screen spinner** with "Connecting Gmail..." while the Edge Function exchange runs (~1-2 seconds).
- **D-03:** On **success** → redirect to `/inbox` (threads load automatically).
- **D-04:** On **failure** (Edge Function error, expired/invalid code) → redirect to `/inbox` with an **error toast** ("Gmail connection failed — try again"). The Connect Gmail button remains visible.

### OAuth Initiation (PKCE)
- **D-05:** Replace `initTokenClient` with `initCodeClient` in `gmailService.ts`. Generate `code_verifier` (random 64-char string), `code_challenge` (SHA-256 of verifier, base64url-encoded), and `state` (random nonce). Store `code_verifier` + `state` in `sessionStorage` only (never localStorage).
- **D-06:** Redirect to Google authorization endpoint with `access_type=offline&prompt=consent` to ensure refresh token is issued on first connect.

### Token Storage
- **D-07:** The **refresh token** is stored server-side only in `gmail_tokens` table (already in schema). The Edge Function writes it; the browser never sees it.
- **D-08:** The **access token** lives in React component state only — **not** in Zustand `persist`. Remove `gmailTokens` from `emailStore`'s persist partialize. On page refresh, the app triggers a silent token refresh via Edge Function to get a new access token.
- **D-09:** `gmailAddress` (the connected email string) CAN be persisted in localStorage — it's not sensitive, just identifies which account is connected. Used to show "Connected as user@example.com" in the UI.

### Token Refresh
- **D-10:** **Silent background refresh.** When any Gmail API call returns 401, the app automatically calls the `gmail-refresh-token` Edge Function, receives a new short-lived access token, stores it in React state, and retries the original call. User never sees a reconnect banner unless the refresh itself fails (e.g. refresh token revoked by user in Google account).
- **D-11:** On app load, if `gmailAddress` is persisted (user was connected), automatically call `gmail-refresh-token` to restore the access token silently. No redirect required.

### Email → Contact Linking
- **D-12:** **Automatic on inbox load.** After threads are fetched, match each thread's latest message `from` address against the `contacts` table by email. Store matched `contactId` in thread state. Show a contact chip/badge on matched threads in the inbox list. No user action required.
- **D-13:** When a matched thread is opened, show a "View Contact" link that navigates to `/contacts/:id`.
- **D-14:** For unmatched threads (sender not in CRM), show no chip — do not prompt user to create a contact (out of scope).

### Send Email from Detail Pages
- **D-15:** "Send Email" on ContactDetail and DealDetail opens the **existing `EmailComposer`** in a **SlideOver** panel. Contact email and deal context are pre-filled. User composes and sends without leaving the page.
- **D-16:** On successful send, log the email as an activity in `activitiesStore` (type: `email`, subject from email subject, contactId/dealId pre-filled).

### emailStore Changes
- **D-17:** Remove `gmailTokens: GmailTokens | null` from the persisted Zustand store. Access token lives in a React ref or context — NOT in Zustand persist.
- **D-18:** Keep `gmailAddress` in persist (non-sensitive, used for "connected" state indicator).
- **D-19:** Keep `emails: CRMEmail[]` in persist for sent email history (no Supabase migration needed for emails in this phase).

### Claude's Discretion
- The exact React state mechanism for the in-memory access token (useState in a provider, useRef, Zustand slice without persist) — Claude decides.
- The `code_verifier` generation library (crypto.subtle vs a small utility) — Claude decides.
- Whether `gmail-oauth-exchange` and `gmail-refresh-token` are separate Deno functions or one function with a `?action=` param — Claude decides (separate is cleaner).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Gmail Code (reuse, don't rewrite)
- `src/services/gmailService.ts` — Full Gmail REST API wrapper (send, list threads, get thread, profile). **The REST API functions are correct and reusable.** Only the auth initiation (`requestGmailAccess`) needs replacement.
- `src/store/emailStore.ts` — Current state management. Needs: remove `gmailTokens` from persist, add in-memory access token management, add silent refresh logic.
- `src/pages/Inbox.tsx` — Full inbox UI already built. Needs: update to use new PKCE auth flow instead of `requestGmailAccess`.
- `src/components/email/EmailComposer.tsx` — Composer component. Wire into ContactDetail/DealDetail SlideOver.

### Existing Edge Function Pattern
- `supabase/functions/invite-member/` — Reference implementation for Supabase Edge Functions (Deno, service role key usage, CORS headers, JWT verification pattern).

### Schema
- `supabase/schema.sql` — `gmail_tokens` table already defined (user_id, organization_id, access_token, refresh_token, token_expiry, email_address columns).

### Requirements
- `.planning/REQUIREMENTS.md` §Gmail Integration (GMAIL-01 through GMAIL-06) — acceptance criteria.
- `.planning/ROADMAP.md` §Phase 7 — Done When criteria.

### No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gmailService.ts` REST functions (`sendGmailEmail`, `listGmailThreads`, `getGmailThread`, `getGmailProfile`) — production-ready, no changes needed.
- `EmailComposer` component — already handles compose UI, just needs to be wired into ContactDetail/DealDetail SlideOvers.
- `Inbox.tsx` — full thread list + detail UI, just needs auth flow updated.
- `supabase/functions/invite-member/` — Deno Edge Function template with CORS, JWT auth, and Supabase service client pattern.

### Established Patterns
- SlideOver pattern: all forms (ActivityForm, ContactForm, DealForm) open in `<SlideOver>` — EmailComposer follows the same.
- Activity logging: `useActivitiesStore.getState().addActivity(data)` + `toast.success(...)` — same pattern for logging sent emails.
- `isSupabaseConfigured` gate: all Supabase calls wrapped — keep this for Edge Function calls too.
- In-memory access token: do NOT use Zustand `persist` — same principle as Phase 4/5 security decisions.

### Integration Points
- `src/App.tsx` — add `/auth/gmail/callback` route
- `src/pages/ContactDetail.tsx` — add `isEmailOpen` state + SlideOver with EmailComposer
- `src/pages/Deals.tsx` or `DealDetail` — same SlideOver pattern for send from deal
- `src/hooks/useDataInit.ts` — add silent Gmail token refresh on app start (if `gmailAddress` persisted)
- `src/components/layout/Sidebar.tsx` — Inbox nav item already exists

</code_context>

<specifics>
## Specific Ideas

- The `/auth/gmail/callback` page should match the app's dark glass aesthetic (dark background, centered spinner, brand color) — not a plain white page.
- PKCE `code_verifier`: 64 random bytes, base64url-encoded. `code_challenge`: SHA-256 of verifier, base64url-encoded. Use `crypto.subtle` (available in all modern browsers and Deno).
- `state` nonce: stored in sessionStorage as `gmail_oauth_state`, verified in callback to prevent CSRF.

</specifics>

<deferred>
## Deferred Ideas

- Gmail push notifications (webhooks) — real-time inbox updates without polling. Out of scope for v1; would require a separate Supabase Edge Function as webhook receiver.
- "Create contact from email" — when an unmatched thread is viewed, offer to create a contact from the sender. Useful but out of scope for this phase.
- Email tracking (open/click) — `emailStore` already has tracking fields; wiring them to a real tracking pixel is a future phase.

</deferred>

---

*Phase: 07-gmail-integration*
*Context gathered: 2026-04-08*
