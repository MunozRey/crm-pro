import { useState, useEffect, useCallback, useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2, KanbanSquare,
  Activity, BarChart3, Settings, ChevronLeft, ChevronRight,
  Zap, Mail, Sparkles, UserCheck, FileText, ScrollText, Target, UsersRound, BellRing, GanttChart,
  LineChart, ListOrdered, Workflow, Package, FunnelPlus,
  Bookmark, Flame, Handshake, Cloud, TrendingUp, CalendarDays,
} from 'lucide-react'
import { useViewsStore } from '../../store/viewsStore'
import { useActivitiesStore } from '../../store/activitiesStore'
import { useEmailStore } from '../../store/emailStore'
import { useCompaniesStore } from '../../store/companiesStore'
import { useContactsStore } from '../../store/contactsStore'
import { useAuthStore } from '../../store/authStore'
import { useNotificationsStore } from '../../store/notificationsStore'
import { useSettingsStore } from '../../store/settingsStore'
import { getFollowUpReminders } from '../../utils/followUpEngine'
import { canAccessRoute } from '../../utils/permissions'
import { useTranslations } from '../../i18n'
import type { Translations } from '../../i18n'
import type { UserRole } from '../../types/auth'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  badge?: number
  dot?: boolean
}

function buildMainItems(t: Translations): NavItem[] {
  return [
    { to: '/', icon: <LayoutDashboard size={17} />, label: t.nav.dashboard },
    { to: '/leads', icon: <FunnelPlus size={17} />, label: t.nav.leads },
    { to: '/contacts', icon: <Users size={17} />, label: t.nav.contacts },
    { to: '/companies', icon: <Building2 size={17} />, label: t.nav.companies },
    { to: '/deals', icon: <KanbanSquare size={17} />, label: t.nav.deals },
    { to: '/timeline', icon: <GanttChart size={17} />, label: t.nav.timeline },
  ]
}

function buildSalesItems(t: Translations): NavItem[] {
  return [
    { to: '/calendar', icon: <CalendarDays size={17} />, label: t.nav.calendar },
    { to: '/activities', icon: <Activity size={17} />, label: t.nav.activities },
    { to: '/follow-ups', icon: <UserCheck size={17} />, label: t.nav.followUps },
    { to: '/goals', icon: <Target size={17} />, label: t.nav.goals },
    { to: '/notifications', icon: <BellRing size={17} />, label: t.nav.notifications },
    { to: '/inbox', icon: <Mail size={17} />, label: t.nav.inbox },
    { to: '/reports', icon: <BarChart3 size={17} />, label: t.nav.reports },
    { to: '/forecast', icon: <LineChart size={17} />, label: t.nav.forecast },
  ]
}

function buildCommsItems(t: Translations): NavItem[] {
  return [
    { to: '/templates', icon: <FileText size={17} />, label: t.nav.templates },
    { to: '/sequences', icon: <ListOrdered size={17} />, label: t.nav.sequences },
  ]
}

function buildConfigItems(t: Translations): NavItem[] {
  return [
    { to: '/team', icon: <UsersRound size={17} />, label: t.nav.team },
    { to: '/products', icon: <Package size={17} />, label: t.nav.products },
    { to: '/automations', icon: <Workflow size={17} />, label: t.nav.automations },
    { to: '/settings', icon: <Settings size={17} />, label: t.nav.settings },
    { to: '/audit', icon: <ScrollText size={17} />, label: t.nav.audit },
  ]
}

interface SidebarNavItemProps {
  item: NavItem
  collapsed: boolean
}

function SidebarNavItem({ item, collapsed }: SidebarNavItemProps) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => `
        flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium
        transition-all duration-150 group relative
        ${isActive
          ? 'nav-active sidebar-active text-white'
          : 'sidebar-inactive text-slate-500 hover:text-slate-100 hover:bg-white/5 border-l-2 border-transparent'
        }
        ${collapsed ? 'justify-center' : ''}
      `}
    >
      <span className="flex-shrink-0">{item.icon}</span>
      {!collapsed && <span className="truncate flex-1">{item.label}</span>}
      {!collapsed && item.badge != null && item.badge > 0 && (
        <span className="ml-auto text-[10px] font-bold bg-red-500/20 text-red-400 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
      {!collapsed && item.dot && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
      )}
      {collapsed && item.badge != null && item.badge > 0 && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500" />
      )}
      {collapsed && item.dot && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
      )}
    </NavLink>
  )
}

interface SidebarSectionProps {
  label: string
  items: NavItem[]
  collapsed: boolean
}

function SidebarSection({ label, items, collapsed }: SidebarSectionProps) {
  return (
    <div className="space-y-0.5">
      {!collapsed && (
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
          {label}
        </p>
      )}
      {items.map((item) => (
        <SidebarNavItem key={item.to} item={item} collapsed={collapsed} />
      ))}
    </div>
  )
}

/**
 * Uses manual store subscriptions via useState + useEffect to avoid
 * Zustand v5 persist + React StrictMode getSnapshot caching errors.
 */
