import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, Check, CheckCheck, Trash2, Filter, X,
  Trophy, XCircle, ArrowRightLeft, Clock, UserPlus,
  Target, AlertTriangle, MessageSquare, Settings, BellOff,
} from 'lucide-react'
import { useNotificationsStore } from '../store/notificationsStore'
import { Button } from '../components/ui/Button'
import { formatRelativeDate } from '../utils/formatters'
import type { CRMNotification, NotificationType } from '../types'
import { useTranslations } from '../i18n'

type FilterType = 'all' | 'unread' | NotificationType

// ─── Component ───────────────────────────────────────────────────────────────

export function Notifications() {
  const t = useTranslations()
  const navigate = useNavigate()

  // Config built inside the component so labels are reactive to language changes
  const NOTIFICATION_CONFIG: Record<NotificationType, {
    icon: React.ReactNode
    color: string
    bgColor: string
    label: string
  }> = {
    deal_won: {
      icon: <Trophy size={16} />,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/15',
      label: t.settings.notifTypeLabels.deal_won,
    },
    deal_lost: {
      icon: <XCircle size={16} />,
      color: 'text-red-400',
      bgColor: 'bg-red-500/15',
      label: t.settings.notifTypeLabels.deal_lost,
    },
    deal_stage_changed: {
      icon: <ArrowRightLeft size={16} />,
      color: 'text-brand-400',
      bgColor: 'bg-brand-500/15',
      label: t.settings.notifTypeLabels.deal_stage_changed,
    },
    activity_overdue: {
      icon: <Clock size={16} />,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/15',
      label: t.settings.notifTypeLabels.activity_overdue,
    },
    activity_assigned: {
      icon: <UserPlus size={16} />,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/15',
      label: t.settings.notifTypeLabels.activity_assigned,
    },
    follow_up_due: {
      icon: <Clock size={16} />,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/15',
      label: t.settings.notifTypeLabels.follow_up_due,
    },
    contact_assigned: {
      icon: <UserPlus size={16} />,
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/15',
      label: t.settings.notifTypeLabels.contact_assigned,
    },
    goal_achieved: {
      icon: <Target size={16} />,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/15',
      label: t.settings.notifTypeLabels.goal_achieved,
    },
    goal_at_risk: {
      icon: <AlertTriangle size={16} />,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/15',
      label: t.settings.notifTypeLabels.goal_at_risk,
    },
    mention: {
      icon: <MessageSquare size={16} />,
      color: 'text-brand-400',
      bgColor: 'bg-brand-500/15',
      label: t.settings.notifTypeLabels.mention,
    },
    system: {
      icon: <Settings size={16} />,
      color: 'text-slate-400',
      bgColor: 'bg-white/8',
      label: t.settings.notifTypeLabels.system,
    },
  }

  // Manual subscription to avoid getSnapshot issue
  const [notifications, setNotifications] = useState<CRMNotification[]>([])
  const [filter, setFilter] = useState<FilterType>('all')

  const compute = useCallback(() => {
    setNotifications(useNotificationsStore.getState().notifications)
  }, [])

  useEffect(() => {
    compute()
    const unsub = useNotificationsStore.subscribe(compute)
    return unsub
  }, [compute])

  const markAsRead = useNotificationsStore.getState().markAsRead
  const markAllAsRead = useNotificationsStore.getState().markAllAsRead
  const deleteNotification = useNotificationsStore.getState().deleteNotification
  const clearAll = useNotificationsStore.getState().clearAll

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications
    if (filter === 'unread') return notifications.filter((n) => !n.isRead)
    return notifications.filter((n) => n.type === filter)
  }, [notifications, filter])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications])

  const typeGroups = useMemo(() => {
    const groups: Partial<Record<NotificationType, number>> = {}
    for (const n of notifications) {
      groups[n.type] = (groups[n.type] || 0) + 1
    }
    return groups
  }, [notifications])

  const handleClick = (notification: CRMNotification) => {
    if (!notification.isRead) markAsRead(notification.id)
    if (notification.entityType && notification.entityId) {
      const path = notification.entityType === 'contact' ? `/contacts/${notification.entityId}`
        : notification.entityType === 'lead' ? `/leads/${notification.entityId}`
        : notification.entityType === 'deal' ? `/deals`
        : notification.entityType === 'company' ? `/companies/${notification.entityId}`
        : notification.entityType === 'activity' ? `/activities`
        : notification.entityType === 'goal' ? `/goals`
        : null
      if (path) navigate(path)
    }
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const todayNotifs = filtered.filter((n) => n.createdAt.startsWith(todayStr))
  const olderNotifs = filtered.filter((n) => !n.createdAt.startsWith(todayStr))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell size={22} className="text-brand-400" />
            {t.nav.notifications}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} ${t.common.selected}` : t.common.ok} · {notifications.length} {t.common.total}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" leftIcon={<CheckCheck size={14} />} onClick={markAllAsRead}>
              {t.common.selectAll}
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" leftIcon={<Trash2 size={14} />} onClick={clearAll} className="text-red-400 hover:text-red-300">
              {t.common.bulkDelete}
            </Button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-3">
        <button
          onClick={() => setFilter('all')}
          className={`glass rounded-xl p-3 text-left transition-all ${filter === 'all' ? 'ring-1 ring-brand-500/50 bg-brand-500/5' : 'hover:bg-white/4'}`}
        >
          <p className="text-2xl font-bold text-white">{notifications.length}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{t.common.total}</p>
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`glass rounded-xl p-3 text-left transition-all ${filter === 'unread' ? 'ring-1 ring-brand-500/50 bg-brand-500/5' : 'hover:bg-white/4'}`}
        >
          <p className="text-2xl font-bold text-brand-400">{unreadCount}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{t.common.selected}</p>
        </button>
        <button
          onClick={() => setFilter('deal_won')}
          className={`glass rounded-xl p-3 text-left transition-all ${filter === 'deal_won' ? 'ring-1 ring-emerald-500/50 bg-emerald-500/5' : 'hover:bg-white/4'}`}
        >
          <p className="text-2xl font-bold text-emerald-400">{typeGroups.deal_won || 0}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{t.deals.won}</p>
        </button>
        <button
          onClick={() => setFilter('activity_overdue')}
          className={`glass rounded-xl p-3 text-left transition-all ${filter === 'activity_overdue' ? 'ring-1 ring-amber-500/50 bg-amber-500/5' : 'hover:bg-white/4'}`}
        >
          <p className="text-2xl font-bold text-amber-400">{typeGroups.activity_overdue || 0}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{t.activities.overdue}</p>
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-slate-500" />
        {(['all', 'unread', 'deal_won', 'deal_lost', 'deal_stage_changed', 'activity_overdue', 'follow_up_due', 'goal_achieved', 'system'] as FilterType[]).map((f) => {
          const cfg = f !== 'all' && f !== 'unread' ? NOTIFICATION_CONFIG[f as NotificationType] : null
          const label = f === 'all' ? t.common.all : f === 'unread' ? t.common.selected : cfg?.label || f
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                filter === f
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/8 hover:bg-white/8 hover:text-white'
              }`}
            >
              {label}
            </button>
          )
        })}
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')} className="text-xs text-slate-500 hover:text-white ml-1 flex items-center gap-1">
            <X size={12} /> {t.common.clear}
          </button>
        )}
      </div>

      {/* Notification list */}
      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <BellOff size={40} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">
            {t.common.noResults}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {t.common.filters}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Today */}
          {todayNotifs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">{t.calendar.today}</p>
              <div className="glass rounded-2xl overflow-hidden divide-y divide-white/4">
                {todayNotifs.map((n) => (
                  <NotificationRow key={n.id} notification={n} config={NOTIFICATION_CONFIG} onClick={() => handleClick(n)} onDelete={deleteNotification} onMarkRead={markAsRead} markReadTitle={t.common.confirm} deleteTitle={t.common.delete} />
                ))}
              </div>
            </div>
          )}

          {/* Older */}
          {olderNotifs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">{t.reports.lastMonth}</p>
              <div className="glass rounded-2xl overflow-hidden divide-y divide-white/4">
                {olderNotifs.map((n) => (
                  <NotificationRow key={n.id} notification={n} config={NOTIFICATION_CONFIG} onClick={() => handleClick(n)} onDelete={deleteNotification} onMarkRead={markAsRead} markReadTitle={t.common.confirm} deleteTitle={t.common.delete} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Notification Row ────────────────────────────────────────────────────────

function NotificationRow({
  notification,
  config,
  onClick,
  onDelete,
  onMarkRead,
  markReadTitle,
  deleteTitle,
}: {
  notification: CRMNotification
  config: Record<NotificationType, { icon: React.ReactNode; color: string; bgColor: string; label: string }>
  onClick: () => void
  onDelete: (id: string) => void
  onMarkRead: (id: string) => void
  markReadTitle: string
  deleteTitle: string
}) {
  const cfg = config[notification.type]

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors group ${
        notification.isRead ? 'opacity-60 hover:opacity-80' : 'hover:bg-white/4'
      }`}
      onClick={onClick}
    >
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl ${cfg.bgColor} flex items-center justify-center flex-shrink-0 ${cfg.color} mt-0.5`}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${notification.isRead ? 'text-slate-400' : 'text-white'}`}>
            {notification.title}
          </p>
          {!notification.isRead && (
            <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">{notification.message}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.color}`}>
            {cfg.label}
          </span>
          <span className="text-[10px] text-slate-600">
            {formatRelativeDate(notification.createdAt)}
          </span>
          {notification.triggeredBy && (
            <span className="text-[10px] text-slate-600">
              {notification.triggeredBy}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {!notification.isRead && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id) }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors"
            title={markReadTitle}
          >
            <Check size={13} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(notification.id) }}
          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title={deleteTitle}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
