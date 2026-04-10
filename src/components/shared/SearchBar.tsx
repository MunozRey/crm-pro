import { Search, X } from 'lucide-react'
import { Input } from '../ui/Input'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchBar({ value, onChange, placeholder = 'Buscar...', className = '' }: SearchBarProps) {
  return (
    <div className={`relative ${className}`}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        leftIcon={<Search size={14} />}
        rightIcon={
          value ? (
            <button
              onClick={() => onChange('')}
              className="text-zinc-500 hover:text-zinc-300 pointer-events-auto"
              aria-label="Limpiar búsqueda"
            >
              <X size={14} />
            </button>
          ) : undefined
        }
      />
    </div>
  )
}
