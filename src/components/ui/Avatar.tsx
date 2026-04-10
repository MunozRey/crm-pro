import { getInitials } from '../../utils/formatters'

interface AvatarProps {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  imageUrl?: string
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
}

const COLOR_CLASSES = [
  'bg-indigo-600',
  'bg-violet-600',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-pink-600',
]

function getColorClass(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLOR_CLASSES[Math.abs(hash) % COLOR_CLASSES.length]
}

export function Avatar({ name, size = 'md', imageUrl }: AvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-zinc-800`}
      />
    )
  }

  return (
    <div
      className={`
        ${sizeClasses[size]} ${getColorClass(name)}
        rounded-full flex items-center justify-center
        font-semibold text-white flex-shrink-0
      `}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  )
}
