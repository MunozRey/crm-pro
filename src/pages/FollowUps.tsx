import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslations } from '../i18n'
import { RefreshCw, AlertTriangle, Clock, Phone, Mail, ClipboardList, User, Filter } from 'lucide-react'
import { useContactsStore } from '../store/contactsStore'
import { useActivitiesStore } from '../store/activitiesStore'
import { useCompaniesStore } from '../store/companiesStore'
import { getFollowUpReminders } from '../utils/followUpEngine'
import { EmailComposer } from '../components/email/EmailComposer'
import { Avatar } from '../components/ui/Avatar'
import { toast } from '../store/toastStore'
import { formatDate } from '../utils/formatters'
import type { FollowUpReminder, ActivityType } from '../types'

type UrgencyFilter = 'all' | 'critical' | 'high' | 'medium' | 'low'

const URGENCY_COLORS: Record<FollowUpReminder['urgency'], string> = {
  critical: 'text-red-400',
  high: 'text-amber-400',
  medium: 'text-yellow-400',
  low: 'text-slate-400',
}

const URGENCY_BG: Record<FollowUpReminder['urgency'], string> = {
  critical: 'bg-red-500/15 text-red-400 border border-red-500/20',
  high: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  medium: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
  low: 'bg-white/6 text-slate-400 border border-white/8',
}

