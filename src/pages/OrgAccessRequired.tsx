import { Link } from 'react-router-dom'
import { MailWarning, LogOut } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useTranslations } from '../i18n'

export function OrgAccessRequired() {
  const t = useTranslations()
  const message = useAuthStore((s) => s.tenantResolutionMessage)
  const logout = useAuthStore((s) => s.logout)

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
          <MailWarning size={28} className="text-amber-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">{t.acceptInvite.invalidTitle}</h1>
        <p className="text-sm text-slate-400 mb-6">
          {message ?? t.errors.noPermissionDescription}
        </p>
        <div className="flex items-center justify-center gap-2">
          <Link
            to="/accept-invite"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors"
          >
            {t.acceptInvite.acceptCta}
          </Link>
          <button
            onClick={() => { logout() }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/12 text-slate-300 hover:text-white hover:bg-white/6 text-sm transition-colors"
          >
            <LogOut size={14} />
            {t.auth.logout}
          </button>
        </div>
      </div>
    </div>
  )
}
