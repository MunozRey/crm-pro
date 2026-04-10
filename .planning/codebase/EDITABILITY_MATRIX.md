# Editability Matrix

Updated: 2026-04-10

## Baseline Rules

- Editable by authorized roles: business entities, operational metadata, templates, products, sequences, automations, inbox CRM linking.
- Read-only/system-managed: primary IDs, system timestamps, auth token internals, server claims, immutable audit evidence.
- Role model:
  - `admin`: full edit surface.
  - `manager`: broad commercial/operational editing.
  - `sales_rep`: day-to-day sales execution editing.
  - `viewer`: read-only.

## Module Matrix

| Module | Viewer | Sales Rep | Manager | Admin | Notes |
|---|---|---|---|---|---|
| Contacts | Read | Create/Update | CRUD | CRUD | Export for manager/admin |
| Companies | Read | Create/Update | CRUD | CRUD | |
| Deals | Read | Create/Update/Move | CRUD/Move | CRUD/Move | |
| Activities | Read | CRUD | CRUD | CRUD | |
| Email (sent/local) | Read | Send/Update | Send/Update | Send/Update | |
| Inbox thread linking | Read | Link | Link | Link | Pin/unpin/manual CRM links |
| Templates | Read | Read | CRUD | CRUD | |
| Products | Read | Read | Create/Update | CRUD | |
| Sequences | Read | Read/Enroll | Create/Update/Enroll | CRUD/Enroll | |
| Automations | Read | Read | Create/Update | CRUD | |
| Custom Fields | Read | Read | Update | Update | |
| Team management | Read | Read | Invite | CRUD + roles | Manager invite without full role management |
| Settings reset/import/export | Limited | Limited | Broad | Broad | Gated by existing import/export/settings permissions |

## Permission Keys Introduced

- Email: `email:update`, `email:link`
- Products: `products:read`, `products:create`, `products:update`, `products:delete`
- Automations: `automations:read`, `automations:create`, `automations:update`, `automations:delete`
- Sequences: `sequences:read`, `sequences:create`, `sequences:update`, `sequences:delete`, `sequences:enroll`
- Custom fields: `custom_fields:read`, `custom_fields:update`
- Team invites: `users:invite`

## Guarding Strategy

- Route-level access: `requiredPermission` in `App.tsx`.
- Action-level access: `PermissionGate`.
- Fine-grained per-action hides in complex views (Inbox/Activities/Team).
