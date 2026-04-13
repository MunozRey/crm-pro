import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore } from '../../store/toastStore'
import type { ToastType } from '../../store/toastStore'
import { useTranslations } from '../../i18n'

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />,
  error: <XCircle size={18} className="text-red-400 flex-shrink-0" />,
  warning: <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0" />,
  info: <Info size={18} className="text-blue-400 flex-shrink-0" />,
}

const bgMap: Record<ToastType, string> = {
  success: 'toast-success',
  error: 'toast-error',
  warning: 'toast-warning',
  info: 'toast-info',
}

export function ToastContainer() {
  const tr = useTranslations()
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-xl border
            shadow-xl min-w-[280px] max-w-sm
            pointer-events-auto animate-slide-in
            toast-surface ${bgMap[t.type]}
          `}
        >
          {iconMap[t.type]}
          <p className="flex-1 text-sm text-slate-100">{t.message}</p>
          <button
            onClick={() => removeToast(t.id)}
            aria-label={tr.common.close}
            className="text-slate-500 hover:text-slate-200 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
