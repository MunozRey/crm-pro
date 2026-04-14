import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'

interface TestRouterProps {
  children: ReactNode
  initialEntries?: string[]
}

export function TestRouter({ children, initialEntries }: TestRouterProps) {
  return (
    <MemoryRouter
      initialEntries={initialEntries}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      {children}
    </MemoryRouter>
  )
}
