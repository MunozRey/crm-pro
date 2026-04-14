# Email Release Checklist

Use this checklist before promoting CRM email changes to production.

## Document Control

- Status: Active
- Owner: QA/Ops
- Last updated: 2026-04-14
- Canonical: Yes

## Functional checks

- [ ] Compose flow works for `to`, `cc`, `bcc`, `reply-to`.
- [ ] Invalid recipient formats are blocked with clear feedback.
- [ ] `Ctrl/Cmd + Enter` sends correctly from composer.
- [ ] Subject presets and quick snippets insert as expected.
- [ ] Quick replies are persisted per user and editable.
- [ ] Sent and Scheduled folders render correctly.
- [ ] Inbox advanced filters and saved views work end-to-end.
- [ ] Inbox sync status badge transitions correctly (syncing/healthy/stale/error).
- [ ] Open/click tracking counters update after refresh.

## Privacy checks

- [ ] Inbox shows private mailbox scope badges.
- [ ] User A cannot see User B local mailbox data.
- [ ] Tracking events are visible only to the owning user.
- [ ] `ownerUserId` is present for newly sent/scheduled emails.
- [ ] Legacy data claim path works (`backfill_email_tracking_user`).

## Backend checks

- [ ] `track-open` deployed and healthy.
- [ ] `track-click` deployed and healthy.
- [ ] Tracking tables include `user_id`.
- [ ] User-scoped RLS policies are active on tracking tables.
- [ ] User-scoped RLS policy is active on `gmail_thread_workspace`.

## QA/verification checks

- [ ] Targeted regression tests pass:
  - `tests/stores/emailStore.trackingBatch.test.ts`
- [ ] Production build passes:
  - `npm run build`
- [ ] No new lint issues in touched files.

## Support readiness

- [ ] Support team has runbook:
  - `docs/email-mailbox-privacy-runbook.md`
- [ ] Ops knows expected mailbox behavior and escalation data required.
