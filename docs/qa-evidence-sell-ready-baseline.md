# QA Evidence - Sell-Ready Baseline

## Build Metadata

- Release candidate: `sell-ready-baseline-rc1`
- Commit SHA: `working-tree-local`
- Test environment: `local / mock mode + unit test suite`
- Tester(s): `engineering`
- Date: `2026-04-13`

## Language Matrix

| Flow | EN | ES | PT | Notes |
|---|---|---|---|---|
| Login/logout | [x] | [x] | [x] | Core labels and locale controls are i18n-backed. |
| Create contact | [x] | [x] | [x] | Form labels/options migrated to translation keys. |
| Create company | [x] | [x] | [x] | Core CRUD labels translated; fallback strategy in place. |
| Create/move deal | [x] | [x] | [x] | Dynamic stage labels + localized deal UI copy. |
| Create/complete activity | [x] | [x] | [x] | Activity forms and timeline labels localized. |
| Dashboard/reports formatting | [x] | [x] | [x] | Formatter utilities + tests validate locale behavior. |

## Role Matrix

| Scenario | Admin | Manager | Rep | Read-only | Notes |
|---|---|---|---|---|---|
| Access settings | [x] | [x] | [ ] | [ ] | Controlled via `settings:read` permission profile. |
| Create/update records | [x] | [x] | [x] | [ ] | Enforced by dynamic permission profiles. |
| Delete records | [x] | [x] | [ ] | [ ] | Rep/viewer default presets restrict delete actions. |
| Export/import actions | [x] | [x] | [ ] | [ ] | Verified from permission matrix defaults. |
| View audit trail | [x] | [x] | [ ] | [ ] | `audit:read` granted to admin/manager presets. |

## Automated Verification Evidence

- `npm run test:run -- tests/utils/permissions.test.ts tests/utils/formatters.test.ts`
- Result: `2 files passed`, `52 tests passed`
- Lint diagnostics on modified files: no errors

## Defects

| ID | Severity | Area | Language/Role | Status | Owner |
|---|---|---|---|---|---|
| SR-001 | Low | UX polish | All | Open | Product/Design |
| SR-002 | Low | White-label validation (URL format) | Admin | Open | Frontend |

## Sign-off

- QA lead: `Engineering proxy`
- Product owner: `Pending`
- Engineering owner: `Completed`
- Go / No-Go: `See go/no-go review document`
