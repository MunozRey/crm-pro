import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { PermissionGate } from '../components/auth/PermissionGate'
import {
  ArrowLeft, Edit2, Plus, Building2, Phone, Mail, Calendar,
  FileText, CheckCircle2, Eye, MousePointerClick,
} from 'lucide-react'
import { useContactsStore } from '../store/contactsStore'
import { useCompaniesStore } from '../store/companiesStore'
import { useDealsStore } from '../store/dealsStore'
import { useActivitiesStore } from '../store/activitiesStore'
import { useEmailStore } from '../store/emailStore'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { SlideOver } from '../components/ui/Modal'
import { ContactForm } from '../components/contacts/ContactForm'
import { ContactStatusBadge } from '../components/contacts/ContactStatusBadge'
import { ActivityItem } from '../components/activities/ActivityItem'
import { ActivityForm } from '../components/activities/ActivityForm'
import { EmailComposer } from '../components/email/EmailComposer'
import { Textarea } from '../components/ui/Textarea'
import { toast } from '../store/toastStore'
import { formatDate, formatCurrency, formatRelativeDate } from '../utils/formatters'
import { CONTACT_SOURCE_LABELS, DEAL_STAGE_COLORS } from '../utils/constants'
import type { Contact, DealStage, ActivityType } from '../types'
import { CustomFieldsDisplay } from '../components/shared/CustomFieldRenderer'
import { useTranslations, useI18nStore } from '../i18n'
import { format } from 'date-fns'
import type { Locale } from 'date-fns'
import { es, enUS, ptBR } from 'date-fns/locale'

type BadgeColor = 'blue' | 'yellow' | 'purple' | 'orange' | 'emerald' | 'rose'
const STAGE_BADGE: Record<DealStage, BadgeColor> = {
  lead: 'blue', qualified: 'yellow', proposal: 'purple',
  negotiation: 'orange', closed_won: 'emerald', closed_lost: 'rose',
}

type TabId = 'overview' | 'activities' | 'deals' | 'emails' | 'notes'

const ACTIVITY_ICONS: Record<ActivityType, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  task: CheckCircle2,
  linkedin: Building2,
}

function getMonthLabel(dateStr: string, locale: Locale): string {
  const d = new Date(dateStr)
  return format(d, 'MMMM yyyy', { locale })
}


