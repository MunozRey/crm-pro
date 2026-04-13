import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { hasPermission } from '../../utils/permissions'
import { isSupabaseConfigured } from '../../lib/supabase'
import type { Permission } from '../../types/auth'
import { useTranslations } from '../../i18n'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermission?: Permission
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const t = useTranslations()
  const isLoadingAuth = useAuthStore((s) => s.isLoadingAuth)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const currentUser = useAuthStore((s) => s.currentUser)
  const organizationId = useAuthStore((s) => s.organizationId)
  const tenantResolutionStatus = useAuthStore((s) => s.tenantResolutionStatus)

  // AUTH-04: Do NOT redirect until Supabase has fired the first auth event.
  // isLoadingAuth starts as true and is set to false inside onAuthStateChange.
  // Without this guard, an authenticated user sees a flash of /login on cold load.
  if (isLoadingAuth) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // AUTH-06: Authenticated users without an org must create one before accessing the CRM.
  // Skip this check for Supabase mock mode (isSupabaseConfigured = false) so demo/dev still works.
  if (isAuthenticated && !organizationId && isSupabaseConfigured) {
    if (tenantResolutionStatus === 'resolving' || tenantResolutionStatus === 'idle') {
      return null
    }
    if (tenantResolutionStatus === 'needs_invitation') {
      return <Navigate to="/org-access-required" replace />
    }
    return <Navigate to="/org-setup" replace />
  }

  if (requiredPermission && currentUser && !hasPermission(currentUser.role, requiredPermission)) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-1">{t.errors.noPermissionTitle}</h2>
          <p className="text-sm text-slate-500">{t.errors.noPermissionDescription}</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
