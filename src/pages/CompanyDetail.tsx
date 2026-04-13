import { useState, useMemo, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslations } from '../i18n'
import {
  ArrowLeft, Edit2, Plus, Globe, Phone, Users, TrendingUp,
  DollarSign, Activity as ActivityIcon, Building2, Mail, Calendar,
} from 'lucide-react'
import { useCompaniesStore } from '../store/companiesStore'
import { useContactsStore } from '../store/contactsStore'
import { useDealsStore } from '../store/dealsStore'
import { useActivitiesStore } from '../store/activitiesStore'
import { useEmailStore } from '../store/emailStore'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { SlideOver } from '../components/ui/Modal'
import { CompanyForm } from '../components/companies/CompanyForm'
import { ActivityItem } from '../components/activities/ActivityItem'
import { ActivityForm } from '../components/activities/ActivityForm'
import { ContactStatusBadge } from '../components/contacts/ContactStatusBadge'
import { EmailComposer } from '../components/email/EmailComposer'
import { toast } from '../store/toastStore'
import { formatDate, formatCurrency, formatRelativeDate } from '../utils/formatters'
import { COMPANY_INDUSTRY_LABELS, DEAL_STAGE_COLORS, ACTIVITY_TYPE_COLORS } from '../utils/constants'
import { PermissionGate } from '../components/auth/PermissionGate'
import type { Company, Deal, Contact, Activity, CRMEmail, DealStage } from '../types'
import { CustomFieldsDisplay } from '../components/shared/CustomFieldRenderer'

type TabId = 'overview' | 'contacts' | 'deals' | 'activities' | 'emails'

