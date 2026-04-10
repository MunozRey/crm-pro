import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

interface SlideOverProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: 'sm' | 'md' | 'lg' | 'xl'
}

const widthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export function SlideOver({ isOpen, onClose, title, children, width = 'lg' }: SlideOverProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy-950/80 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />
      {/* Panel */}
      <div className={`absolute inset-y-0 right-0 flex w-full ${widthClasses[width]} animate-slide-in`}>
        <div className="flex flex-col w-full bg-[#111220] border-l border-white/8 shadow-float">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/6 flex-shrink-0">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Cerrar panel"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          {/* Content */}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Centered Modal ───────────────────────────────────────────────────────────

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

const modalSizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

export function Modal({ isOpen, onClose, title, children, size = 'lg' }: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
      <div
        className="absolute inset-0 bg-navy-950/80 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${modalSizeClasses[size]} glass border border-white/10 rounded-2xl shadow-float animate-scale-in flex flex-col max-h-[90vh]`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/6 flex-shrink-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  danger = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true">
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative glass rounded-2xl shadow-float p-6 w-full max-w-sm mx-4 animate-scale-in border-white/10">
        <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose() }}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
