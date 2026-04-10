import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, TrendingUp, DollarSign, Trophy, Plus, Activity, Briefcase, Zap, Target, BarChart3, Clock, Bell } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useContactsStore } from '../store/contactsStore'
import { useDealsStore } from '../store/dealsStore'
import { useActivitiesStore } from '../store/activitiesStore'
import { useCompaniesStore } from '../store/companiesStore'
import { StatCard } from '../components/ui/StatCard'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import AnimatedCounter from '../components/ui/AnimatedCounter'
import { formatCurrency, formatRelativeDate, formatDate } from '../utils/formatters'
import { DEAL_STAGE_COLORS } from '../utils/constants'
import { useAuthStore } from '../store/authStore'
import { useNotificationsStore } from '../store/notificationsStore'
import { PermissionGate } from '../components/auth/PermissionGate'
import type { DealStage, CRMNotification } from '../types'
import { subMonths, subWeeks, format, startOfMonth, endOfMonth, parseISO, isWithinInterval, differenceInDays, getDay, startOfWeek, endOfWeek, isAfter, isBefore } from 'date-fns'
import { es, enUS, ptBR, fr, de, it } from 'date-fns/locale'
import { useTranslations, useI18nStore } from '../i18n'
import { trackUxAction } from '../lib/uxMetrics'

const STAGE_BADGE_MAP: Record<DealStage, 'blue' | 'yellow' | 'purple' | 'orange' | 'emerald' | 'rose'> = {
  lead: 'blue',
  qualified: 'yellow',
  proposal: 'purple',
  negotiation: 'orange',
  closed_won: 'emerald',
  closed_lost: 'rose',
}

const MONTHLY_QUOTA = 50000

const TOOLTIP_STYLE = {
  backgroundColor: '#0d1025',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  color: '#e2e8f0',
}

