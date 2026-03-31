import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ForgotPassword } from '../../src/pages/ForgotPassword'

const { mockResetPassword } = vi.hoisted(() => ({
  mockResetPassword: vi.fn(),
}))

vi.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { resetPasswordForEmail: mockResetPassword } },
  isSupabaseConfigured: true,
}))

function renderForgotPassword() {
  return render(<MemoryRouter><ForgotPassword /></MemoryRouter>)
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    mockResetPassword.mockReset()
  })

  it('AUTH-03: calls resetPasswordForEmail with email and redirectTo', async () => {
    mockResetPassword.mockResolvedValue({ error: null })
    renderForgotPassword()
    fireEvent.change(screen.getByPlaceholderText('tu@empresa.com'), {
      target: { value: 'user@test.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /enviar enlace/i }))
    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith(
        'user@test.com',
        { redirectTo: expect.stringContaining('/reset-password') }
      )
    })
  })

  it('AUTH-03: shows confirmation message after successful submission', async () => {
    mockResetPassword.mockResolvedValue({ error: null })
    renderForgotPassword()
    fireEvent.change(screen.getByPlaceholderText('tu@empresa.com'), {
      target: { value: 'user@test.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /enviar enlace/i }))
    await waitFor(() => {
      expect(screen.getByText(/revisa tu correo/i)).toBeInTheDocument()
    })
  })
})