export function ContactDetail() {
  const t = useTranslations()
  const language = useI18nStore((s) => s.language)
  const dateLocale = language === 'pt' ? ptBR : language === 'en' ? enUS : es

  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isActivityOpen, setIsActivityOpen] = useState(false)
  const [isEmailOpen, setIsEmailOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)

  const contact = useContactsStore((s) => s.contacts.find((c) => c.id === id))
  const { updateContact } = useContactsStore()
  const companies = useCompaniesStore((s) => s.companies)
  const deals = useDealsStore((s) => s.deals)
  const { activities, addActivity, completeActivity, deleteActivity } = useActivitiesStore()
  const emails = useEmailStore((s) => s.emails)
  const { trackEmailOpen, trackEmailClick } = useEmailStore()

  if (!contact) {
    return (
      <div className="p-6">
        <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/contacts')}>
          {t.common.back}
        </Button>
        <p className="text-slate-500 mt-4">{t.contacts.emptyTitle}</p>
      </div>
    )
  }

  const company = companies.find((c) => c.id === contact.companyId)
  const contactDeals = deals.filter((d) => d.contactId === id || contact.linkedDeals.includes(d.id))
  const contactActivities = activities
    .filter((a) => a.contactId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const contactEmails = emails.filter(
    (e) => e.contactId === id || e.to.some((addr) => addr === contact.email),
  )


  // Group activities by month for timeline
  const activitiesByMonth = useMemo(() => {
    const groups: Record<string, typeof contactActivities> = {}
    for (const act of contactActivities) {
      const label = getMonthLabel(act.createdAt, dateLocale)
      if (!groups[label]) groups[label] = []
      groups[label].push(act)
    }
    return groups
  }, [contactActivities, dateLocale])

  const handleEdit = (data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'linkedDeals' | 'lastContactedAt'>) => {
    updateContact(contact.id, data)
    setIsEditOpen(false)
    toast.success(t.contacts.updated)
  }

  const handleAddActivity = (data: Omit<(typeof activities)[0], 'id' | 'createdAt'>) => {
    addActivity({ ...data, contactId: id })
    setIsActivityOpen(false)
    toast.success(t.activities.newActivity)
  }

  const handleSaveNotes = () => {
    updateContact(contact.id, { notes })
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
    toast.success(t.common.save)
  }

  const handleQuickActivity = (type: ActivityType, subject: string) => {
    addActivity({
      type,
      subject,
      description: '',
      status: 'pending',
      contactId: id,
      createdBy: 'current-user',
    })
    toast.success(t.activities.newActivity)
  }


  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: t.common.details },
    { id: 'activities', label: `${t.activities.title} (${contactActivities.length})` },
    { id: 'deals', label: `${t.deals.title} (${contactDeals.length})` },
    { id: 'emails', label: `${t.nav.inbox} (${contactEmails.length})` },
    { id: 'notes', label: t.common.notes },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back */}
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={() => navigate('/contacts')} className="mb-4">
        {t.nav.contacts}
      </Button>

      {/* Header */}
      <div className="glass border border-white/8 rounded-xl p-6 mb-4">
        <div className="flex items-start gap-5">
          <Avatar name={`${contact.firstName} ${contact.lastName}`} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-slate-100">
                    {contact.firstName} {contact.lastName}
                  </h1>
                  <p className="text-slate-400 mt-0.5">{contact.jobTitle || t.contacts.jobTitle}</p>
                  {company && (
                    <Link
                      to={`/companies/${company.id}`}
                      className="flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 mt-1 transition-colors"
                    >
                      <Building2 size={14} />
                      {company.name}
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <PermissionGate permission="contacts:update">
                  <Button variant="secondary" size="sm" leftIcon={<Edit2 size={14} />} onClick={() => setIsEditOpen(true)}>
                    {t.common.edit}
                  </Button>
                </PermissionGate>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <ContactStatusBadge status={contact.status} />
              <Badge variant="gray">{CONTACT_SOURCE_LABELS[contact.source]}</Badge>
              {contact.tags.map((tag) => (
                <Badge key={tag} variant="indigo">{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => handleQuickActivity('call', `${t.activities.typeLabels.call} ${contact.firstName}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass border border-white/8 hover:border-white/12 text-sm text-slate-300 hover:text-white transition-colors"
        >
          <Phone size={14} />
          {t.activities.typeLabels.call}
        </button>
        <button
          onClick={() => setIsEmailOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass border border-white/8 hover:border-white/12 text-sm text-slate-300 hover:text-white transition-colors"
        >
          <Mail size={14} />
          {t.activities.typeLabels.email}
        </button>
        <button
          onClick={() => handleQuickActivity('meeting', `${t.activities.typeLabels.meeting} ${contact.firstName}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass border border-white/8 hover:border-white/12 text-sm text-slate-300 hover:text-white transition-colors"
        >
          <Calendar size={14} />
          {t.activities.typeLabels.meeting}
        </button>
        <button
          onClick={() => handleQuickActivity('note', `${t.activities.typeLabels.note} ${contact.firstName}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass border border-white/8 hover:border-white/12 text-sm text-slate-300 hover:text-white transition-colors"
        >
          <FileText size={14} />
          {t.activities.typeLabels.note}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-white/8">
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
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Contact Info */}
          <div className="glass border border-white/8 rounded-xl p-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {[
                { label: t.auth.email, value: contact.email },
                { label: t.common.phone, value: contact.phone || '\u2014' },
                { label: t.contacts.jobTitle, value: contact.jobTitle || '\u2014' },
                { label: t.contacts.company, value: company?.name || '\u2014' },
                { label: t.common.status, value: contact.status },
                { label: t.contacts.source, value: CONTACT_SOURCE_LABELS[contact.source] },
                { label: t.common.assignedTo, value: contact.assignedTo },
                { label: t.contacts.lastContacted, value: formatDate(contact.lastContactedAt) },
                { label: t.common.createdAt, value: formatDate(contact.createdAt) },
                { label: t.common.updatedAt, value: formatDate(contact.updatedAt) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                  <p className="text-sm text-slate-200">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Fields */}
          <CustomFieldsDisplay entityId={contact.id} entityType="contact" />
        </div>
      )}

      {/* Tab: Activities (Timeline) */}
      {activeTab === 'activities' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setIsActivityOpen(true)}>
              {t.activities.newActivity}
            </Button>
          </div>
          {contactActivities.length === 0 ? (
            <div className="glass border border-white/8 rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm">{t.activities.emptyTitle}</p>
            </div>
          ) : (
            <div className="glass border border-white/8 rounded-xl p-6">
              {Object.entries(activitiesByMonth).map(([month, acts]) => (
                <div key={month} className="mb-6 last:mb-0">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    {month}
                  </h3>
                  <div className="relative pl-6 border-l-2 border-white/8 space-y-4">
                    {acts.map((a) => {
                      const IconComponent = ACTIVITY_ICONS[a.type] || FileText
                      return (
                        <div key={a.id} className="relative">
                          {/* Timeline dot */}
                          <div className="absolute -left-[25px] top-1 w-4 h-4 rounded-full glass border border-white/12 flex items-center justify-center">
                            <IconComponent size={9} className="text-slate-400" />
                          </div>
                          <ActivityItem
                            activity={a}
                            onComplete={completeActivity}
                            onDelete={deleteActivity}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Deals */}
      {activeTab === 'deals' && (
        <div className="space-y-3">
          {contactDeals.length === 0 ? (
            <div className="glass border border-white/8 rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm">{t.deals.emptyTitle}</p>
            </div>
          ) : (
            contactDeals.map((deal) => (
              <div
                key={deal.id}
                className="glass border border-white/8 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-white/12 transition-colors"
                onClick={() => navigate('/deals')}
              >
                <div className="flex-1">
                  <p className="font-medium text-slate-200">{deal.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t.deals.expectedClose}: {formatDate(deal.expectedCloseDate)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-emerald-400">
                    {formatCurrency(deal.value, deal.currency)}
                  </span>
                  <Badge variant={STAGE_BADGE[deal.stage]}>
                    {t.deals.stageLabels[deal.stage]}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Emails */}
      {activeTab === 'emails' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" leftIcon={<Mail size={14} />} onClick={() => setIsEmailOpen(true)}>
              {t.inbox.compose}
            </Button>
          </div>
          {contactEmails.length === 0 ? (
            <div className="glass border border-white/8 rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm">{t.inbox.noMessages}</p>
            </div>
          ) : (
            contactEmails.map((email) => (
              <div
                key={email.id}
                className="glass border border-white/8 rounded-xl p-4 hover:border-white/12 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-200 truncate">{email.subject || t.common.noResults}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {email.sentAt ? formatDate(email.sentAt) : formatDate(email.createdAt)}
                      {' \u2022 '}
                      {t.common.to}: {email.to.join(', ')}
                    </p>
                    <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                      {email.body}
                    </p>
                    {/* Tracking badges */}
                    {(email.trackingEnabled || (email.openCount ?? 0) > 0 || (email.clickCount ?? 0) > 0) && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {(email.openCount ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            <Eye size={9} />
                            {t.common.view} {email.openCount}x &middot; {formatRelativeDate(email.lastOpenedAt!)}
                          </span>
                        ) : email.trackingEnabled ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-slate-500 border border-white/10">
                            <Eye size={9} />
                            {t.common.noResults}
                          </span>
                        ) : null}
                        {(email.clickCount ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                            <MousePointerClick size={9} />
                            Click {email.clickCount}x
                          </span>
                        )}
                      </div>
                    )}
                    {/* Simulation buttons */}
                    {email.trackingEnabled && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <button
                          onClick={() => trackEmailOpen(email.id)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-emerald-500/15 text-slate-500 hover:text-emerald-400 border border-white/8 transition-colors"
                        >
                          {t.common.view}
                        </button>
                        <button
                          onClick={() => trackEmailClick(email.id)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-blue-500/15 text-slate-500 hover:text-blue-400 border border-white/8 transition-colors"
                        >
                          Click
                        </button>
                      </div>
                    )}
                  </div>
                  <Badge variant={email.status === 'sent' ? 'emerald' : email.status === 'draft' ? 'yellow' : 'blue'}>
                    {email.status === 'sent' ? t.inbox.sent : email.status === 'draft' ? t.inbox.drafts : t.inbox.title}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Notes */}
      {activeTab === 'notes' && (
        <div className="glass border border-white/8 rounded-xl p-6 space-y-4">
          <Textarea
            label={t.common.notes}
            value={notes || contact.notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={8}
            placeholder={t.common.notes}
          />
          <Button onClick={handleSaveNotes}>
            {notesSaved ? t.common.ok : t.common.save}
          </Button>
        </div>
      )}


      {/* Edit slide-over */}
      <SlideOver isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={t.contacts.editContact}>
        <ContactForm contact={contact} onSubmit={handleEdit} onCancel={() => setIsEditOpen(false)} />
      </SlideOver>

      {/* Activity slide-over */}
      <SlideOver isOpen={isActivityOpen} onClose={() => setIsActivityOpen(false)} title={t.activities.newActivity}>
        <ActivityForm defaultContactId={id} onSubmit={handleAddActivity} onCancel={() => setIsActivityOpen(false)} />
      </SlideOver>


      {/* Email Composer */}
      <EmailComposer
        isOpen={isEmailOpen}
        onClose={() => setIsEmailOpen(false)}
        defaultTo={contact.email}
        contactId={contact.id}
        companyId={contact.companyId}
      />
    </div>
  )
}
