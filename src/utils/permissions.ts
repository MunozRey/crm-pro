import type { UserRole, Permission } from '../types/auth'

// ─── Role → Permission Mapping ─────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    // Full access
    'contacts:read', 'contacts:create', 'contacts:update', 'contacts:delete', 'contacts:export',
    'companies:read', 'companies:create', 'companies:update', 'companies:delete',
    'deals:read', 'deals:create', 'deals:update', 'deals:delete', 'deals:move',
    'activities:read', 'activities:create', 'activities:update', 'activities:delete',
    'email:read', 'email:send', 'email:update', 'email:link',
    'reports:read', 'reports:export',
    'templates:read', 'templates:create', 'templates:update', 'templates:delete',
    'products:read', 'products:create', 'products:update', 'products:delete',
    'automations:read', 'automations:create', 'automations:update', 'automations:delete',
    'sequences:read', 'sequences:create', 'sequences:update', 'sequences:delete', 'sequences:enroll',
    'custom_fields:read', 'custom_fields:update',
    'ai:use',
    'settings:read', 'settings:update',
    'users:read', 'users:create', 'users:update', 'users:delete', 'users:manage_roles', 'users:invite',
    'audit:read',
    'goals:read', 'goals:create', 'goals:update', 'goals:delete',
    'import:csv', 'import:json',
  ],
  manager: [
    'contacts:read', 'contacts:create', 'contacts:update', 'contacts:delete', 'contacts:export',
    'companies:read', 'companies:create', 'companies:update', 'companies:delete',
    'deals:read', 'deals:create', 'deals:update', 'deals:delete', 'deals:move',
    'activities:read', 'activities:create', 'activities:update', 'activities:delete',
    'email:read', 'email:send', 'email:update', 'email:link',
    'reports:read', 'reports:export',
    'templates:read', 'templates:create', 'templates:update', 'templates:delete',
    'products:read', 'products:create', 'products:update',
    'automations:read', 'automations:create', 'automations:update',
    'sequences:read', 'sequences:create', 'sequences:update', 'sequences:enroll',
    'custom_fields:read', 'custom_fields:update',
    'ai:use',
    'settings:read',
    'users:read', 'users:invite',
    'audit:read',
    'goals:read', 'goals:create', 'goals:update', 'goals:delete',
    'import:csv', 'import:json',
  ],
  sales_rep: [
    'contacts:read', 'contacts:create', 'contacts:update',
    'companies:read', 'companies:create', 'companies:update',
    'deals:read', 'deals:create', 'deals:update', 'deals:move',
    'activities:read', 'activities:create', 'activities:update', 'activities:delete',
    'email:read', 'email:send', 'email:update', 'email:link',
    'reports:read',
    'templates:read',
    'products:read',
    'automations:read',
    'sequences:read', 'sequences:enroll',
    'custom_fields:read',
    'ai:use',
    'goals:read',
  ],
  viewer: [
    'contacts:read',
    'companies:read',
    'deals:read',
    'activities:read',
    'email:read',
    'reports:read',
    'templates:read',
    'products:read',
    'automations:read',
    'sequences:read',
    'custom_fields:read',
    'goals:read',
  ],
}

/**
 * Canonical role values accepted by the permission system.
 * The 'owner' string emitted by some Supabase flows is normalized to 'admin'
 * in authStore.normalizeRole() before reaching this map.
 */
export const VALID_ROLES: readonly UserRole[] = ['admin', 'manager', 'sales_rep', 'viewer'] as const

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  const rolePerms = ROLE_PERMISSIONS[role] || []
  return permissions.some((p) => rolePerms.includes(p))
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  const rolePerms = ROLE_PERMISSIONS[role] || []
  return permissions.every((p) => rolePerms.includes(p))
}

// ─── Role Labels ────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  manager: 'Director Comercial',
  sales_rep: 'Comercial',
  viewer: 'Solo lectura',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Acceso total. Gestión de usuarios, configuración y datos.',
  manager: 'Gestión de ventas completa. Informes y objetivos del equipo.',
  sales_rep: 'Gestión de contactos, deals y actividades propias.',
  viewer: 'Solo puede ver datos. Sin permisos de edición.',
}

export const ROLE_COLORS: Record<UserRole, { text: string; bg: string }> = {
  admin: { text: 'text-red-400', bg: 'bg-red-500/15' },
  manager: { text: 'text-brand-400', bg: 'bg-brand-500/15' },
  sales_rep: { text: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  viewer: { text: 'text-slate-400', bg: 'bg-white/8' },
}

// ─── Navigation Permissions ─────────────────────────────────────────────────

export interface NavPermission {
  path: string
  requiredPermission: Permission
}

export const NAV_PERMISSIONS: NavPermission[] = [
  { path: '/', requiredPermission: 'contacts:read' },
  { path: '/contacts', requiredPermission: 'contacts:read' },
  { path: '/companies', requiredPermission: 'companies:read' },
  { path: '/deals', requiredPermission: 'deals:read' },
  { path: '/activities', requiredPermission: 'activities:read' },
  { path: '/follow-ups', requiredPermission: 'contacts:read' },
  { path: '/goals', requiredPermission: 'goals:read' },
  { path: '/inbox', requiredPermission: 'email:read' },
  { path: '/reports', requiredPermission: 'reports:read' },
  { path: '/templates', requiredPermission: 'templates:read' },
  { path: '/ai-agent', requiredPermission: 'ai:use' },
  { path: '/settings', requiredPermission: 'settings:read' },
  { path: '/audit', requiredPermission: 'audit:read' },
  { path: '/team', requiredPermission: 'users:read' },
  { path: '/timeline', requiredPermission: 'deals:read' },
  { path: '/forecast', requiredPermission: 'reports:read' },
  { path: '/notifications', requiredPermission: 'contacts:read' },
  { path: '/sequences', requiredPermission: 'sequences:read' },
  { path: '/automations', requiredPermission: 'automations:read' },
  { path: '/calendar', requiredPermission: 'activities:read' },
  { path: '/products', requiredPermission: 'products:read' },
]

export function canAccessRoute(role: UserRole, path: string): boolean {
  const rule = NAV_PERMISSIONS.find((n) => n.path === path)
  if (!rule) return true // No rule = accessible
  return hasPermission(role, rule.requiredPermission)
}
