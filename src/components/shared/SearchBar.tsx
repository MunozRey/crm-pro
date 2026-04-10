import { Search, X } from 'lucide-react'
import { Input } from '../ui/Input'
import { useTranslations } from '../../i18n'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchBar({ value, onChange, placeholder = 'Buscar...', className = '' }: SearchBarProps) {
  const t = useTranslations()
  const effectivePlaceholder = placeholder === 'Buscar...' ? t.common.searchPlaceholder : placeholder
  return (
    <div className={`relative ${className}`}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={effectivePlaceholder}
        leftIcon={<Search size={14} />}
        rightIcon={
          value ? (
            <button
              onClick={() => onChange('')}
              className="text-zinc-500 hover:text-zinc-300 pointer-events-auto"
              aria-label={t.common.close}
            >
              <X size={14} />
            </button>
          ) : undefined
        }
      />
    </div>
  )
}
