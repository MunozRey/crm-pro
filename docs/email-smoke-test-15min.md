# Email Smoke Test (15 min)

Purpose: quick manual validation for Inbox + tracking + per-user privacy before release.

## Preconditions (2 min)

- Two active users in the same organization (`User A`, `User B`).
- Email tracking functions deployed (`track-open`, `track-click`).
- A test lead/contact email reachable from the browser.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured.

## Flow A - Send + Tracking (6 min)

1. Sign in as `User A`.
2. Go to `Inbox` and send a tracked email to test recipient.
3. Confirm the email appears in sent list with tracking indicators.
4. Open the email from recipient inbox (loads tracking pixel).
5. Click one tracked link from the same email.
6. Back in CRM, run tracking refresh (or wait auto-refresh) and verify:
   - Opens >= 1
   - Clicks >= 1
   - `openedAt` and `lastOpenedAt` are populated and coherent.

## Flow B - Mailbox Privacy (4 min)

1. Keep `User A` email in inbox/sent list.
2. Sign out and sign in as `User B` (same org).
3. Open `Inbox`:
   - `User B` must NOT see `User A` private emails.
   - Privacy badges/hints should indicate per-user mailbox scope.
4. Send one tracked email as `User B`.
5. Sign back as `User A` and confirm `User B` email is not visible.

## Flow C - Legacy Backfill Safety (2 min)

1. Use an older email record (without `ownerUserId`) if available.
2. Trigger tracking metrics refresh in `Inbox`.
3. Confirm no errors in UI and metrics still load for current user.
4. Optional DB check: verify `user_id` backfill on related tracking rows.

## Pass Criteria

- Tracking events are reflected in UI metrics.
- No cross-user email visibility inside same organization.
- No console/runtime errors during refresh and navigation.
- Inbox privacy UI clearly communicates mailbox scope.

## If Failure

- Capture: user id, org id, email id, sent timestamp, and failing step.
- Check runbook: `docs/email-mailbox-privacy-runbook.md`.
- Escalate with screenshots + network logs + edge function request ids.
