import { useState, useMemo } from 'react'
import { Users, Briefcase, Activity, Mail, Building2, Filter, Calendar, Flame, Shield, UserCog } from 'lucide-react'
import { useAuditStore } from '../store/auditStore'
import { format, parseISO, isToday } from 'date-fns'
import { es, enUS, ptBR, fr, de, it } from 'date-fns/locale'
import type { AuditEntry, AuditAction } from '../types'
import { useTranslations } from '../i18n'
import { useI18nStore } from '../i18n'

type EntityFilter = 'all' | 'contact' | 'deal' | 'activity' | 'email' | 'company' | 'lead'

const ENTITY_ICONS: Record<AuditEntry['entityType'], typeof Users> = {
  contact: Users,
  deal: Briefcase,
  activity: Activity,
  email: Mail,
  company: Building2,
  lead: Flame,
  settings: Shield,
  user: UserCog,
}

type ActionCategory = 'created' | 'updated' | 'deleted' | 'stage_changed' | 'completed'

function getActionCategory(action: AuditAction): ActionCategory {
  if (action.includes('created') || action === 'email_sent') return 'created'
  if (action.includes('deleted')) return 'deleted'
  if (action === 'deal_stage_changed') return 'stage_changed'
  if (action === 'activity_completed' || action === 'enrichment_completed') return 'completed'
  return 'updated'
}

