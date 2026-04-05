// ─── Roles ──────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'sales_rep' | 'viewer'

// ─── Permissions ────────────────────────────────────────────────────────────

export type Permission =
  // Contacts
  | 'contacts:read' | 'contacts:create' | 'contacts:update' | 'contacts:delete' | 'contacts:export'
  // Companies
  | 'companies:read' | 'companies:create' | 'companies:update' | 'companies:delete'
  // Deals
  | 'deals:read' | 'deals:create' | 'deals:update' | 'deals:delete' | 'deals:move'
  // Activities
  | 'activities:read' | 'activities:create' | 'activities:update' | 'activities:delete'
  // Email
  | 'email:read' | 'email:send'
  // Reports
  | 'reports:read' | 'reports:export'
  // Templates
  | 'templates:read' | 'templates:create' | 'templates:update' | 'templates:delete'
  // AI
  | 'ai:use'
  // Settings
  | 'settings:read' | 'settings:update'
  // Users & Team
  | 'users:read' | 'users:create' | 'users:update' | 'users:delete' | 'users:manage_roles'
  // Audit
  | 'audit:read'
  // Goals
  | 'goals:read' | 'goals:create' | 'goals:update' | 'goals:delete'
  // Import
  | 'import:csv' | 'import:json'

// ─── Auth User ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  avatar?: string
  jobTitle: string
  phone?: string
  organizationId?: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

// ─── Organization ───────────────────────────────────────────────────────────

export interface Organization {
  id: string
  name: string
  domain?: string
  logo?: string
  plan: 'free' | 'pro' | 'enterprise'
  maxUsers: number
  createdAt: string
}

// ─── Invitation ─────────────────────────────────────────────────────────────

export interface Invitation {
  id: string
  email: string
  role: UserRole
  invitedBy: string
  organizationId: string
  status: 'pending' | 'accepted' | 'expired'
  createdAt: string
  expiresAt: string
}

// ─── Session ────────────────────────────────────────────────────────────────

export interface Session {
  userId: string
  token: string
  expiresAt: number
  createdAt: string
}