const STAGE_BADGE: Record<DealStage, 'blue' | 'yellow' | 'purple' | 'orange' | 'emerald' | 'rose'> = {
  lead: 'blue', qualified: 'yellow', proposal: 'purple',
  negotiation: 'orange', closed_won: 'emerald', closed_lost: 'rose',
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  prospect: { color: 'text-amber-400', bg: 'bg-amber-500/15' },
  customer: { color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  partner: { color: 'text-brand-400', bg: 'bg-brand-500/15' },
  churned: { color: 'text-red-400', bg: 'bg-red-500/15' },
}

export function CompanyDetail() {
  const t = useTranslations()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isActivityOpen, setIsActivityOpen] = useState(false)
  const [isEmailOpen, setIsEmailOpen] = useState(false)

  // ── Manual store subscriptions to avoid Zustand v5 getSnapshot error ──
  const [company, setCompany] = useState<Company | undefined>()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [allActivities, setAllActivities] = useState<Activity[]>([])
  const [emails, setEmails] = useState<CRMEmail[]>([])

  const compute = useCallback(() => {
    const cs = useCompaniesStore.getState().companies
    setCompany(cs.find((c) => c.id === id))
    setContacts(useContactsStore.getState().contacts.filter((c) => c.companyId === id))
    setDeals(useDealsStore.getState().deals.filter((d) => d.companyId === id))
    setAllActivities(useActivitiesStore.getState().activities)
    setEmails(useEmailStore.getState().emails.filter((e) => e.companyId === id))
  }, [id])

  useEffect(() => {
    compute()
    const unsubs = [
      useCompaniesStore.subscribe(compute),
      useContactsStore.subscribe(compute),
      useDealsStore.subscribe(compute),
      useActivitiesStore.subscribe(compute),
      useEmailStore.subscribe(compute),
    ]
    return () => unsubs.forEach((u) => u())
  }, [compute])

  const updateCompany = useCompaniesStore.getState().updateCompany
  const addActivity = useActivitiesStore.getState().addActivity
  const completeActivity = useActivitiesStore.getState().completeActivity
  const deleteActivity = useActivitiesStore.getState().deleteActivity

  const companyActivities = allActivities
    .filter((a) => a.companyId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // KPIs computed
  const kpis = useMemo(() => {
    const openDeals = deals.filter((d) => !['closed_won', 'closed_lost'].includes(d.stage))
    const wonDeals = deals.filter((d) => d.stage === 'closed_won')
    const totalPipeline = openDeals.reduce((sum, d) => sum + d.value, 0)
    const totalWon = wonDeals.reduce((sum, d) => sum + d.value, 0)
    const closedDeals = deals.filter((d) => d.stage === 'closed_won' || d.stage === 'closed_lost')
    const winRate = closedDeals.length > 0
      ? Math.round((wonDeals.length / closedDeals.length) * 100)
      : 0
    return { openDeals: openDeals.length, totalPipeline, totalWon, winRate, contactCount: contacts.length }
  }, [deals, contacts])

  if (!company) {
    return (
      <div className="p-6">
        <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/companies')}>{t.common.back}</Button>
        <p className="text-slate-500 mt-4">{t.companies.emptyTitle}</p>
      </div>
    )
  }

  const handleEdit = (data: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'contacts' | 'deals' | 'tags'>) => {
    updateCompany(company.id, data)
    setIsEditOpen(false)
    toast.success(t.companies.updated)
  }

  const handleAddActivity = (data: Omit<Activity, 'id' | 'createdAt'>) => {
    addActivity({ ...data, companyId: id })
    setIsActivityOpen(false)
    toast.success(t.activities.newActivity)
  }

  const statusCfg = STATUS_CONFIG[company.status] || STATUS_CONFIG.prospect

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: t.common.details },
    { id: 'contacts', label: t.contacts.title, count: contacts.length },
    { id: 'deals', label: t.deals.title, count: deals.length },
    { id: 'activities', label: t.activities.title, count: companyActivities.length },
    { id: 'emails', label: t.nav.inbox, count: emails.length },
  ]

  return (
    <div className="p-6 space-y-4">
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={() => navigate('/companies')} className="mb-2">
        {t.nav.companies}
      </Button>

      {/* Header card */}
      <div className="glass rounded-2xl shadow-float border-white/10 p-6">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center flex-shrink-0 shadow-brand-sm">
            <Building2 size={24} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">{company.name}</h1>
                <p className="text-slate-400 mt-0.5">{COMPANY_INDUSTRY_LABELS[company.industry]}</p>
                <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                  {company.website && (
                    <a href={company.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-brand-400 hover:text-brand-300 transition-colors"
                      onClick={(e) => e.stopPropagation()}>
                      <Globe size={13} />{company.domain || company.website}
                    </a>
                  )}
                  {company.phone && (
                    <span className="flex items-center gap-1"><Phone size={13} />{company.phone}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" leftIcon={<Mail size={14} />} onClick={() => setIsEmailOpen(true)}>
                  {t.activities.typeLabels.email}
                </Button>
                <PermissionGate permission="companies:update">
                  <Button variant="secondary" size="sm" leftIcon={<Edit2 size={14} />} onClick={() => setIsEditOpen(true)}>
                    {t.common.edit}
                  </Button>
                </PermissionGate>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                {t.companies.statusLabels[company.status as keyof typeof t.companies.statusLabels] ?? company.status}
              </span>
              {company.city && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/6 text-slate-400">{company.city}, {company.country}</span>
              )}
              {company.size && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/6 text-slate-400">{company.size} {t.companies.size}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: t.companies.contactCount, value: kpis.contactCount, icon: <Users size={15} />, color: 'text-brand-400' },
          { label: t.dashboard.openDeals, value: kpis.openDeals, icon: <TrendingUp size={15} />, color: 'text-amber-400' },
          { label: t.deals.pipeline, value: formatCurrency(kpis.totalPipeline), icon: <DollarSign size={15} />, color: 'text-emerald-400' },
          { label: t.deals.won, value: formatCurrency(kpis.totalWon), icon: <DollarSign size={15} />, color: 'text-emerald-400' },
          { label: 'Tasa de conversión', value: `${kpis.winRate}%`, icon: <TrendingUp size={15} />, color: 'text-brand-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="glass rounded-xl border-white/8 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={kpi.color}>{kpi.icon}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{kpi.label}</span>
            </div>
            <p className="text-lg font-bold text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-brand-400 border-brand-500'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            {tab.label}{tab.count != null ? ` (${tab.count})` : ''}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
        <div className="glass rounded-2xl border-white/8 p-6">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {[
              { label: t.common.name, value: company.name },
              { label: t.companies.website, value: company.domain || '\u2014' },
              { label: t.companies.industry, value: COMPANY_INDUSTRY_LABELS[company.industry] },
              { label: t.companies.size, value: company.size || '\u2014' },
              { label: t.companies.country, value: company.country || '\u2014' },
              { label: t.companies.city, value: company.city || '\u2014' },
              { label: t.common.phone, value: company.phone || '\u2014' },
              { label: t.companies.revenue, value: company.revenue ? formatCurrency(company.revenue) : '\u2014' },
              { label: t.common.createdAt, value: formatDate(company.createdAt) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                <p className="text-sm text-slate-200">{value}</p>
              </div>
            ))}
          </div>
          {company.notes && (
            <div className="mt-4 pt-4 border-t border-white/6">
              <p className="text-xs text-slate-500 mb-1">{t.common.notes}</p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{company.notes}</p>
            </div>
          )}

          {/* Deal Pipeline mini-visualization */}
          {deals.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t.deals.pipeline}</p>
              <div className="space-y-2">
                {deals.map((deal) => {
                  const stageIdx = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'].indexOf(deal.stage)
                  const progress = deal.stage === 'closed_won' ? 100 : deal.stage === 'closed_lost' ? 0 : ((stageIdx + 1) / 5) * 100
                  return (
                    <div key={deal.id} className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/deals')}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate group-hover:text-brand-400 transition-colors">{deal.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 rounded-full bg-white/6 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${deal.stage === 'closed_won' ? 'bg-emerald-500' : deal.stage === 'closed_lost' ? 'bg-red-500' : 'bg-brand-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 flex-shrink-0">{t.deals.stageLabels[deal.stage as keyof typeof t.deals.stageLabels] ?? deal.stage}</span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-emerald-400 flex-shrink-0">{formatCurrency(deal.value, deal.currency)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Custom Fields */}
        <CustomFieldsDisplay entityId={company.id} entityType="company" />
        </div>
      )}

      {/* Contacts */}
      {activeTab === 'contacts' && (
        <div className="space-y-3">
          {contacts.length === 0 ? (
            <div className="glass rounded-2xl border-white/8 p-8 text-center">
              <Users size={32} className="mx-auto text-slate-600 mb-2" />
              <p className="text-slate-500 text-sm">{t.contacts.emptyTitle}</p>
            </div>
          ) : contacts.map((contact) => (
            <Link
              key={contact.id}
              to={`/contacts/${contact.id}`}
              className="flex items-center gap-4 glass rounded-xl border-white/8 p-4 hover:border-white/15 transition-all group"
            >
              <Avatar name={`${contact.firstName} ${contact.lastName}`} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-200 text-sm group-hover:text-brand-400 transition-colors">
                  {contact.firstName} {contact.lastName}
                </p>
                <p className="text-xs text-slate-500">{contact.jobTitle} · {contact.email}</p>
              </div>
              <ContactStatusBadge status={contact.status} />
            </Link>
          ))}
        </div>
      )}

      {/* Deals */}
      {activeTab === 'deals' && (
        <div className="space-y-3">
          {deals.length === 0 ? (
            <div className="glass rounded-2xl border-white/8 p-8 text-center">
              <TrendingUp size={32} className="mx-auto text-slate-600 mb-2" />
              <p className="text-slate-500 text-sm">{t.deals.emptyTitle}</p>
            </div>
          ) : deals.map((deal) => {
            const daysOpen = Math.floor((Date.now() - new Date(deal.createdAt).getTime()) / 86400000)
            return (
              <div
                key={deal.id}
                className="glass rounded-xl border-white/8 p-4 flex items-center gap-4 cursor-pointer hover:border-white/15 transition-all group"
                onClick={() => navigate('/deals')}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-200 group-hover:text-brand-400 transition-colors">{deal.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>{t.deals.expectedClose}: {formatDate(deal.expectedCloseDate)}</span>
                    <span className={`${daysOpen > 30 ? 'text-red-400' : daysOpen > 14 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {daysOpen}d {t.deals.daysInStage}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-emerald-400">
                    {formatCurrency(deal.value, deal.currency)}
                  </span>
                  <Badge variant={STAGE_BADGE[deal.stage] ?? 'gray'}>{t.deals.stageLabels[deal.stage as keyof typeof t.deals.stageLabels] ?? deal.stage}</Badge>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Activities */}
      {activeTab === 'activities' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <PermissionGate permission="activities:create">
              <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setIsActivityOpen(true)}>
                {t.activities.newActivity}
              </Button>
            </PermissionGate>
          </div>
          {companyActivities.length === 0 ? (
            <div className="glass rounded-2xl border-white/8 p-8 text-center">
              <ActivityIcon size={32} className="mx-auto text-slate-600 mb-2" />
              <p className="text-slate-500 text-sm">{t.activities.emptyTitle}</p>
            </div>
          ) : (
            <div className="relative pl-6">
              {/* Timeline line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/8" />
              {companyActivities.map((a) => {
                const typeColor = ACTIVITY_TYPE_COLORS[a.type] || '#6b7280'
                return (
                  <div key={a.id} className="relative mb-3">
                    {/* Dot */}
                    <div className="absolute -left-6 top-3 w-[9px] h-[9px] rounded-full border-2 border-navy-900" style={{ backgroundColor: typeColor }} />
                    <div className="glass rounded-xl border-white/8 p-3">
                      <ActivityItem
                        activity={a}
                        onComplete={completeActivity}
                        onDelete={deleteActivity}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Emails */}
      {activeTab === 'emails' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" leftIcon={<Mail size={14} />} onClick={() => setIsEmailOpen(true)}>
              {t.inbox.compose}
            </Button>
          </div>
          {emails.length === 0 ? (
            <div className="glass rounded-2xl border-white/8 p-8 text-center">
              <Mail size={32} className="mx-auto text-slate-600 mb-2" />
              <p className="text-slate-500 text-sm">{t.inbox.noMessages}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {emails.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((email) => (
                <div key={email.id} className="glass rounded-xl border-white/8 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-white">{email.subject}</p>
                    <span className="text-[10px] text-slate-500">{formatRelativeDate(email.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-400">{t.common.to}: {email.to.join(', ')}</p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{email.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SlideOver isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={t.companies.editCompany}>
        <CompanyForm company={company} onSubmit={handleEdit} onCancel={() => setIsEditOpen(false)} />
      </SlideOver>

      <SlideOver isOpen={isActivityOpen} onClose={() => setIsActivityOpen(false)} title={t.activities.newActivity}>
        <ActivityForm defaultContactId={undefined} onSubmit={handleAddActivity} onCancel={() => setIsActivityOpen(false)} />
      </SlideOver>

      <EmailComposer
        isOpen={isEmailOpen}
        onClose={() => setIsEmailOpen(false)}
        companyId={id}
      />
    </div>
  )
}