const ACTION_COLORS: Record<ActionCategory, { bg: string; text: string; dot: string }> = {
  created: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  updated: { bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-400' },
  deleted: { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-400' },
  stage_changed: { bg: 'bg-violet-500/15', text: 'text-violet-400', dot: 'bg-violet-400' },
  completed: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
}

export function AuditLog() {
  const t = useTranslations()
  const language = useI18nStore((s) => s.language)
  const dateLocaleByLanguage = { en: enUS, es, pt: ptBR, fr, de, it } as const
  const dateLocale = dateLocaleByLanguage[language]

  const ENTITY_LABELS: Record<AuditEntry['entityType'], string> = {
    contact: t.contacts.title,
    deal: t.deals.title,
    activity: t.activities.title,
    email: t.inbox.title,
    company: t.companies.title,
    lead: t.leads.title,
    settings: t.settings.title,
    user: t.team.title,
  }

  const ACTION_LABELS: Record<AuditAction, string> = {
    contact_created: t.common.create,
    contact_updated: t.common.edit,
    contact_deleted: t.common.delete,
    deal_created: t.common.create,
    deal_updated: t.common.edit,
    deal_deleted: t.common.delete,
    deal_stage_changed: t.deals.stage,
    activity_created: t.common.create,
    activity_completed: t.activities.completed,
    activity_deleted: t.common.delete,
    email_sent: t.inbox.sent,
    enrichment_completed: t.activities.completed,
    company_created: t.common.create,
    company_updated: t.common.edit,
    lead_score_recomputed: t.leads.scoreBreakdownAction,
    user_role_changed: t.team.changeRole,
    permission_profile_updated: t.settings.permissionProfiles,
  }

  function formatAuditTimestamp(timestamp: string): string {
    try {
      const date = parseISO(timestamp)
      return format(date, 'dd MMM yyyy · HH:mm', { locale: dateLocale })
    } catch {
      return timestamp
    }
  }

  const entries = useAuditStore((s) => s.entries)

  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (entityFilter !== 'all' && entry.entityType !== entityFilter) return false
      if (dateFrom && entry.timestamp < dateFrom) return false
      if (dateTo && entry.timestamp > dateTo + 'T23:59:59') return false
      return true
    })
  }, [entries, entityFilter, dateFrom, dateTo])

  const stats = useMemo(() => {
    const todayCount = entries.filter((e) => {
      try {
        return isToday(parseISO(e.timestamp))
      } catch {
        return false
      }
    }).length

    // Find most active entity type
    const entityCounts: Record<string, number> = {}
    entries.forEach((e) => {
      entityCounts[e.entityType] = (entityCounts[e.entityType] || 0) + 1
    })
    let mostActive = '-'
    let maxCount = 0
    for (const [entityType, count] of Object.entries(entityCounts)) {
      if (count > maxCount) {
        maxCount = count
        mostActive = ENTITY_LABELS[entityType as AuditEntry['entityType']] ?? entityType
      }
    }

    return { total: entries.length, today: todayCount, mostActive }
  }, [entries])

  const entityFilterOptions: { value: EntityFilter; label: string }[] = [
    { value: 'all', label: t.common.all },
    { value: 'contact', label: t.contacts.title },
    { value: 'deal', label: t.deals.title },
    { value: 'activity', label: t.activities.title },
    { value: 'email', label: t.inbox.title },
    { value: 'company', label: t.companies.title },
    { value: 'lead', label: t.leads.title },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t.audit.title}</h1>
        <p className="text-slate-400 mt-1">{t.audit.subtitle}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 border border-white/6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-indigo-500/15">
              <Activity className="w-5 h-5 text-indigo-400" />
            </div>
            <span className="text-slate-400 text-sm">{t.common.total}</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats.total}</p>
        </div>

        <div className="glass rounded-2xl p-5 border border-white/6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-emerald-500/15">
              <Calendar className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-slate-400 text-sm">{t.calendar.today}</span>
          </div>
          <p className="text-3xl font-bold text-emerald-400">{stats.today}</p>
        </div>

        <div className="glass rounded-2xl p-5 border border-white/6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-violet-500/15">
              <Filter className="w-5 h-5 text-violet-400" />
            </div>
            <span className="text-slate-400 text-sm">{t.audit.entity}</span>
          </div>
          <p className="text-xl font-bold text-white">{stats.mostActive}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass rounded-2xl p-4 border border-white/6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 text-sm">{t.audit.entity}:</span>
            {entityFilterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setEntityFilter(opt.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  entityFilter === opt.value
                    ? 'btn-gradient text-white'
                    : 'bg-[#0d0e1a] border border-white/10 text-slate-300 hover:bg-white/4'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-slate-400 text-sm">{t.common.from}:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label={`${t.common.from} ${t.common.date}`}
              title={`${t.common.from} ${t.common.date}`}
              className="bg-[#0d0e1a] border border-white/10 rounded-full px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-white/20"
            />
            <span className="text-slate-400 text-sm">{t.common.to}:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label={`${t.common.to} ${t.common.date}`}
              title={`${t.common.to} ${t.common.date}`}
              className="bg-[#0d0e1a] border border-white/10 rounded-full px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-white/20"
            />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        {filtered.length === 0 ? (
          <div className="glass rounded-2xl p-12 border border-white/6 text-center">
            <Activity className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">{t.common.noResults}</h3>
            <p className="text-slate-400">
              {entries.length === 0
                ? t.audit.empty
                : t.audit.emptyFiltered}
            </p>
          </div>
        ) : (
          filtered.map((entry, index) => {
            const category = getActionCategory(entry.action)
            const colors = ACTION_COLORS[category]
            const Icon = ENTITY_ICONS[entry.entityType]

            return (
              <div key={entry.id} className="flex gap-4">
                {/* Timeline line + dot */}
                <div className="flex flex-col items-center flex-shrink-0 w-8">
                  <div className={`w-3 h-3 rounded-full mt-5 ${colors.dot}`} />
                  {index < filtered.length - 1 && (
                    <div className="w-px flex-1 bg-white/8 mt-1" />
                  )}
                </div>

                {/* Entry Card */}
                <div className="glass rounded-2xl p-4 border border-white/6 hover:bg-white/4 transition-colors flex-1 mb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg ${colors.bg} flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${colors.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                            {ACTION_LABELS[entry.action]}
                          </span>
                          <span className="text-slate-500 text-xs">
                            {ENTITY_LABELS[entry.entityType]}
                          </span>
                        </div>
                        <p className="text-slate-200 text-sm">{`${ACTION_LABELS[entry.action]}: ${entry.entityName}`}</p>
                        <p className="text-white font-medium text-sm mt-1">{entry.entityName}</p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-slate-500 text-xs">{formatAuditTimestamp(entry.timestamp)}</p>
                      <p className="text-slate-400 text-xs mt-1">{entry.userId === 'system' || entry.userId === 'Sistema' ? t.audit.systemUser : entry.userId}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