export function FollowUps() {
  const t = useTranslations()
  const navigate = useNavigate()
  const contacts = useContactsStore((s) => s.contacts)
  const activities = useActivitiesStore((s) => s.activities)
  const addActivity = useActivitiesStore((s) => s.addActivity)
  const companies = useCompaniesStore((s) => s.companies)

  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [emailComposerOpen, setEmailComposerOpen] = useState(false)
  const [emailContactId, setEmailContactId] = useState<string | undefined>()
  const [emailDefaultTo, setEmailDefaultTo] = useState('')

  const reminders = useMemo(() => {
    void refreshKey
    return getFollowUpReminders(contacts, activities, companies)
  }, [contacts, activities, companies, refreshKey])

  const filtered = useMemo(() => {
    if (urgencyFilter === 'all') return reminders
    return reminders.filter((r) => r.urgency === urgencyFilter)
  }, [reminders, urgencyFilter])

  const stats = useMemo(() => {
    const critical = reminders.filter((r) => r.urgency === 'critical').length
    const high = reminders.filter((r) => r.urgency === 'high').length
    const medium = reminders.filter((r) => r.urgency === 'medium').length
    const low = reminders.filter((r) => r.urgency === 'low').length
    return { total: reminders.length, critical, high, medium, low }
  }, [reminders])

  const handleCall = (reminder: FollowUpReminder) => {
    addActivity({
      type: 'call',
      subject: `${t.nav.followUps} — ${reminder.contactName}`,
      description: `${t.activities.typeLabels.call} — ${t.nav.followUps}`,
      status: 'pending',
      contactId: reminder.contactId,
      createdBy: 'David Muñoz',
    })
    toast.success(`${t.activities.typeLabels.call} — ${reminder.contactName}`)
  }

  const handleEmail = (reminder: FollowUpReminder) => {
    const contact = contacts.find((c) => c.id === reminder.contactId)
    setEmailContactId(reminder.contactId)
    setEmailDefaultTo(contact?.email ?? '')
    setEmailComposerOpen(true)
  }

  const handleTask = (reminder: FollowUpReminder) => {
    addActivity({
      type: 'task',
      subject: `${t.nav.followUps} — ${reminder.contactName}`,
      description: `${t.activities.typeLabels.task} — ${t.nav.followUps}`,
      status: 'pending',
      contactId: reminder.contactId,
      createdBy: 'David Muñoz',
    })
    toast.success(`${t.activities.typeLabels.task} — ${reminder.contactName}`)
  }

  const URGENCY_LABELS: Record<FollowUpReminder['urgency'], string> = {
    critical: t.followUps.critical,
    high: t.followUps.high,
    medium: t.followUps.medium,
    low: t.followUps.low,
  }

  const filterButtons: { value: UrgencyFilter; label: string; count: number }[] = [
    { value: 'all', label: t.common.all, count: stats.total },
    { value: 'critical', label: t.followUps.critical, count: stats.critical },
    { value: 'high', label: t.followUps.high, count: stats.high },
    { value: 'medium', label: t.followUps.medium, count: stats.medium },
    { value: 'low', label: t.followUps.low, count: stats.low },
  ]

  return (
    <div className="p-6 space-y-4">
      {/* Toolbar row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {stats.total} {t.nav.contacts.toLowerCase()} — {t.followUps.title}
        </p>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/5 border border-white/8 transition-colors"
          title={t.common.reset}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass rounded-xl p-4 border border-white/6">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/15">
              <User size={14} className="text-indigo-400" />
            </div>
            <span className="text-xs text-slate-500">{t.followUps.title}</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>

        <div className="glass rounded-xl p-4 border border-white/6">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-red-500/15">
              <AlertTriangle size={14} className="text-red-400" />
            </div>
            <span className="text-xs text-slate-500">{t.followUps.critical}</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{stats.critical}</p>
        </div>

        <div className="glass rounded-xl p-4 border border-white/6">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-amber-500/15">
              <Clock size={14} className="text-amber-400" />
            </div>
            <span className="text-xs text-slate-500">{t.followUps.high}</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{stats.high}</p>
        </div>

        <div className="glass rounded-xl p-4 border border-white/6">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-yellow-500/15">
              <Clock size={14} className="text-yellow-400" />
            </div>
            <span className="text-xs text-slate-500">{t.followUps.medium}</span>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{stats.medium}</p>
        </div>
      </div>

      {/* Filter row — inline, no glass wrapper */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={13} className="text-slate-600" />
        {filterButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setUrgencyFilter(btn.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              urgencyFilter === btn.value
                ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                : 'bg-white/4 border-white/8 text-slate-400 hover:text-slate-200 hover:bg-white/6'
            }`}
          >
            {btn.label}
            {btn.count > 0 && (
              <span className={`text-[10px] font-bold min-w-[16px] text-center ${
                urgencyFilter === btn.value ? 'text-brand-400' : 'text-slate-600'
              }`}>
                {btn.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="glass rounded-xl p-10 border border-white/6 text-center">
            <User size={28} className="text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400">{t.followUps.title}</p>
            <p className="text-xs text-slate-600 mt-1">{t.common.noResults}</p>
          </div>
        ) : (
          filtered.map((reminder) => (
            <div
              key={reminder.contactId}
              onClick={() => navigate(`/contacts/${reminder.contactId}`)}
              className="glass rounded-xl px-4 py-3 border border-white/6 hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar name={reminder.contactName} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-white truncate">{reminder.contactName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${URGENCY_BG[reminder.urgency]}`}>
                        {URGENCY_LABELS[reminder.urgency]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{reminder.companyName}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-xs font-medium ${URGENCY_COLORS[reminder.urgency]}`}>
                        {reminder.daysSinceContact}d {t.followUps.daysSince}
                      </span>
                      {reminder.lastActivityType && (
                        <span className="text-[11px] text-slate-600">
                          {t.activities.typeLabels[reminder.lastActivityType as ActivityType] ?? reminder.lastActivityType} · {formatDate(reminder.lastActivityDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCall(reminder) }}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/8 border border-white/6 transition-colors"
                    title={`${t.common.add} ${t.activities.typeLabels.call}`}
                  >
                    <Phone size={13} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEmail(reminder) }}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/8 border border-white/6 transition-colors"
                    title={`${t.common.add} ${t.activities.typeLabels.email}`}
                  >
                    <Mail size={13} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleTask(reminder) }}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/8 border border-white/6 transition-colors"
                    title={`${t.common.add} ${t.activities.typeLabels.task}`}
                  >
                    <ClipboardList size={13} />
                  </button>
                </div>
              </div>

              {reminder.suggestedAction && (
                <p className="text-xs text-slate-500 italic mt-2 pl-10 truncate">{reminder.suggestedAction}</p>
              )}
            </div>
          ))
        )}
      </div>

      <EmailComposer
        isOpen={emailComposerOpen}
        onClose={() => setEmailComposerOpen(false)}
        contactId={emailContactId}
        defaultTo={emailDefaultTo}
      />
    </div>
  )
}
