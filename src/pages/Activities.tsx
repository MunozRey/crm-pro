import { useState, useMemo } from 'react'
import { Plus, Activity as ActivityIcon, Filter, X, Clock, Calendar, LayoutList, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
  format, isToday,
} from 'date-fns'
import type { Locale } from 'date-fns'
import { es, enUS, ptBR, fr, de, it } from 'date-fns/locale'
import { useTranslations, useI18nStore } from '../i18n'
import { useActivitiesStore } from '../store/activitiesStore'
import { useContactsStore } from '../store/contactsStore'
import { useDealsStore } from '../store/dealsStore'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui/Button'
import { SearchBar } from '../components/shared/SearchBar'
import { SlideOver } from '../components/ui/Modal'
import { ActivityForm } from '../components/activities/ActivityForm'
import { ActivityItem } from '../components/activities/ActivityItem'
import { EmptyState } from '../components/shared/EmptyState'
import { Select } from '../components/ui/Select'
import { toast } from '../store/toastStore'
import type { Activity, ActivityType } from '../types'
import { PermissionGate } from '../components/auth/PermissionGate'
import { hasPermission } from '../utils/permissions'

type ViewMode = 'list' | 'calendar'

const activityColorMap: Record<ActivityType, string> = {
  call: 'bg-blue-500/20 text-blue-300',
  email: 'bg-violet-500/20 text-violet-300',
  meeting: 'bg-emerald-500/20 text-emerald-300',
  task: 'bg-amber-500/20 text-amber-300',
  note: 'bg-slate-500/20 text-slate-300',
  linkedin: 'bg-blue-400/20 text-blue-200',
}

