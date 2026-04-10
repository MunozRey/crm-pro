import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore } from '../../store/toastStore'
import type { ToastType } from '../../store/toastStore'

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />,
  error: <XCircle size={18} className="text-red-400 flex-shrink-0" />,
  warning: <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0" />,
  info: <Info size={18} className="text-blue-400 flex-shrink-0" />,
}

const bgMap: Record<ToastType, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/10',
  error: 'border-red-500/30 bg-red-500/10',
  warning: 'border-yellow-500/30 bg-yellow-500/10',
  info: 'border-blue-500/30 bg-blue-500/10',
}

export function ToastContainer() {
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
            bg-[#111220] ${bgMap[t.type]}
          `}
        >
          {iconMap[t.type]}
          <p className="flex-1 text-sm text-zinc-200">{t.message}</p>
          <button
            onClick={() => removeToast(t.id)}
            aria-label="Cerrar notificación"
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
