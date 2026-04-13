# Email Mailbox Privacy Runbook

This runbook helps support and operations teams validate and troubleshoot per-user mailbox privacy in CRM Pro.

## Scope

- Inbox visibility for local CRM emails (`sent`, `scheduled`)
- Tracking visibility (opens/clicks) linked to local emails
- Thread workspace metadata privacy behavior
- User-scoped quick replies (`quick_replies`) visibility/editability

## Expected Behavior

- Each authenticated user only sees their own mailbox data.
- Tracking counters only include events for emails owned by the current user.
- Inbox header shows private mailbox scope.
- Settings Ops shows mailbox scope as private per user.
- Quick replies created by one user do not appear for other users.

## Quick Verification

1. Sign in as User A and send a tracked email.
2. Confirm email appears in User A `Sent`.
3. Sign in as User B in the same organization.
4. Confirm User B does not see User A local email in `Sent` / `Scheduled`.
5. Trigger or wait for tracking events.
6. Confirm User A sees updated counters and User B does not.

## Troubleshooting

### Issue: user sees no historical tracking after privacy rollout

- Cause: legacy rows may have `user_id` null.
- Action: open Inbox as the intended owner and trigger refresh.
- Expected: app invokes `backfill_email_tracking_user` and claims eligible legacy rows.

### Issue: cross-user visibility suspected

- Verify account context:
  - active authenticated user
  - active organization
- Verify data ownership fields:
  - local email `ownerUserId`
  - tracking tables `user_id`
- Verify RLS policies are user-scoped (`user_id = auth.uid()`).

### Issue: tracking events not updating

- Check tracking functions deployment:
  - `track-open`
  - `track-click`
- Verify events are stored with matching `user_id`.
- Re-run local mailbox refresh and confirm counters change.

## Escalation Data

When escalating to backend, include:

- Organization id
- User id
- Email id(s)
- Event timestamps (open/click)
- Screenshot of Inbox mailbox privacy badges
- Confirmation of build/version currently deployed