export function Dashboard() {
  const navigate = useNavigate()
  const t = useTranslations()
  const language = useI18nStore((s) => s.language)
  const dateLocaleByLanguage = { en: enUS, es, pt: ptBR, fr, de, it } as const
  const dateLocale = dateLocaleByLanguage[language]
  const DAY_LABELS = t.dashboard.dayLabels
  const contacts = useContactsStore((s) => s.contacts)
  const deals = useDealsStore((s) => s.deals)
  const activities = useActivitiesStore((s) => s.activities)
  const companies = useCompaniesStore((s) => s.companies)

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date()
    const monthStart = startOfMonth(now).toISOString()
    const openDeals = deals.filter((d) => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    const pipelineValue = openDeals.reduce((sum, d) => sum + d.value, 0)
    const wonThisMonth = deals
      .filter((d) => d.stage === 'closed_won' && d.updatedAt >= monthStart)
      .reduce((sum, d) => sum + d.value, 0)
    return { totalContacts: contacts.length, openDeals: openDeals.length, pipelineValue, wonThisMonth }
  }, [contacts, deals])

  // ── Revenue by month (last 6) ─────────────────────────────────────────────
  const revenueData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(now, 5 - i)
      const start = startOfMonth(month)
      const end = endOfMonth(month)
      const value = deals
        .filter((d) => {
          if (d.stage !== 'closed_won') return false
          try {
            return isWithinInterval(parseISO(d.updatedAt), { start, end })
          } catch { return false }
        })
        .reduce((sum, d) => sum + d.value, 0)
      return {
        month: format(month, 'MMM', { locale: dateLocale }),
        value,
      }
    })
  }, [deals, dateLocale])


  // ── Recent activities (last 8) ───────────────────────────────────────────
  const recentActivities = useMemo(() => {
    return [...activities]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8)
  }, [activities])

  // ── Top deals by value ────────────────────────────────────────────────────
  const topDeals = useMemo(() => {
    return [...deals]
      .filter((d) => d.stage !== 'closed_lost')
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [deals])

  // ── Sales Velocity ────────────────────────────────────────────────────────
  const salesVelocity = useMemo(() => {
    const closedWon = deals.filter((d) => d.stage === 'closed_won')
    if (closedWon.length === 0) return 0
    const totalDays = closedWon.reduce((sum, d) => {
      const created = parseISO(d.createdAt)
      const closed = parseISO(d.updatedAt)
      return sum + Math.max(differenceInDays(closed, created), 1)
    }, 0)
    return Math.round(totalDays / closedWon.length)
  }, [deals])

  // ── Conversion Rate ───────────────────────────────────────────────────────
  const conversionRate = useMemo(() => {
    const won = deals.filter((d) => d.stage === 'closed_won').length
    const lost = deals.filter((d) => d.stage === 'closed_lost').length
    const total = won + lost
    if (total === 0) return 0
    return Math.round((won / total) * 100)
  }, [deals])

  // ── Monthly Quota Progress ────────────────────────────────────────────────
  const quotaProgress = useMemo(() => {
    const percentage = Math.min(Math.round((stats.wonThisMonth / MONTHLY_QUOTA) * 100), 100)
    const remaining = Math.max(MONTHLY_QUOTA - stats.wonThisMonth, 0)
    return { percentage, remaining, current: stats.wonThisMonth }
  }, [stats.wonThisMonth])


  // ── Activity Heatmap (last 4 weeks) ───────────────────────────────────────
  const heatmapData = useMemo(() => {
    const now = new Date()
    const fourWeeksAgo = subWeeks(now, 4)

    // Initialize: 4 weeks x 7 days
    const grid: number[][] = Array.from({ length: 4 }, () => Array.from({ length: 7 }, () => 0))

    activities.forEach((act) => {
      try {
        const date = parseISO(act.createdAt)
        if (isBefore(date, fourWeeksAgo) || isAfter(date, now)) return
        // Find which week (0-3) and day (0=Mon, 6=Sun)
        const diffWeeks = Math.floor(differenceInDays(now, date) / 7)
        const weekIdx = 3 - Math.min(diffWeeks, 3)
        // getDay returns 0=Sun, 1=Mon ... 6=Sat → convert to Mon=0 ... Sun=6
        const rawDay = getDay(date)
        const dayIdx = rawDay === 0 ? 6 : rawDay - 1
        grid[weekIdx][dayIdx] += 1
      } catch { /* skip invalid dates */ }
    })

    // Find max for color scaling
    const maxCount = Math.max(1, ...grid.flat())

    return { grid, maxCount }
  }, [activities])

  // ── Recent Notifications (manual subscription) ──────────────────────────
  const [recentNotifs, setRecentNotifs] = useState<CRMNotification[]>([])
  const computeNotifs = useCallback(() => {
    setRecentNotifs(useNotificationsStore.getState().notifications.slice(0, 5))
  }, [])
  useEffect(() => {
    computeNotifs()
    const unsub = useNotificationsStore.subscribe(computeNotifs)
    return unsub
  }, [computeNotifs])

  const getContact = (id: string) => contacts.find((c) => c.id === id)
  const getCompany = (id: string) => companies.find((c) => c.id === id)

  const getHeatColor = (count: number, maxCount: number): string => {
    if (count === 0) return 'bg-navy-800/40'
    const intensity = count / maxCount
    if (intensity < 0.25) return 'bg-brand-500/20'
    if (intensity < 0.5) return 'bg-brand-500/40'
    if (intensity < 0.75) return 'bg-brand-500/60'
    return 'bg-brand-500/90'
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* ── Row 1: Quick actions ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <PermissionGate permission="contacts:create">
          <Button
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => {
              trackUxAction('quick_create_contact')
              navigate('/contacts?create=1')
            }}
          >
            {t.dashboard.newContact}
          </Button>
        </PermissionGate>
        <PermissionGate permission="deals:create">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Plus size={14} />}
            onClick={() => {
              trackUxAction('quick_create_deal')
              navigate('/deals?create=1')
            }}
          >
            {t.dashboard.newDeal}
          </Button>
        </PermissionGate>
        <PermissionGate permission="activities:create">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Plus size={14} />}
            onClick={() => {
              trackUxAction('quick_create_activity')
              navigate('/activities?create=1')
            }}
          >
            {t.dashboard.newActivity}
          </Button>
        </PermissionGate>
      </div>

      {/* ── Row 2: KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title={t.dashboard.totalContacts}
          value={<AnimatedCounter value={stats.totalContacts} />}
          icon={<Users size={20} />}
          accent="blue"
          subtitle={`${companies.length} ${t.companies.title.toLowerCase()}`}
        />
        <StatCard
          title={t.dashboard.openDeals}
          value={<AnimatedCounter value={stats.openDeals} />}
          icon={<Briefcase size={20} />}
          accent="violet"
        />
        <StatCard
          title={t.dashboard.pipelineValue}
          value={<AnimatedCounter value={stats.pipelineValue} prefix="€" />}
          icon={<TrendingUp size={20} />}
          accent="blue"
        />
        <StatCard
          title={t.dashboard.wonThisMonth}
          value={<AnimatedCounter value={stats.wonThisMonth} prefix="€" />}
          icon={<Trophy size={20} />}
          accent="emerald"
        />
      </div>

      {/* ── Row 3: Revenue Chart + Quota & Velocity ──────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Revenue bar chart */}
        <div className="xl:col-span-2 glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">{t.dashboard.revenueByMonth}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1d35" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: unknown) => [formatCurrency(Number(value)), t.dashboard.closed]}
              />
              <Bar dataKey="value" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Right column: Quota + Velocity + Conversion */}
        <div className="flex flex-col gap-4">
          {/* Monthly Quota Progress */}
          <div className="glass rounded-2xl p-5 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Target size={16} className="text-brand-400" />
              <h2 className="text-sm font-semibold text-slate-300">{t.dashboard.monthlyQuota}</h2>
            </div>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-2xl font-bold text-white">
                  <AnimatedCounter value={quotaProgress.percentage} suffix="%" />
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {formatCurrency(quotaProgress.current)} / {formatCurrency(MONTHLY_QUOTA)}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                {t.dashboard.remaining} {formatCurrency(quotaProgress.remaining)}
              </p>
            </div>
            <div className="w-full h-3 bg-navy-800/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${quotaProgress.percentage}%`,
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
                }}
              />
            </div>
          </div>

          {/* Sales Velocity */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-300">{t.dashboard.salesVelocity}</h2>
            </div>
            <p className="text-2xl font-bold text-white">
              <AnimatedCounter value={salesVelocity} suffix={` ${t.dashboard.days}`} />
            </p>
            <p className="text-xs text-slate-500 mt-1">{t.dashboard.avgCloseTime}</p>
          </div>

          {/* Conversion Rate */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 size={16} className="text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-300">{t.dashboard.conversionRate}</h2>
            </div>
            <p className="text-2xl font-bold text-white">
              <AnimatedCounter value={conversionRate} suffix="%" />
            </p>
            <p className="text-xs text-slate-500 mt-1">{t.reports.conversionRate}</p>
          </div>
        </div>
      </div>


      {/* ── Row 5: Recent Activities + Top Deals ─────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent activities */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">{t.dashboard.recentActivities}</h2>
            <button
              onClick={() => navigate('/activities')}
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              {t.dashboard.viewAll}
            </button>
          </div>
          <div className="space-y-3">
            {recentActivities.map((activity) => {
              const contact = activity.contactId ? getContact(activity.contactId) : undefined
              return (
                <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-white/6 last:border-0 last:pb-0">
                  <div className="w-8 h-8 rounded-lg bg-navy-800/60 flex items-center justify-center flex-shrink-0">
                    <Activity size={13} className="text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{activity.subject}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t.activities.typeLabels[activity.type]}
                      {contact ? ` · ${contact.firstName} ${contact.lastName}` : ''}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-600 flex-shrink-0">
                    {formatRelativeDate(activity.createdAt)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top deals */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">{t.dashboard.topDeals}</h2>
            <button
              onClick={() => navigate('/deals')}
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              {t.dashboard.viewPipeline}
            </button>
          </div>
          <div className="space-y-3">
            {topDeals.map((deal) => {
              const contact = getContact(deal.contactId)
              const company = getCompany(deal.companyId)
              return (
                <div
                  key={deal.id}
                  className="flex items-center gap-3 pb-3 border-b border-white/6 last:border-0 last:pb-0 cursor-pointer hover:bg-white/[0.03] -mx-2 px-2 rounded-lg transition-colors"
                  onClick={() => navigate(`/deals?deal=${deal.id}`)}
                >
                  {contact && <Avatar name={`${contact.firstName} ${contact.lastName}`} size="xs" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{deal.title}</p>
                    <p className="text-xs text-slate-500 truncate">{company?.name ?? '—'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-semibold text-emerald-400">
                      {formatCurrency(deal.value, deal.currency)}
                    </span>
                    <Badge variant={STAGE_BADGE_MAP[deal.stage]}>
                      {t.deals.stageLabels[deal.stage]}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Row 6: Notifications Feed ────────────────────────────────────── */}
      {recentNotifs.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-brand-400" />
              <h2 className="text-sm font-semibold text-slate-300">{t.dashboard.latestNotifications}</h2>
            </div>
            <button
              onClick={() => navigate('/notifications')}
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              {t.dashboard.viewNotifications}
            </button>
          </div>
          <div className="space-y-2">
            {recentNotifs.map((n) => (
              <div
                key={n.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  n.isRead ? 'opacity-50 hover:opacity-70' : 'bg-white/[0.02] hover:bg-white/[0.05]'
                }`}
                onClick={() => {
                  useNotificationsStore.getState().markAsRead(n.id)
                  if (n.entityType === 'deal') navigate('/deals')
                  else if (n.entityType === 'contact' && n.entityId) navigate(`/contacts/${n.entityId}`)
                  else navigate('/notifications')
                }}
              >
                {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{n.title}</p>
                  <p className="text-[10px] text-slate-500 truncate">{n.message}</p>
                </div>
                <span className="text-[10px] text-slate-600 flex-shrink-0">
                  {formatRelativeDate(n.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 7: Activity Heatmap ──────────────────────────────────────── */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-brand-400" />
          <h2 className="text-sm font-semibold text-slate-300">{t.dashboard.activityHeatmap}</h2>
        </div>
        <div className="space-y-2">
          {/* Day labels */}
          <div className="grid grid-cols-7 gap-2">
            {DAY_LABELS.map((day) => (
              <div key={day} className="text-center text-[10px] text-slate-500 font-medium">
                {day}
              </div>
            ))}
          </div>
          {/* Heatmap grid */}
          {heatmapData.grid.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 gap-2">
              {week.map((count, dayIdx) => (
                <div
                  key={`${weekIdx}-${dayIdx}`}
                  className={`h-8 rounded-lg ${getHeatColor(count, heatmapData.maxCount)} flex items-center justify-center transition-colors`}
                  title={`${count} ${t.activities.title.toLowerCase()}`}
                >
                  {count > 0 && (
                    <span className="text-[10px] font-medium text-white/70">{count}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
          {/* Legend */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <span className="text-[10px] text-slate-500">{t.dashboard.heatmapLess}</span>
            <div className="w-4 h-4 rounded bg-navy-800/40" />
            <div className="w-4 h-4 rounded bg-brand-500/20" />
            <div className="w-4 h-4 rounded bg-brand-500/40" />
            <div className="w-4 h-4 rounded bg-brand-500/60" />
            <div className="w-4 h-4 rounded bg-brand-500/90" />
            <span className="text-[10px] text-slate-500">{t.dashboard.heatmapMore}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
