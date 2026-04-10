import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ResetPassword } from '../../src/pages/ResetPassword'

const { mockUpdateUser, mockNavigate } = vi.hoisted(() => ({
  mockUpdateUser: vi.fn(),
  mockNavigate: vi.fn(),
}))

vi.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { updateUser: mockUpdateUser } },
  isSupabaseConfigured: true,
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderResetPassword() {
  return render(<MemoryRouter><ResetPassword /></MemoryRouter>)
}

describe('ResetPassword', () => {
  beforeEach(() => {
    mockUpdateUser.mockReset()
    mockNavigate.mockReset()
  })

  it('AUTH-03: calls updateUser with new password on submit', async () => {
    mockUpdateUser.mockResolvedValue({ error: null })
    renderResetPassword()
    const inputs = screen.getAllByPlaceholderText('••••••••')
    fireEvent.change(inputs[0], { target: { value: 'newpassword123' } })
    fireEvent.change(inputs[1], { target: { value: 'newpassword123' } })
    fireEvent.click(screen.getByRole('button', { name: /save password|guardar contraseña/i }))
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpassword123' })
    })
  })

  it('AUTH-03: shows error when passwords do not match', async () => {
    renderResetPassword()
    const inputs = screen.getAllByPlaceholderText('••••••••')
    fireEvent.change(inputs[0], { target: { value: 'password1' } })
    fireEvent.change(inputs[1], { target: { value: 'password2' } })
    fireEvent.click(screen.getByRole('button', { name: /save password|guardar contraseña/i }))
    await waitFor(() => {
      expect(screen.getByText(/passwords do not match|contraseñas no coinciden/i)).toBeInTheDocument()
    })
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })
})
