import type { InputHTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  helpText?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, rightIcon, helpText, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-slate-300">
            {label}
            {props.required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full rounded-xl border bg-[#0d0e1a] text-slate-100 text-sm
              placeholder:text-slate-600
              focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/50
              hover:border-white/15
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-150
              ${error ? 'border-red-500/50 focus:ring-red-500/30' : 'border-white/8'}
              ${leftIcon ? 'pl-9' : 'pl-3'}
              ${rightIcon ? 'pr-9' : 'pr-3'}
              py-2
              ${className}
            `}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {helpText && !error && <p className="text-xs text-slate-500">{helpText}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
