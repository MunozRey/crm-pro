import { vi } from 'vitest'

export const mockSignInWithPassword = vi.fn()
export const mockSignUp = vi.fn()
export const mockSignOut = vi.fn()
export const mockResetPasswordForEmail = vi.fn()
export const mockUpdateUser = vi.fn()
export const mockOnAuthStateChange = vi.fn()
export const mockGetSession = vi.fn()

export const supabase = {
  auth: {
    signInWithPassword: mockSignInWithPassword,
    signUp: mockSignUp,
    signOut: mockSignOut,
    resetPasswordForEmail: mockResetPasswordForEmail,
    updateUser: mockUpdateUser,
    onAuthStateChange: mockOnAuthStateChange,
    getSession: mockGetSession,
  },
}

export const isSupabaseConfigured = true

vi.mock('../src/lib/supabase', () => ({
  supabase,
  isSupabaseConfigured,
}))
