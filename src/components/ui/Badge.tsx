import type { ReactNode } from 'react'

type BadgeVariant =
  | 'blue' | 'yellow' | 'green' | 'red'
  | 'emerald' | 'rose' | 'purple' | 'orange'
  | 'gray' | 'indigo'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  size?: 'sm' | 'md'
}

const variantClasses: Record<BadgeVariant, string> = {
  blue: 'bg-blue-500/15 text-blue-400 ring-blue-500/20',
  yellow: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/20',
  green: 'bg-green-500/15 text-green-400 ring-green-500/20',
  red: 'bg-red-500/15 text-red-400 ring-red-500/20',
  emerald: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/20',
  rose: 'bg-rose-500/15 text-rose-400 ring-rose-500/20',
  purple: 'bg-purple-500/15 text-purple-400 ring-purple-500/20',
  orange: 'bg-orange-500/15 text-orange-400 ring-orange-500/20',
  gray: 'bg-zinc-700/50 text-zinc-400 ring-zinc-600/20',
  indigo: 'bg-indigo-500/15 text-indigo-400 ring-indigo-500/20',
}

export function Badge({ children, variant = 'gray', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ring-inset
        ${variantClasses[variant]}
        ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}
      `}
    >
      {children}
    </span>
  )
}
