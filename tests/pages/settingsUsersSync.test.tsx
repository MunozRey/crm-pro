import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Settings } from '../../src/pages/Settings'
import { useAuthStore } from '../../src/store/authStore'
import { useSettingsStore } from '../../src/store/settingsStore'
import { seedSettings } from '../../src/utils/seedData'

describe('Settings users sync', () => {
  beforeEach(() => {
    localStorage.clear()

    useSettingsStore.setState({
      settings: {
        ...seedSettings,
        users: [
          { id: 'seed-1', name: 'Seed User', email: 'seed@crmpro.es', role: 'Sales Manager' },
        ],
      },
    })

    useAuthStore.setState({
      users: [
        {
          id: 'auth-1',
          email: 'david@clovrlabs.com',
          name: 'David',
          role: 'admin',
          jobTitle: 'Founder',
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
    })
  })

  it('renders organization users from auth store in settings users section', () => {
    render(<Settings />)

    expect(screen.getByText(/david@clovrlabs\.com/i)).toBeInTheDocument()
    expect(screen.queryByText(/seed@crmpro\.es/i)).not.toBeInTheDocument()
  })
})
