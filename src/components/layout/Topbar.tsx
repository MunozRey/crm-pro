import { Bell, Search, LogOut, User, ChevronDown } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActivitiesStore } from '../../store/activitiesStore'
import { useCompaniesStore } from '../../store/companiesStore'
import { useContactsStore } from '../../store/contactsStore'
import { useNotificationsStore } from '../../store/notificationsStore'
import { getFollowUpReminders } from '../../utils/followUpEngine'
import { useAuthStore } from '../../store/authStore'
// ROLE_LABELS removed — using t.team.roleLabels instead
import { formatRelativeDate } from '../../utils/formatters'
import { useTranslations } from '../../i18n'
import type { Activity, CRMNotification } from '../../types'
import type { FollowUpReminder } from '../../types'

interface TopbarProps {
  title: string
  onOpenCommandPalette?: () => void
}

/**
 * Uses manual store subscriptions via useState + useEffect to avoid the
 * Zustand v5 `useSyncExternalStore` + React StrictMode `getSnapshot` error
 * that occurs when persist middleware rehydrates between StrictMode passes.
 */
export function Topbar({ title, onOpenCommandPalette }: TopbarProps) {
  const t = useTranslations()
  const [showNotifs, setShowNotifs] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const navigate = useNavigate()

  // Auth – manual getState to avoid getSnapshot issues
  const [currentUser, setCurrentUser] = useState(useAuthStore.getState().currentUser)
  useEffect(() => {
    const unsub = useAuthStore.subscribe((s) => setCurrentUser(s.currentUser))
    return unsub
  }, [])

  // ── Manual subscriptions to avoid getSnapshot caching issue ────────────
  const [overdueActivities, setOverdue] = useState<Activity[]>([])
  const [urgentFollowUps, setUrgent] = useState<FollowUpReminder[]>([])
  const [recentNotifs, setRecentNotifs] = useState<CRMNotification[]>([])
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)

  const computeNotifications = useCallback(() => {
    const activities = useActivitiesStore.getState().activities
    const contacts = useContactsStore.getState().contacts
    const companies = useCompaniesStore.getState().companies
    const now = new Date().toISOString()

    const overdue = activities.filter(
      (a) => a.status === 'pending' && a.dueDate && a.dueDate < now,
    )
    setOverdue(overdue)

    const reminders = getFollowUpReminders(contacts, activities, companies)
    setUrgent(reminders.filter((r) => r.urgency === 'critical' || r.urgency === 'high'))
  }, [])

  const computeNotifStore = useCallback(() => {
    const state = useNotificationsStore.getState()
    setRecentNotifs(state.notifications.slice(0, 5))
    setUnreadNotifCount(state.getUnreadCount())
  }, [])

  useEffect(() => {
    // Initial compute
    computeNotifications()
    computeNotifStore()

    // Subscribe to all stores
    const unsub1 = useActivitiesStore.subscribe(computeNotifications)
    const unsub2 = useContactsStore.subscribe(computeNotifications)
    const unsub3 = useCompaniesStore.subscribe(computeNotifications)
    const unsub4 = useNotificationsStore.subscribe(computeNotifStore)

    return () => { unsub1(); unsub2(); unsub3(); unsub4() }
  }, [computeNotifications, computeNotifStore])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowNotifs(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <header className="h-16 flex items-center gap-4 px-6 border-b border-white/6 bg-navy-900/80 backdrop-blur-xl flex-shrink-0 relative z-30">
      <h1 className="text-base font-semibold text-white mr-auto tracking-tight">{title}</h1>

      {/* Command palette trigger */}
      <button
        onClick={onOpenCommandPalette}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/4 border border-white/8 hover:bg-white/6 hover:border-white/12 transition-all duration-150 text-slate-500 hover:text-slate-300 text-xs"
      >
        <Search size={13} />
        <span>{t.common.search}...</span>
        <kbd className="ml-2 px-1.5 py-0.5 rounded-md bg-white/8 text-[10px] font-medium text-slate-500">⌘K</kbd>
      </button>

      {/* Notification bell */}
      <div className="relative">
        <button
          aria-label={t.nav.notifications}
          onClick={() => setShowNotifs((v) => !v)}
          className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/6 transition-all duration-150 focus:outline-none"
        >
          <Bell size={17} />
          {(overdueActivities.length > 0 || urgentFollowUps.length > 0 || unreadNotifCount > 0) && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-brand-500 shadow-brand-sm flex items-center justify-center">
              <span className="text-[9px] font-bold text-white px-1">
                {Math.min(unreadNotifCount + overdueActivities.length, 99)}
              </span>
            </span>
          )}
        </button>

        {showNotifs && (
          <div className="absolute right-0 top-full mt-2 w-96 border border-white/10 rounded-2xl shadow-float overflow-hidden animate-scale-in z-50" style={{ background: '#0d0f1e' }}>
            <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{t.nav.notifications}</p>
                {unreadNotifCount > 0 && (
                  <p className="text-xs text-brand-400 mt-0.5">{unreadNotifCount}</p>
                )}
              </div>
              <button
                onClick={() => { setShowNotifs(false); navigate('/notifications') }}
                className="text-xs text-brand-400 hover:text-brand-300 font-medium"
              >
                {t.common.view}
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {/* Store notifications */}
              {recentNotifs.length > 0 && recentNotifs.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-white/4 hover:bg-white/4 transition-colors cursor-pointer ${n.isRead ? 'opacity-50' : ''}`}
                  onClick={() => {
                    useNotificationsStore.getState().markAsRead(n.id)
                    setShowNotifs(false)
                    if (n.entityType === 'deal') navigate('/deals')
                    else if (n.entityType === 'contact' && n.entityId) navigate(`/contacts/${n.entityId}`)
                    else if (n.entityType === 'goal') navigate('/goals')
                    else navigate('/notifications')
                  }}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-200 truncate flex-1">{n.title}</p>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{n.message}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{formatRelativeDate(n.createdAt)}</p>
                </div>
              ))}

              {/* Overdue activities */}
              {overdueActivities.length > 0 && (
                <>
                  <div className="px-4 py-2 border-b border-white/6 bg-red-500/5">
                    <p className="text-xs font-semibold text-red-400">
                      {overdueActivities.length} {t.activities.overdue}
                    </p>
                  </div>
                  {overdueActivities.slice(0, 3).map((act) => (
                    <div key={act.id} className="px-4 py-3 border-b border-white/4 hover:bg-white/4 transition-colors cursor-pointer"
                      onClick={() => { setShowNotifs(false); navigate('/activities') }}
                    >
                      <p className="text-sm text-slate-200 truncate">{act.subject}</p>
                      <p className="text-xs text-red-400 mt-0.5">{formatRelativeDate(act.dueDate ?? '')}</p>
                    </div>
                  ))}
                </>
              )}

              {/* Follow-ups */}
              {urgentFollowUps.length > 0 && (
                <>
                  <div className="px-4 py-2 border-b border-white/6 bg-amber-500/5">
                    <p className="text-xs font-semibold text-amber-400">{t.nav.followUps}</p>
                  </div>
                  {urgentFollowUps.slice(0, 3).map((fu) => (
                    <div
                      key={fu.contactId}
                      className="px-4 py-3 border-b border-white/4 hover:bg-white/4 transition-colors cursor-pointer"
                      onClick={() => { setShowNotifs(false); navigate(`/contacts/${fu.contactId}`) }}
                    >
                      <p className="text-sm text-slate-200 truncate">{fu.contactName}</p>
                      <p className="text-xs text-amber-400 mt-0.5">{fu.daysSinceContact}d</p>
                    </div>
                  ))}
                </>
              )}

              {recentNotifs.length === 0 && overdueActivities.length === 0 && urgentFollowUps.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-500">{t.common.noResults}</div>
              )}
            </div>

            {/* Footer */}
            {unreadNotifCount > 0 && (
              <div className="px-4 py-2 border-t border-white/6 text-center">
                <button
                  onClick={() => { useNotificationsStore.getState().markAllAsRead() }}
                  className="text-xs text-slate-400 hover:text-white font-medium"
                >
                  ✓
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showNotifs && (
        <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
      )}

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setShowUserMenu((v) => !v)}
          className="flex items-center gap-2.5 pl-4 border-l border-white/8 hover:bg-white/4 -ml-2 px-3 py-1.5 rounded-xl transition-colors focus:outline-none"
        >
          <Avatar name={currentUser?.name || ''} size="sm" />
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-200">{currentUser?.name || ''}</p>
            <p className="text-[10px] text-slate-500">{currentUser ? t.team.roleLabels[currentUser.role] : ''}</p>
          </div>
          <ChevronDown size={12} className="text-slate-500 hidden sm:block" />
        </button>

        {showUserMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
            <div className="absolute right-0 top-full mt-2 w-56 border border-white/10 rounded-xl shadow-float z-50 py-1 animate-scale-in" style={{ background: '#0d0f1e' }}>
              <div className="px-3 py-2 border-b border-white/6">
                <p className="text-xs font-semibold text-white">{currentUser?.name}</p>
                <p className="text-[10px] text-slate-500">{currentUser?.email}</p>
              </div>
              <button
                onClick={() => { setShowUserMenu(false); navigate('/profile') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/6 transition-colors"
              >
                <User size={13} /> {t.auth.profile}
              </button>
              <div className="border-t border-white/6 my-1" />
              <button
                onClick={() => { void useAuthStore.getState().logout().then(() => navigate('/login')) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={13} /> {t.auth.logout}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
