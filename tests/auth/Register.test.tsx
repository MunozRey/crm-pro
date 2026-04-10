import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Register } from '../../src/pages/Register'

const { mockSignUp, mockNavigate } = vi.hoisted(() => ({
  mockSignUp: vi.fn(),
  mockNavigate: vi.fn(),
}))

vi.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { signUp: mockSignUp } },
  isSupabaseConfigured: true,
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  )
}

async function fillAndSubmit() {
  const companyInput = screen.getByPlaceholderText(/companies|empresa/i)
  fireEvent.change(companyInput, { target: { value: 'Test Corp' } })
  fireEvent.change(screen.getByPlaceholderText(/name|nombre/i), { target: { value: 'Test User' } })
  fireEvent.change(screen.getByPlaceholderText(/you@company\.com|tu@empresa\.com/i), { target: { value: 'test@example.com' } })
  fireEvent.change(screen.getByPlaceholderText(/password|contraseña/i), { target: { value: 'password123' } })
  fireEvent.click(screen.getByRole('button', { name: /create account|crear cuenta/i }))
}

describe('Register', () => {
  beforeEach(() => {
    mockSignUp.mockReset()
    mockNavigate.mockReset()
  })

  it('AUTH-01: calls supabase.auth.signUp with email, password, and user metadata', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null })
    renderRegister()
    await fillAndSubmit()
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: { data: { full_name: 'Test User', org_name: 'Test Corp' } },
      })
    })
  })

  it('AUTH-02: shows email verification screen when signUp returns no session', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null })
    renderRegister()
    await fillAndSubmit()
    await waitFor(() => {
      expect(screen.getByText(/revisa tu correo|check your email/i)).toBeInTheDocument()
    })
  })

  it('AUTH-01: navigates to / when signUp returns an immediate session', async () => {
    mockSignUp.mockResolvedValue({
      data: { session: { access_token: 'tok', user: { id: 'u1' } } },
      error: null,
    })
    renderRegister()
    await fillAndSubmit()
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('AUTH-01: shows error message on signUp failure', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: { message: 'Email already registered' } })
    renderRegister()
    await fillAndSubmit()
    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeInTheDocument()
    })
  })
})