function CalendarView({
  activities,
  onDaySelect,
  dayHeaders,
  dateLocale,
  noActivitiesLabel,
}: {
  activities: Activity[]
  onDaySelect: (date: Date) => void
  dayHeaders: string[]
  dateLocale: Locale
  noActivitiesLabel: string
}) {
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const days = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth)
    const monthEnd = endOfMonth(calendarMonth)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const result: Date[] = []
    let current = gridStart
    while (current <= gridEnd) {
      result.push(current)
      current = addDays(current, 1)
    }
    return result
  }, [calendarMonth])

  const activitiesByDay = useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const activity of activities) {
      const dateStr = activity.dueDate || activity.createdAt.split('T')[0]
      if (!dateStr) continue
      const key = dateStr.split('T')[0]
      const list = map.get(key) || []
      list.push(activity)
      map.set(key, list)
    }
    return map
  }, [activities])

  const selectedDayActivities = useMemo(() => {
    if (!selectedDay) return []
    const key = format(selectedDay, 'yyyy-MM-dd')
    return activitiesByDay.get(key) || []
  }, [selectedDay, activitiesByDay])

  const handleDayClick = (day: Date) => {
    setSelectedDay(day)
    onDaySelect(day)
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
            title="Previous month"
            aria-label="Previous month"
            className="hover:bg-white/6 rounded-lg p-1.5 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <h3 className="text-sm font-semibold text-white capitalize">
            {format(calendarMonth, 'MMMM yyyy', { locale: dateLocale })}
          </h3>
          <button
            onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
            title="Next month"
            aria-label="Next month"
            className="hover:bg-white/6 rounded-lg p-1.5 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayHeaders.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-slate-500 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayActivities = activitiesByDay.get(key) || []
            const sameMonth = isSameMonth(day, calendarMonth)
            const today = isToday(day)
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false

            return (
              <button
                key={key}
                onClick={() => handleDayClick(day)}
                className={`
                  min-h-[80px] border rounded-lg p-1 text-left transition-colors flex flex-col
                  ${today ? 'border-brand-500/50 bg-brand-500/5' : 'border-white/4'}
                  ${isSelected ? 'ring-1 ring-brand-500/70 bg-brand-500/10' : ''}
                  ${!sameMonth ? 'opacity-30' : ''}
                  hover:bg-white/4
                `}
              >
                <span className={`text-[11px] font-medium ${today ? 'text-brand-400' : 'text-slate-400'}`}>
                  {format(day, 'd')}
                </span>
                <div className="flex flex-col gap-0.5 mt-0.5 overflow-hidden flex-1">
                  {dayActivities.slice(0, 3).map((act) => (
                    <span
                      key={act.id}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full truncate ${activityColorMap[act.type]}`}
                    >
                      {act.subject}
                    </span>
                  ))}
                  {dayActivities.length > 3 && (
                    <span className="text-[10px] text-slate-500 px-1">
                      +{dayActivities.length - 3}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="glass rounded-2xl p-4">
          <h4 className="text-sm font-semibold text-white mb-3 capitalize">
            {format(selectedDay, 'PPPP', { locale: dateLocale })}
          </h4>
          {selectedDayActivities.length === 0 ? (
            <p className="text-xs text-slate-500">{noActivitiesLabel}</p>
          ) : (
            <div className="space-y-1">
              {selectedDayActivities.map((activity) => (
                <div
                  key={activity.id}
                  className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${activityColorMap[activity.type]}`}
                >
                  <span className="font-medium truncate">{activity.subject}</span>
                  <span className="text-[10px] opacity-70 ml-auto whitespace-nowrap">
                    {activity.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Activities() {
  const t = useTranslations()
  const language = useI18nStore((s) => s.language)
  const dateLocaleByLanguage = { en: enUS, es, pt: ptBR, fr, de, it } as const
  const dateLocale = dateLocaleByLanguage[language]

  const { activities, addActivity, updateActivity, deleteActivity, completeActivity } = useActivitiesStore()
  const contacts = useContactsStore((s) => s.contacts)
  const deals = useDealsStore((s) => s.deals)
  const currentUser = useAuthStore((s) => s.currentUser)
  const canUpdateActivities = !!currentUser && hasPermission(currentUser.role, 'activities:update')
  const canDeleteActivities = !!currentUser && hasPermission(currentUser.role, 'activities:delete')

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editActivity, setEditActivity] = useState<Activity | undefined>()
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const filtered = useMemo(() => {
    return [...activities]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((a) => {
        const q = search.toLowerCase()
        if (q && !a.subject.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false
        if (typeFilter && a.type !== typeFilter) return false
        if (statusFilter && a.status !== statusFilter) return false
        return true
      })
  }, [activities, search, typeFilter, statusFilter])

  const overdue = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return activities.filter((a) => a.status === 'pending' && a.dueDate && a.dueDate < today)
  }, [activities])

  const pending = useMemo(() => activities.filter((a) => a.status === 'pending'), [activities])

  const hasFilters = typeFilter || statusFilter

  const handleCreate = (data: Omit<Activity, 'id' | 'createdAt'>) => {
    addActivity(data)
    setIsFormOpen(false)
    toast.success(t.activities.newActivity)
  }

  const handleEdit = (data: Omit<Activity, 'id' | 'createdAt'>) => {
    if (!editActivity) return
    updateActivity(editActivity.id, data)
    setEditActivity(undefined)
    toast.success(t.activities.editActivity)
  }

  const handleComplete = (id: string) => {
    completeActivity(id)
    toast.success(t.activities.completed)
  }

  const handleDelete = (id: string) => {
    deleteActivity(id)
    toast.success(t.common.delete)
  }

  const handleDaySelect = (_date: Date) => {
    // Could be extended to filter list view to this day
  }

  return (
    <div className="p-6 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass p-4">
          <p className="text-xs text-slate-500 mb-1">{t.activities.title}</p>
          <p className="text-2xl font-bold text-white">{activities.length}</p>
        </div>
        <div className="glass p-4">
          <p className="text-xs text-slate-500 mb-1">{t.activities.statusLabels.pending}</p>
          <p className="text-2xl font-bold text-yellow-400">{pending.length}</p>
        </div>
        <div className="glass p-4">
          <p className="text-xs text-slate-500 mb-1">{t.activities.overdue}</p>
          <p className="text-2xl font-bold text-red-400">{overdue.length}</p>
        </div>
      </div>

      {/* Overdue section */}
      {overdue.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-red-400" />
            <h3 className="text-sm font-semibold text-red-400">{t.activities.overdue} ({overdue.length})</h3>
          </div>
          <div className="space-y-2">
            {overdue.slice(0, 3).map((a) => (
              <ActivityItem
                key={a.id}
                activity={a}
                onComplete={canUpdateActivities ? handleComplete : undefined}
                onDelete={canDeleteActivities ? handleDelete : undefined}
                showActions={canUpdateActivities || canDeleteActivities}
              />
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <SearchBar value={search} onChange={setSearch} placeholder={t.common.searchPlaceholder} className="w-72" />
        <Button
          variant={showFilters ? 'secondary' : 'ghost'}
          size="sm"
          leftIcon={<Filter size={14} />}
          onClick={() => setShowFilters((v) => !v)}
        >
          {t.common.filters}
        </Button>

        {/* View mode toggle */}
        <div className="flex items-center gap-0.5 glass rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/6'
            }`}
          >
            <LayoutList size={14} />
            {t.deals.list}
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'calendar'
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/6'
            }`}
          >
            <Calendar size={14} />
            {t.calendar.title}
          </button>
        </div>

        <div className="ml-auto">
          <PermissionGate permission="activities:create">
            <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setIsFormOpen(true)}>
              {t.activities.newActivity}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex gap-3 flex-wrap items-center glass p-4">
          <Select
            options={[
              { value: 'call', label: t.activities.typeLabels.call },
              { value: 'email', label: t.activities.typeLabels.email },
              { value: 'meeting', label: t.activities.typeLabels.meeting },
              { value: 'note', label: t.activities.typeLabels.note },
              { value: 'task', label: t.activities.typeLabels.task },
              { value: 'linkedin', label: t.activities.typeLabels.linkedin },
            ]}
            placeholder={t.common.type}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          />
          <Select
            options={[
              { value: 'pending', label: t.activities.statusLabels.pending },
              { value: 'completed', label: t.activities.statusLabels.completed },
              { value: 'cancelled', label: t.activities.statusLabels.cancelled },
            ]}
            placeholder={t.common.status}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" leftIcon={<X size={14} />}
              onClick={() => { setTypeFilter(''); setStatusFilter('') }}>
              {t.common.clear}
            </Button>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500">{filtered.length} {t.activities.title.toLowerCase()}</p>

      {/* Calendar view */}
      {viewMode === 'calendar' && (
        <CalendarView
          activities={filtered}
          onDaySelect={handleDaySelect}
          dayHeaders={t.dashboard.dayLabels}
          dateLocale={dateLocale}
          noActivitiesLabel={t.activities.emptyDescription}
        />
      )}

      {/* Activities list */}
      {viewMode === 'list' && (
        <>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<ActivityIcon size={28} />}
              title={t.activities.emptyTitle}
              description={t.activities.emptyDescription}
              action={canUpdateActivities ? { label: t.activities.newActivity, onClick: () => setIsFormOpen(true) } : undefined}
            />
          ) : (
            <div className="glass p-4 space-y-1">
              {filtered.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  onComplete={canUpdateActivities ? handleComplete : undefined}
                  onDelete={canDeleteActivities ? handleDelete : undefined}
                  showActions={canUpdateActivities || canDeleteActivities}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create / edit form */}
      <SlideOver
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditActivity(undefined) }}
        title={editActivity ? t.activities.editActivity : t.activities.newActivity}
      >
        <ActivityForm
          activity={editActivity}
          onSubmit={editActivity ? handleEdit : handleCreate}
          onCancel={() => { setIsFormOpen(false); setEditActivity(undefined) }}
        />
      </SlideOver>
    </div>
  )
}
