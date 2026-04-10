import type { TextareaHTMLAttributes } from 'react'
import { forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-zinc-300">
            {label}
            {props.required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            w-full rounded-lg border bg-[#0d0e1a] text-slate-100 text-sm
            placeholder:text-slate-600
            focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/50
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-150 p-3 resize-none
            ${error ? 'border-red-500/50' : 'border-white/10 hover:border-white/15'}
            ${className}
          `}
          rows={4}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
