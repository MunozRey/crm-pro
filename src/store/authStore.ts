import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { AuthUser, Organization, Invitation, UserRole, Session } from '../types/auth'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// Simple hash for demo purposes (in production, use bcrypt + backend)
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return 'hash_' + Math.abs(hash).toString(36) + '_' + str.length
}

export interface AuthState {
  // Current session
  currentUser: AuthUser | null
  session: Session | null
  organization: Organization | null

  // Supabase session state
  supabaseSession: unknown | null
  isLoadingAuth: boolean

  // All users in the org
  users: AuthUser[]
  passwords: Record<string, string> // userId -> hashed password
  invitations: Invitation[]

  // Actions
  login: (email: string, password: string) => { success: boolean; error?: string }
  logout: () => void
  register: (data: {
    name: string
    email: string
    password: string
    orgName: string
  }) => { success: boolean; error?: string }

  // Supabase session actions
  setCurrentUser: (user: AuthUser | null) => void
  setSupabaseSession: (session: unknown | null) => void
  setIsLoadingAuth: (v: boolean) => void

  // User management
  addUser: (data: {
    name: string
    email: string
    password: string
    role: UserRole
    jobTitle: string
    phone?: string
  }) => { success: boolean; error?: string; user?: AuthUser }
  updateUser: (id: string, updates: Partial<Pick<AuthUser, 'name' | 'email' | 'jobTitle' | 'phone' | 'avatar' | 'isActive'>>) => void
  changeUserRole: (id: string, role: UserRole) => void
  deactivateUser: (id: string) => void
  reactivateUser: (id: string) => void
  changePassword: (userId: string, currentPassword: string, newPassword: string) => { success: boolean; error?: string }
  resetPassword: (userId: string, newPassword: string) => void

  // Invitations
  createInvitation: (email: string, role: UserRole) => Invitation
  acceptInvitation: (invitationId: string, name: string, password: string) => { success: boolean; error?: string }
  cancelInvitation: (id: string) => void

  // Profile
  updateProfile: (updates: Partial<Pick<AuthUser, 'name' | 'jobTitle' | 'phone' | 'avatar'>>) => void

  // Helpers
  getUserById: (id: string) => AuthUser | undefined
  isAuthenticated: () => boolean
}

const SEED_ORG: Organization = {
  id: 'org-001',
  name: 'CRM Pro Sales',
  domain: 'crmpro.es',
  plan: 'pro',
  maxUsers: 25,
  createdAt: '2024-01-01T00:00:00Z',
}

const SEED_USERS: AuthUser[] = [
  {
    id: 'u1',
    email: 'david@crmpro.es',
    name: 'David Muñoz',
    role: 'admin',
    jobTitle: 'Sales Manager',
    phone: '+34 612 345 678',
    organizationId: 'org-001',
    isActive: true,
    lastLoginAt: '2026-03-23T07:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2026-03-23T07:00:00Z',
  },
  {
    id: 'u2',
    email: 'sara@crmpro.es',
    name: 'Sara López',
    role: 'manager',
    jobTitle: 'Account Executive',
    phone: '+34 623 456 789',
    organizationId: 'org-001',
    isActive: true,
    createdAt: '2024-02-15T00:00:00Z',
    updatedAt: '2024-02-15T00:00:00Z',
  },
  {
    id: 'u3',
    email: 'carlos@crmpro.es',
    name: 'Carlos Vega',
    role: 'sales_rep',
    jobTitle: 'SDR',
    phone: '+34 634 567 890',
    organizationId: 'org-001',
    isActive: true,
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-01T00:00:00Z',
  },
]

