# Phase 7: Gmail Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 07-gmail-integration
**Areas discussed:** OAuth callback handling, Token refresh, Email-contact linking, Send from detail pages

---

## OAuth Callback Handling

| Option | Description | Selected |
|--------|-------------|----------|
| /auth/gmail/callback route | Dedicated React Router route — clean separation, Google redirects here, page exchanges code then redirects to /inbox | ✓ |
| Same Inbox page | Inbox detects ?code= on mount, handles exchange inline | |

**User's choice:** `/auth/gmail/callback` route

---

### Callback page UI while exchanging

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen spinner | Centered spinner + "Connecting Gmail..." — expected OAuth UX | ✓ |
| Transparent redirect | Blank page flash — minimal but can feel broken if slow | |

**User's choice:** Full-screen spinner

---

### Error handling on callback

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to /inbox with error toast | User lands on Inbox, sees toast "Gmail connection failed — try again" | ✓ |
| Show error on callback page | Error shown inline with retry button | |

**User's choice:** Redirect to /inbox with error toast

---

## Token Refresh

| Option | Description | Selected |
|--------|-------------|----------|
| Silent background refresh | 401 triggers auto-refresh via Edge Function, retries original call — invisible to user | ✓ |
| Reconnect banner | Expired token shows banner requiring user action every hour | |

**User's choice:** Silent background refresh

---

## Email → Contact Linking

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic on inbox load | Match sender email to contacts table every time threads load, show contact chip on matched threads | ✓ |
| Manual link button | User clicks "Link to contact" per thread | |

**User's choice:** Automatic on inbox load

---

## Send from Contact/Deal Pages

| Option | Description | Selected |
|--------|-------------|----------|
| SlideOver with EmailComposer | Existing EmailComposer opens in SlideOver, contact/deal pre-filled, user stays on page | ✓ |
| Navigate to Inbox | User taken to /inbox with compose open — loses context | |

**User's choice:** SlideOver with EmailComposer
