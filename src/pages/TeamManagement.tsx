import { useState } from 'react'
import {
  Users, Plus, Shield, ShieldCheck, ShieldAlert, Eye,
  MoreVertical, Mail, UserPlus, UserMinus, Edit2, X, Check,
  Key, Clock, Building2, Crown,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { hasPermission } from '../utils/permissions'
import { ROLE_COLORS } from '../utils/permissions'
import { Avatar } from '../components/ui/Avatar'
import { toast } from '../store/toastStore'
import type { UserRole } from '../types/auth'
import { useTranslations } from '../i18n'
import { supabase } from '../lib/supabase'

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  admin: <Crown size={14} />,
  manager: <ShieldCheck size={14} />,
  sales_rep: <Shield size={14} />,
  viewer: <Eye size={14} />,
}

export function TeamManagement() {
  const t = useTranslations()
  const { currentUser, users, invitations, addUser, changeUserRole, deactivateUser, reactivateUser, resetPassword, createInvitation, cancelInvitation } = useAuthStore()
  const [showAddUser, setShowAddUser] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [resetPwUser, setResetPwUser] = useState<string | null>(null)
  const [newPw, setNewPw] = useState('')

  // New user form
  const [newUser, setNewUser] = useState({
    name: '', email: '', password: '', role: 'sales_rep' as UserRole, jobTitle: '', phone: '',
  })

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('sales_rep')
  const [isInviting, setIsInviting] = useState(false)

  if (!currentUser) return null

  const isAdmin = currentUser.role === 'admin'
  const canManageUsers = hasPermission(currentUser.role, 'users:manage_roles')

  const activeUsers = users.filter((u) => u.isActive)
  const inactiveUsers = users.filter((u) => !u.isActive)
  const pendingInvitations = invitations.filter((i) => i.status === 'pending')

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error(t.team.toastFillRequired)
      return
    }
    if (newUser.password.length < 6) {
      toast.error(t.team.toastPasswordMin)
      return
    }
    const result = addUser(newUser)
    if (result.success) {
      toast.success(t.team.toastUserCreated.replace('{name}', newUser.name))
      setNewUser({ name: '', email: '', password: '', role: 'sales_rep', jobTitle: '', phone: '' })
      setShowAddUser(false)
    } else {
      toast.error(result.error || t.team.toastUserCreateError)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { toast.error(t.team.toastEnterEmail); return }
    if (!currentUser?.organizationId) { toast.error('Sin organización configurada'); return }

    // Mock mode fallback: supabase not configured
    if (!supabase) {
      createInvitation(inviteEmail, inviteRole)
      toast.success(t.team.toastInviteSent.replace('{email}', inviteEmail))
      setInviteEmail('')
      setShowInvite(false)
      return
    }

    setIsInviting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-member`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: inviteEmail.trim(),
            role: inviteRole,
            organizationId: currentUser.organizationId,
          }),
        }
      )
      const json = await res.json() as { success?: boolean; error?: string; invitationId?: string }
      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Error al enviar la invitación')
        return
      }
      toast.success(t.team.toastInviteSent.replace('{email}', inviteEmail))
      setInviteEmail('')
      setShowInvite(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsInviting(false)
    }
  }

  const handleResetPassword = (userId: string) => {
    if (newPw.length < 6) { toast.error(t.team.toastPasswordMin6); return }
    resetPassword(userId, newPw)
    toast.success(t.team.toastPasswordReset)
    setResetPwUser(null)
    setNewPw('')
  }

  const activeMembersLabel = (() => {
    const n = activeUsers.length
    const plural = n !== 1 ? 's' : ''
    return t.team.activeMembersCount.replace('{n}', String(n)).replace(/\{s\}/g, plural)
  })()

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={22} className="text-brand-400" />
            {t.team.title}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {activeMembersLabel}
          </p>
        </div>
        {canManageUsers && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/8 text-sm font-medium transition-all"
            >
              <Mail size={15} />
              {t.team.invite}
            </button>
            <button
              onClick={() => setShowAddUser(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gradient text-white text-sm font-semibold"
            >
              <Plus size={15} />
              {t.team.newUser}
            </button>
          </div>
        )}
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['admin', 'manager', 'sales_rep', 'viewer'] as UserRole[]).map((role) => {
          const colors = ROLE_COLORS[role]
          const count = activeUsers.filter((u) => u.role === role).length
          return (
            <div key={role} className="glass rounded-xl border-white/8 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={colors.text}>{ROLE_ICONS[role]}</span>
                <span className="text-xs font-semibold text-slate-300">{t.team.roleLabels[role]}</span>
                <span className="ml-auto text-xs text-slate-600">{count}</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">{t.team.roleDescriptions[role]}</p>
            </div>
          )
        })}
      </div>

      {/* Add user form */}
      {showAddUser && (
        <div className="glass rounded-2xl border-white/10 p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <UserPlus size={16} className="text-brand-400" />
              {t.team.newUser}
            </p>
            <button onClick={() => setShowAddUser(false)} className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t.team.labelName} *</label>
              <input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder={t.team.placeholderFullName} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand-500/40 placeholder:text-slate-600" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t.team.labelEmail} *</label>
              <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder={t.team.placeholderEmail} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand-500/40 placeholder:text-slate-600" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t.team.labelPassword} *</label>
              <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder={t.team.placeholderMinPassword} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand-500/40 placeholder:text-slate-600" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t.team.role}</label>
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand-500/40">
                <option value="admin">{t.team.roleLabels.admin}</option>
                <option value="manager">{t.team.roleLabels.manager}</option>
                <option value="sales_rep">{t.team.roleLabels.sales_rep}</option>
                <option value="viewer">{t.team.roleLabels.viewer}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t.team.labelJobTitle}</label>
              <input value={newUser.jobTitle} onChange={(e) => setNewUser({ ...newUser, jobTitle: e.target.value })} placeholder={t.team.placeholderJobTitle} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand-500/40 placeholder:text-slate-600" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t.common.phone}</label>
              <input value={newUser.phone || ''} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} placeholder="+34 600 000 000" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand-500/40 placeholder:text-slate-600" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAddUser(false)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/6 transition-colors">{t.common.cancel}</button>
            <button onClick={handleAddUser} className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gradient text-white text-sm font-semibold">
              <Check size={14} /> {t.team.createUser}
            </button>
          </div>
        </div>
      )}

      {/* Invite form */}
      {showInvite && (
        <div className="glass rounded-2xl border-white/10 p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Mail size={16} className="text-amber-400" />
              {t.team.inviteByEmail}
            </p>
            <button onClick={() => setShowInvite(false)} className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-3 mb-4">
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder={t.team.placeholderEmail} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand-500/40 placeholder:text-slate-600" />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as UserRole)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand-500/40">
              <option value="manager">{t.team.roleLabels.manager}</option>
              <option value="sales_rep">{t.team.roleLabels.sales_rep}</option>
              <option value="viewer">{t.team.roleLabels.viewer}</option>
            </select>
            <button onClick={handleInvite} disabled={isInviting} className="px-4 py-2 rounded-xl btn-gradient text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">{isInviting ? '...' : t.team.invite}</button>
          </div>
          <p className="text-[10px] text-slate-600">{t.team.invitationValidity}</p>
        </div>
      )}

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <div className="glass rounded-2xl border-white/8 p-5">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">{t.team.pendingInvitations} ({pendingInvitations.length})</p>
          <div className="space-y-2">
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/3">
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-amber-400" />
                  <div>
                    <p className="text-sm text-slate-200">{inv.email}</p>
                    <p className="text-[10px] text-slate-500">
                      {t.team.roleLabels[inv.role]} · {t.team.expires} {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {canManageUsers && (
                  <button onClick={() => { cancelInvitation(inv.id); toast.success(t.team.toastInviteCancelled) }} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
                    {t.common.cancel}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active users list */}
      <div className="glass rounded-2xl border-white/8">
        <div className="px-5 py-3 border-b border-white/6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.team.activeSection}</p>
        </div>
        <div className="divide-y divide-white/4">
          {activeUsers.map((user) => {
            const colors = ROLE_COLORS[user.role]
            const isCurrentUser = user.id === currentUser.id
            return (
              <div key={user.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/2 transition-colors relative">
                <Avatar name={user.name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">{user.name}</p>
                    {isCurrentUser && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-500/15 text-brand-400 font-semibold">{t.team.you}</span>}
                  </div>
                  <p className="text-xs text-slate-500">{user.email} · {user.jobTitle || t.team.noJobTitle}</p>
                </div>

                {/* Role badge */}
                {editingRole === user.id ? (
                  <div className="flex items-center gap-2">
                    <select
                      defaultValue={user.role}
                      onChange={(e) => {
                        changeUserRole(user.id, e.target.value as UserRole)
                        setEditingRole(null)
                        toast.success(t.team.toastRoleUpdated.replace('{name}', user.name))
                      }}
                      className="bg-[#0d0e1a] border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-100 outline-none appearance-none"
                      autoFocus
                    >
                      <option value="admin">{t.team.roleLabels.admin}</option>
                      <option value="manager">{t.team.roleLabels.manager}</option>
                      <option value="sales_rep">{t.team.roleLabels.sales_rep}</option>
                      <option value="viewer">{t.team.roleLabels.viewer}</option>
                    </select>
                    <button onClick={() => setEditingRole(null)} className="p-1 text-slate-500 hover:text-white">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colors.bg} ${colors.text} flex items-center gap-1.5`}>
                    {ROLE_ICONS[user.role]}
                    {t.team.roleLabels[user.role]}
                  </span>
                )}

                {/* Last login */}
                <div className="hidden md:block text-right w-28">
                  <p className="text-[10px] text-slate-600">{t.team.lastLogin}</p>
                  <p className="text-xs text-slate-400">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : t.team.never}
                  </p>
                </div>

                {/* Actions menu */}
                {canManageUsers && !isCurrentUser && (
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-white/8 transition-colors"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {activeMenu === user.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
                        <div className="absolute right-0 top-full mt-1 w-48 glass rounded-xl border-white/10 shadow-float z-50 py-1 animate-scale-in">
                          <button
                            onClick={() => { setEditingRole(user.id); setActiveMenu(null) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/6 transition-colors"
                          >
                            <ShieldAlert size={13} /> {t.team.changeRole}
                          </button>
                          <button
                            onClick={() => { setResetPwUser(user.id); setNewPw(''); setActiveMenu(null) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/6 transition-colors"
                          >
                            <Key size={13} /> {t.team.resetPassword}
                          </button>
                          <div className="border-t border-white/6 my-1" />
                          <button
                            onClick={() => { deactivateUser(user.id); setActiveMenu(null); toast.success(t.team.toastUserDeactivated.replace('{name}', user.name)) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <UserMinus size={13} /> {t.team.deactivateUser}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Reset password inline */}
                {resetPwUser === user.id && (
                  <div className="absolute inset-x-0 top-full bg-navy-800 border border-white/8 rounded-b-xl px-5 py-3 flex items-center gap-3 z-30">
                    <Key size={14} className="text-amber-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder={t.team.placeholderNewPassword}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                      autoFocus
                    />
                    <button onClick={() => handleResetPassword(user.id)} disabled={newPw.length < 6} className="px-3 py-1.5 rounded-lg btn-gradient text-xs text-white font-medium disabled:opacity-40">{t.common.save}</button>
                    <button onClick={() => setResetPwUser(null)} className="p-1 text-slate-500 hover:text-white"><X size={14} /></button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Inactive users */}
      {inactiveUsers.length > 0 && (
        <div className="glass rounded-2xl border-white/8 overflow-hidden opacity-60">
          <div className="px-5 py-3 border-b border-white/6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t.team.inactiveSection} ({inactiveUsers.length})</p>
          </div>
          <div className="divide-y divide-white/4">
            {inactiveUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-4 px-5 py-3">
                <Avatar name={user.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-400">{user.name}</p>
                  <p className="text-xs text-slate-600">{user.email}</p>
                </div>
                {canManageUsers && (
                  <button
                    onClick={() => { reactivateUser(user.id); toast.success(t.team.toastUserReactivated.replace('{name}', user.name)) }}
                    className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors"
                  >
                    {t.team.reactivate}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Org info */}
      {useAuthStore.getState().organization && (
        <div className="glass rounded-2xl border-white/8 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Building2 size={18} className="text-brand-400" />
            <div>
              <p className="text-sm font-semibold text-white">{useAuthStore.getState().organization!.name}</p>
              <p className="text-[10px] text-slate-500">
                {t.team.planInfo
                  .replace('{plan}', useAuthStore.getState().organization!.plan.toUpperCase())
                  .replace('{max}', String(useAuthStore.getState().organization!.maxUsers))}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-white/6 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${(activeUsers.length / (useAuthStore.getState().organization?.maxUsers || 1)) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500">{activeUsers.length}/{useAuthStore.getState().organization!.maxUsers}</span>
          </div>
        </div>
      )}
    </div>
  )
}