// Default passwords: all "demo123" for seed users
const SEED_PASSWORDS: Record<string, string> = {
  u1: simpleHash('demo123'),
  u2: simpleHash('demo123'),
  u3: simpleHash('demo123'),
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      session: null,
      organization: null,
      supabaseSession: null,
      isLoadingAuth: false,
      users: SEED_USERS,
      passwords: SEED_PASSWORDS,
      invitations: [],

      setCurrentUser: (user) => {
        set({ currentUser: user })
      },

      setSupabaseSession: (session) => {
        set({ supabaseSession: session })
      },

      setIsLoadingAuth: (v) => {
        set({ isLoadingAuth: v })
      },

      login: (email, password) => {
        const user = get().users.find((u) => u.email.toLowerCase() === email.toLowerCase())
        if (!user) return { success: false, error: 'Usuario no encontrado' }
        if (!user.isActive) return { success: false, error: 'Cuenta desactivada. Contacta al administrador.' }

        const hashed = simpleHash(password)
        if (get().passwords[user.id] !== hashed) {
          return { success: false, error: 'Contraseña incorrecta' }
        }

        const now = new Date().toISOString()
        const session: Session = {
          userId: user.id,
          token: uuidv4(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
          createdAt: now,
        }

        set({
          currentUser: { ...user, lastLoginAt: now },
          session,
          organization: get().organization || SEED_ORG,
          users: get().users.map((u) =>
            u.id === user.id ? { ...u, lastLoginAt: now } : u
          ),
        })

        return { success: true }
      },

      logout: () => {
        set({ currentUser: null, session: null })
      },

      register: (data) => {
        const existing = get().users.find((u) => u.email.toLowerCase() === data.email.toLowerCase())
        if (existing) return { success: false, error: 'Ya existe un usuario con este email' }

        const orgId = uuidv4()
        const userId = uuidv4()
        const now = new Date().toISOString()

        const org: Organization = {
          id: orgId,
          name: data.orgName,
          plan: 'free',
          maxUsers: 5,
          createdAt: now,
        }

        const user: AuthUser = {
          id: userId,
          email: data.email,
          name: data.name,
          role: 'admin',
          jobTitle: 'Administrador',
          organizationId: orgId,
          isActive: true,
          lastLoginAt: now,
          createdAt: now,
          updatedAt: now,
        }

        const session: Session = {
          userId: user.id,
          token: uuidv4(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          createdAt: now,
        }

        set({
          currentUser: user,
          session,
          organization: org,
          users: [user],
          passwords: { [userId]: simpleHash(data.password) },
          invitations: [],
        })

        return { success: true }
      },

      addUser: (data) => {
        const state = get()
        if (!state.currentUser || !state.organization) {
          return { success: false, error: 'No autenticado' }
        }

        const existing = state.users.find((u) => u.email.toLowerCase() === data.email.toLowerCase())
        if (existing) return { success: false, error: 'Ya existe un usuario con este email' }

        if (state.users.filter((u) => u.isActive).length >= state.organization.maxUsers) {
          return { success: false, error: `Límite de usuarios alcanzado (${state.organization.maxUsers})` }
        }

        const now = new Date().toISOString()
        const user: AuthUser = {
          id: uuidv4(),
          email: data.email,
          name: data.name,
          role: data.role,
          jobTitle: data.jobTitle,
          phone: data.phone,
          organizationId: state.organization.id,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }

        set({
          users: [...state.users, user],
          passwords: { ...state.passwords, [user.id]: simpleHash(data.password) },
        })

        return { success: true, user }
      },

      updateUser: (id, updates) => {
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id ? { ...u, ...updates, updatedAt: new Date().toISOString() } : u
          ),
          currentUser: state.currentUser?.id === id
            ? { ...state.currentUser, ...updates, updatedAt: new Date().toISOString() }
            : state.currentUser,
        }))
      },

      changeUserRole: (id, role) => {
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id ? { ...u, role, updatedAt: new Date().toISOString() } : u
          ),
          currentUser: state.currentUser?.id === id
            ? { ...state.currentUser, role, updatedAt: new Date().toISOString() }
            : state.currentUser,
        }))
      },

      deactivateUser: (id) => {
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id ? { ...u, isActive: false, updatedAt: new Date().toISOString() } : u
          ),
        }))
      },

      reactivateUser: (id) => {
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id ? { ...u, isActive: true, updatedAt: new Date().toISOString() } : u
          ),
        }))
      },

      changePassword: (userId, currentPassword, newPassword) => {
        const hashed = simpleHash(currentPassword)
        if (get().passwords[userId] !== hashed) {
          return { success: false, error: 'Contraseña actual incorrecta' }
        }
        set((state) => ({
          passwords: { ...state.passwords, [userId]: simpleHash(newPassword) },
        }))
        return { success: true }
      },

      resetPassword: (userId, newPassword) => {
        set((state) => ({
          passwords: { ...state.passwords, [userId]: simpleHash(newPassword) },
        }))
      },

      createInvitation: (email, role) => {
        const state = get()
        const now = new Date()
        const invitation: Invitation = {
          id: uuidv4(),
          email,
          role,
          invitedBy: state.currentUser?.id || '',
          organizationId: state.organization?.id || '',
          status: 'pending',
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }
        set((s) => ({ invitations: [...s.invitations, invitation] }))
        return invitation
      },

      acceptInvitation: (invitationId, name, password) => {
        const invitation = get().invitations.find((i) => i.id === invitationId)
        if (!invitation) return { success: false, error: 'Invitación no encontrada' }
        if (invitation.status !== 'pending') return { success: false, error: 'Invitación ya usada o expirada' }
        if (new Date(invitation.expiresAt) < new Date()) return { success: false, error: 'Invitación expirada' }

        const result = get().addUser({
          name,
          email: invitation.email,
          password,
          role: invitation.role,
          jobTitle: '',
        })

        if (result.success) {
          set((s) => ({
            invitations: s.invitations.map((i) =>
              i.id === invitationId ? { ...i, status: 'accepted' as const } : i
            ),
          }))
        }

        return result
      },

      cancelInvitation: (id) => {
        set((s) => ({
          invitations: s.invitations.filter((i) => i.id !== id),
        }))
      },

      updateProfile: (updates) => {
        const userId = get().currentUser?.id
        if (!userId) return
        get().updateUser(userId, updates)
      },

      getUserById: (id) => {
        return get().users.find((u) => u.id === id)
      },

      isAuthenticated: () => {
        const { session, currentUser } = get()
        if (!session || !currentUser) return false
        if (session.expiresAt < Date.now()) return false
        return true
      },
    }),
    {
      name: 'crm_auth',
      partialize: (state) => ({
        currentUser: state.currentUser,
        session: state.session,
        organization: state.organization,
        // supabaseSession intentionally excluded — Supabase SDK manages its own storage
        // under localStorage key sb-<ref>-auth-token. Including it here causes stale
        // copies to survive after supabase.auth.signOut().
        users: state.users,
        passwords: state.passwords,
        invitations: state.invitations,
      }),
    }
  )
)

