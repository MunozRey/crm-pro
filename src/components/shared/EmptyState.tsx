import type { ReactNode } from 'react'
import { Button } from '../ui/Button'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-zinc-300 mb-1">{title}</h3>
      <p className="text-sm text-zinc-500 max-w-sm mb-6">{description}</p>
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  )
}