export function Sidebar() {
  const t = useTranslations()
  const [collapsed, setCollapsed] = useState(false)
  const [userRole, setUserRole] = useState<UserRole>('viewer')
  const [branding, setBranding] = useState(useSettingsStore.getState().settings.branding)

  const [overdueCount, setOverdueCount] = useState(0)
  const [isGmailConnected, setGmailConnected] = useState(false)
  const [urgentFollowUpCount, setUrgentFollowUpCount] = useState(0)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [pinnedViewItems, setPinnedViewItems] = useState<NavItem[]>([])

  // Auth subscription
  useEffect(() => {
    setUserRole(useAuthStore.getState().currentUser?.role || 'viewer')
    const unsub = useAuthStore.subscribe((s) => setUserRole(s.currentUser?.role || 'viewer'))
    return unsub
  }, [])

  useEffect(() => {
    const unsub = useSettingsStore.subscribe((s) => setBranding(s.settings.branding))
    return unsub
  }, [])

  // Pinned views subscription — re-runs when language (t) changes
  useEffect(() => {
    const VIEW_ICON_MAP: Record<string, React.ReactNode> = {
      flame: <Flame size={17} />,
      users: <Users size={17} />,
      handshake: <Handshake size={17} />,
      'trending-up': <TrendingUp size={17} />,
      cloud: <Cloud size={17} />,
    }
    const compute = () => {
      const pinnedViews = useViewsStore.getState().views.filter((v) => v.isPinned)
      const items: NavItem[] = pinnedViews.map((v) => ({
        to: `/${v.entityType === 'contact' ? 'contacts' : v.entityType === 'company' ? 'companies' : 'deals'}?view=${v.id}`,
        icon: VIEW_ICON_MAP[v.icon ?? ''] ?? <Bookmark size={17} />,
        label: (() => {
          const key = v.nameKey ?? (v.id.startsWith('sv-') ? v.id.replace('sv-', 'sv').replace('-', '') : null)
          return key ? (t.views as Record<string, string>)[key] ?? v.name : v.name
        })(),
      }))
      setPinnedViewItems(items)
    }
    compute()
    return useViewsStore.subscribe(compute)
  }, [t])

  const filterByPermission = useCallback((items: NavItem[]) => {
    return items.filter((item) => canAccessRoute(userRole, item.to))
  }, [userRole])

  const computeBadges = useCallback(() => {
    const activities = useActivitiesStore.getState().activities
    const contacts = useContactsStore.getState().contacts
    const companies = useCompaniesStore.getState().companies
    const now = new Date().toISOString()

    setOverdueCount(
      activities.filter((a) => a.status === 'pending' && a.dueDate && a.dueDate < now).length
    )
    setGmailConnected(useEmailStore.getState().isGmailConnected())

    const reminders = getFollowUpReminders(contacts, activities, companies)
    setUrgentFollowUpCount(
      reminders.filter((r) => r.urgency === 'critical' || r.urgency === 'high').length
    )
  }, [])

  const computeNotifBadge = useCallback(() => {
    setUnreadNotifCount(useNotificationsStore.getState().getUnreadCount())
  }, [])

  useEffect(() => {
    computeBadges()
    computeNotifBadge()
    const unsub1 = useActivitiesStore.subscribe(computeBadges)
    const unsub2 = useContactsStore.subscribe(computeBadges)
    const unsub3 = useCompaniesStore.subscribe(computeBadges)
    const unsub4 = useEmailStore.subscribe(computeBadges)
    const unsub5 = useNotificationsStore.subscribe(computeNotifBadge)
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5() }
  }, [computeBadges, computeNotifBadge])

  const mainItems = useMemo(() => buildMainItems(t), [t])
  const salesItems = useMemo(() => buildSalesItems(t), [t])
  const commsItems = useMemo(() => buildCommsItems(t), [t])
  const configItems = useMemo(() => buildConfigItems(t), [t])

  const salesWithBadges = salesItems.map((item) => {
    if (item.to === '/activities') return { ...item, badge: overdueCount }
    if (item.to === '/follow-ups') return { ...item, badge: urgentFollowUpCount }
    if (item.to === '/notifications') return { ...item, badge: unreadNotifCount }
    if (item.to === '/inbox') return { ...item, dot: isGmailConnected }
    return item
  })

  return (
    <aside
      className={`
        app-sidebar flex flex-col h-screen bg-navy-900 border-r border-white/6
        transition-all duration-200 ease-out flex-shrink-0
        ${collapsed ? 'w-[60px]' : 'w-[220px]'}
      `}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 border-b border-white/6 flex-shrink-0 ${collapsed ? 'justify-center px-3' : 'px-4 gap-3'}`}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-brand-sm overflow-hidden" style={{ backgroundColor: branding.primaryColor }}>
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.appName} className="w-full h-full object-cover" />
          ) : (
            <Zap size={15} className="text-white" />
          )}
        </div>
        {!collapsed && (
          <div>
            <span className="text-sm font-bold text-white tracking-tight">{branding.appName}</span>
            <p className="text-[10px] text-slate-500 font-medium">{branding.customDomain || t.navSections.sales}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
        <SidebarSection label={t.navSections.main} items={filterByPermission(mainItems)} collapsed={collapsed} />
        <SidebarSection label={t.navSections.sales} items={filterByPermission(salesWithBadges)} collapsed={collapsed} />
        <SidebarSection label={t.navSections.comms} items={filterByPermission(commsItems)} collapsed={collapsed} />
        <SidebarSection label={t.navSections.config} items={filterByPermission(configItems)} collapsed={collapsed} />
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-white/6 p-2 flex-shrink-0">
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? t.nav.expandSidebar : t.nav.collapseSidebar}
          className={`
            w-full flex items-center gap-2 px-2 py-2 rounded-xl text-slate-600
            hover:text-slate-300 hover:bg-white/5 transition-all duration-150 text-xs font-medium
            ${collapsed ? 'justify-center' : ''}
          `}
        >
          {collapsed ? <ChevronRight size={15} /> : (
            <>
              <ChevronLeft size={15} />
              <span>{t.nav.collapse}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
