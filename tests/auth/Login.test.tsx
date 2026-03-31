import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Login } from '../../src/pages/Login'

const { mockSignIn, mockNavigate } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockNavigate: vi.fn(),
}))

vi.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: mockSignIn } },
  isSupabaseConfigured: true,
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderLogin() {
  return render(<MemoryRouter><Login /></MemoryRouter>)
}

describe('Login', () => {
  beforeEach(() => {
    mockSignIn.mockReset()
    mockNavigate.mockReset()
  })

  it('AUTH-01: calls signInWithPassword with email and password on submit', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('tu@empresa.com'), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret123' } })
    // Button text is 'Ingresar' (Spanish default locale)
    fireEvent.click(screen.getByRole('button', { name: /ingresar|log in|entrar/i }))
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({ email: 'user@test.com', password: 'secret123' })
    })
  })

  it('AUTH-01: shows error message when signIn returns an error', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('tu@empresa.com'), { target: { value: 'bad@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByRole('button', { name: /ingresar|log in|entrar/i }))
    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument()
    })
  })
})
