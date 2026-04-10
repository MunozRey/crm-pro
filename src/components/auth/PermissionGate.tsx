import { useAuthStore } from '../../store/authStore'
import { hasPermission, hasAnyPermission } from '../../utils/permissions'
import type { Permission } from '../../types/auth'

interface PermissionGateProps {
  children: React.ReactNode
  permission?: Permission
  anyOf?: Permission[]
  fallback?: React.ReactNode
}

export function PermissionGate({ children, permission, anyOf, fallback = null }: PermissionGateProps) {
  const currentUser = useAuthStore((s) => s.currentUser)

  if (!currentUser) return <>{fallback}</>

  if (permission && !hasPermission(currentUser.role, permission)) {
    return <>{fallback}</>
  }

  if (anyOf && !hasAnyPermission(currentUser.role, anyOf)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
