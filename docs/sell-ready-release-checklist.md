# Sell-Ready Release Checklist

Use this checklist before shipping a "sell-ready" baseline release.

## Scope and Planning

- [x] Version/tag and release window confirmed.
- [x] Scope frozen with linked backlog items.
- [x] Rollback owner and rollback steps defined.

## Productization Baseline

- [x] Pipeline settings allow stage rename/probability updates.
- [x] Stage labels render consistently across board/list/detail flows.
- [x] Locale formatting validated for EN/ES/PT.
- [x] No mixed-language UI in critical paths.

## Access and Security

- [x] Permission model validated for Admin/Manager/Rep/Read-only.
- [x] Audit log captures permission-changing operations.
- [x] Email/privacy controls validated for user isolation.

## QA and Regression

- [x] Smoke tests passed: login, contacts, companies, deals, activities, reports.
- [x] Formatter tests pass in CI.
- [x] Manual multilingual regression signed off.
- [x] Known issues documented with severity and owner.

## Operations and Handoff

- [x] Runbooks updated (incident, maintenance, release).
- [x] Monitoring/alerts reviewed for release window.
- [x] Support handoff notes delivered.
- [x] Go/No-Go decision recorded.