export function initSupabaseAuth(): (() => void) | undefined {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode: auth is synchronous, no async loading needed
    useAuthStore.getState().setIsLoadingAuth(false)
    return
  }

  // isLoadingAuth is already true (initialized as false currently, fixed in plan 2.4)
  // The onAuthStateChange INITIAL_SESSION event resolves the guard.

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    // Always resolve loading on the first event (INITIAL_SESSION fires on startup)
    useAuthStore.getState().setIsLoadingAuth(false)

    if (event === 'PASSWORD_RECOVERY') {
      // Redirect to reset-password page. window.location used because this runs
      // outside React component tree — React Router navigate is not available here.
      window.location.replace('/reset-password')
      return
    }

    useAuthStore.getState().setSupabaseSession(session)

    if (session?.user) {
      const sbUser = session.user
      useAuthStore.getState().setCurrentUser({
        id: sbUser.id,
        name: sbUser.user_metadata?.full_name ?? sbUser.email?.split('@')[0] ?? 'User',
        email: sbUser.email ?? '',
        role: (sbUser.user_metadata?.role ?? 'sales_rep') as UserRole,
        jobTitle: sbUser.user_metadata?.job_title ?? '',
        organizationId: (sbUser.app_metadata?.organization_id as string | undefined) ?? sbUser.user_metadata?.org_id,
        isActive: true,
        createdAt: sbUser.created_at,
        updatedAt: sbUser.updated_at ?? sbUser.created_at,
      })
    } else {
      useAuthStore.getState().setCurrentUser(null)
    }
  })

  // Return unsubscribe for App.tsx useEffect cleanup
  return () => subscription.unsubscribe()
}
