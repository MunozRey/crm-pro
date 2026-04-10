import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessRoute,
  getPermissionsForRole,
} from '../../src/utils/permissions'

describe('hasPermission', () => {
  it('admin has users:delete (admin-only permission)', () => {
    expect(hasPermission('admin', 'users:delete')).toBe(true)
  })

  it('viewer does NOT have users:delete', () => {
    expect(hasPermission('viewer', 'users:delete')).toBe(false)
  })

  it('sales_rep does NOT have users:delete', () => {
    expect(hasPermission('sales_rep', 'users:delete')).toBe(false)
  })

  it('manager has users:invite but not users:manage_roles', () => {
    expect(hasPermission('manager', 'users:invite')).toBe(true)
    expect(hasPermission('manager', 'users:manage_roles')).toBe(false)
  })

  it('sales_rep can link inbox emails', () => {
    expect(hasPermission('sales_rep', 'email:link')).toBe(true)
  })

  it('viewer has contacts:read', () => {
    expect(hasPermission('viewer', 'contacts:read')).toBe(true)
  })

  it('sales_rep has contacts:create', () => {
    expect(hasPermission('sales_rep', 'contacts:create')).toBe(true)
  })

  it('viewer does NOT have contacts:delete', () => {
    expect(hasPermission('viewer', 'contacts:delete')).toBe(false)
  })

  it('returns false for unknown role', () => {
    // @ts-expect-error - testing invalid role
    expect(hasPermission('unknown_role', 'contacts:read')).toBe(false)
  })
})

describe('getPermissionsForRole', () => {
  it('returns an array for admin', () => {
    expect(Array.isArray(getPermissionsForRole('admin'))).toBe(true)
  })

  it('admin has more permissions than viewer', () => {
    const adminPerms = getPermissionsForRole('admin')
    const viewerPerms = getPermissionsForRole('viewer')
    expect(adminPerms.length).toBeGreaterThan(viewerPerms.length)
  })

  it('admin has more permissions than sales_rep', () => {
    const adminPerms = getPermissionsForRole('admin')
    const salesPerms = getPermissionsForRole('sales_rep')
    expect(adminPerms.length).toBeGreaterThan(salesPerms.length)
  })

  it('returns empty array for unknown role', () => {
    // @ts-expect-error - testing invalid role
    expect(getPermissionsForRole('unknown_role')).toEqual([])
  })

  it('viewer permissions are all read-only', () => {
    const viewerPerms = getPermissionsForRole('viewer')
    expect(viewerPerms.every((p) => p.endsWith(':read'))).toBe(true)
  })
})

describe('canAccessRoute', () => {
  it('admin can access /team (requires users:read)', () => {
    expect(canAccessRoute('admin', '/team')).toBe(true)
  })

  it('viewer cannot access /team (requires users:read, viewer lacks it)', () => {
    expect(canAccessRoute('viewer', '/team')).toBe(false)
  })

  it('viewer can access /products in read-only mode', () => {
    expect(canAccessRoute('viewer', '/products')).toBe(true)
  })

  it('viewer can access /sequences in read-only mode', () => {
    expect(canAccessRoute('viewer', '/sequences')).toBe(true)
  })

  it('admin can access /audit (requires audit:read)', () => {
    expect(canAccessRoute('admin', '/audit')).toBe(true)
  })

  it('sales_rep cannot access /audit (sales_rep lacks audit:read)', () => {
    expect(canAccessRoute('sales_rep', '/audit')).toBe(false)
  })

  it('all roles can access /contacts (contacts:read is universal)', () => {
    expect(canAccessRoute('admin', '/contacts')).toBe(true)
    expect(canAccessRoute('manager', '/contacts')).toBe(true)
    expect(canAccessRoute('sales_rep', '/contacts')).toBe(true)
    expect(canAccessRoute('viewer', '/contacts')).toBe(true)
  })

  it('returns true for unknown route (no rule = accessible)', () => {
    expect(canAccessRoute('viewer', '/some-unknown-path')).toBe(true)
  })
})

describe('hasAnyPermission', () => {
  it('returns true when role has at least one of the permissions', () => {
    // viewer has contacts:read but not contacts:delete
    expect(hasAnyPermission('viewer', ['contacts:delete', 'contacts:read'])).toBe(true)
  })

  it('returns false when role has none of the permissions', () => {
    expect(hasAnyPermission('viewer', ['contacts:delete', 'users:manage_roles'])).toBe(false)
  })

  it('returns true when role has all listed permissions', () => {
    expect(hasAnyPermission('admin', ['contacts:read', 'users:delete'])).toBe(true)
  })
})

describe('hasAllPermissions', () => {
  it('returns false when role is missing at least one permission', () => {
    // viewer has contacts:read but not contacts:delete
    expect(hasAllPermissions('viewer', ['contacts:delete', 'contacts:read'])).toBe(false)
  })

  it('returns true when role has all permissions', () => {
    expect(hasAllPermissions('admin', ['contacts:read', 'contacts:delete', 'users:delete'])).toBe(true)
  })

  it('returns false for viewer trying to get write permissions', () => {
    expect(hasAllPermissions('viewer', ['contacts:read', 'contacts:create'])).toBe(false)
  })
})
