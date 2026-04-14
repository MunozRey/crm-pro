import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProtectedRoute } from '../../src/components/auth/ProtectedRoute'
import { useAuthStore } from '../../src/store/authStore'
import { TestRouter } from '../utils/TestRouter'

vi.mock('../../src/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}))

// Mock hasPermission to always return true (permission logic not under test here)
vi.mock('../../src/utils/permissions', () => ({
  hasPermission: vi.fn().mockReturnValue(true),
}))

function renderProtectedRoute(children = <div>Protected Content</div>) {
  return render(
    <TestRouter>
      <ProtectedRoute>{children}</ProtectedRoute>
    </TestRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    // Reset store to loading state before each test
    useAuthStore.setState({
      isLoadingAuth: true,
      currentUser: null,
      session: null,
    })
  })

  it('AUTH-04: renders null while isLoadingAuth is true', () => {
    useAuthStore.setState({ isLoadingAuth: true })
    const { container } = renderProtectedRoute()
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('AUTH-04: redirects to /login when isLoadingAuth is false and not authenticated', () => {
    useAuthStore.setState({
      isLoadingAuth: false,
      currentUser: null,
      session: null,
    })
    renderProtectedRoute()
    // MemoryRouter renders Navigate — the route changes, content is not shown
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('AUTH-04: renders children when isLoadingAuth is false and authenticated', () => {
    const now = Date.now()
    useAuthStore.setState({
      isLoadingAuth: false,
      currentUser: {
        id: 'u1',
        email: 'test@test.com',
        name: 'Test User',
        role: 'admin',
        jobTitle: 'Admin',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      session: {
        userId: 'u1',
        token: 'tok',
        expiresAt: now + 3600000, // 1 hour from now
        createdAt: new Date().toISOString(),
      },
    })
    renderProtectedRoute()
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
})
