import { useState, useEffect, useMemo } from 'react'
import { Mail, Send, Inbox as InboxIcon, Loader2, RefreshCw, Wifi, WifiOff, User, Clock, Reply, Plus, Eye, MousePointerClick, Paperclip, Download, Search, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEmailStore } from '../store/emailStore'
import { useContactsStore } from '../store/contactsStore'
import { useDealsStore } from '../store/dealsStore'
import { useCompaniesStore } from '../store/companiesStore'
import { useActivitiesStore } from '../store/activitiesStore'
import { useAuthStore } from '../store/authStore'
import { initiateGmailOAuth, GmailApiError, downloadGmailAttachment, modifyGmailThreadLabels, trashGmailThread } from '../services/gmailService'
import { useGmailToken } from '../contexts/GmailTokenContext'
import { supabase } from '../lib/supabase'
import { useSettingsStore } from '../store/settingsStore'
import { useViewsStore } from '../store/viewsStore'
import { EmailComposer } from '../components/email/EmailComposer'
import { toast } from '../store/toastStore'
import { PermissionGate } from '../components/auth/PermissionGate'
import { hasPermission } from '../utils/permissions'
import { useTranslations } from '../i18n'
import type { GmailThread, CRMEmail, Contact, InboxAdvancedFilters } from '../types'
import { formatDateTime, formatRelativeDate } from '../utils/formatters'
import { trackUxAction } from '../lib/uxMetrics'
import { buildInboxQueryMatcher } from '../utils/inboxQuery'

// ─── Thread item ──────────────────────────────────────────────────────────────
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return (match ? match[1] : from).toLowerCase().trim()
}

function emailDomain(email: string): string {
  const atIdx = email.indexOf('@')
  return atIdx >= 0 ? email.slice(atIdx + 1).toLowerCase() : ''
}

function parseEmails(header: string): string[] {
  if (!header) return []
  return header
    .split(',')
    .map((part) => extractEmail(part))
    .filter(Boolean)
}

interface ThreadMatch {
  contact?: Contact
  companyId?: string
  companyName?: string
  dealId?: string
  dealTitle?: string
}

function ThreadItem({
  thread,
  selected,
  bulkSelected,
  onClick,
  onToggleBulk,
  contactByEmail,
}: {
  thread: GmailThread
  selected: boolean
  bulkSelected: boolean
  onClick: () => void
  onToggleBulk: () => void
  contactByEmail: Map<string, { id: string; name: string }>
}) {
  const t = useTranslations()
  const lastMsg = thread.messages[thread.messages.length - 1]
  const isUnread = lastMsg?.labelIds?.includes('UNREAD')
  const senderEmail = extractEmail(lastMsg?.from ?? '')
  const matchedContact = contactByEmail.get(senderEmail)

  return (
    <div
      onClick={onClick}
      className={`group px-4 py-3 border-b border-white/4 cursor-pointer transition-colors ${
        selected ? 'bg-brand-600/10 border-l-2 border-l-brand-500' : 'hover:bg-white/4'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={bulkSelected}
          onChange={(e) => {
            e.stopPropagation()
            onToggleBulk()
          }}
          onClick={(e) => e.stopPropagation()}
          className={`mt-1 rounded border-white/12 bg-white/6 text-brand-500 focus:ring-brand-500 transition-opacity ${
            bulkSelected ? 'opacity-100' : 'opacity-35 group-hover:opacity-100'
          }`}
          aria-label={t.inbox.selectThread}
          title={t.inbox.selectThread}
        />
        <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand-400">
          {(lastMsg?.from?.charAt(0) ?? '?').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className={`text-sm truncate ${isUnread ? 'font-semibold text-white' : 'text-slate-300'}`}>
              {lastMsg?.from?.replace(/<.*>/, '').trim() || t.inbox.unknownSender}
            </p>
            <span className="text-[10px] text-slate-500 flex-shrink-0">
              {lastMsg?.date ? formatRelativeDate(lastMsg.date) : ''}
            </span>
          </div>
          <p className={`text-xs truncate ${isUnread ? 'text-white' : 'text-slate-400'}`}>{lastMsg?.subject ?? ''}</p>
          <p className="text-[10px] text-slate-600 truncate mt-0.5">{thread.snippet}</p>
          {matchedContact && (
            <Link
              to={`/contacts/${matchedContact.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-300 border border-brand-500/30 hover:bg-brand-600/30 transition-colors mt-1"
            >
              <User size={9} />
              {matchedContact.name}
            </Link>
          )}
        </div>
        {isUnread && <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1" />}
      </div>
    </div>
  )
}

// ─── Tracking badges ──────────────────────────────────────────────────────────
function TrackingBadges({ email }: { email: CRMEmail }) {
  const t = useTranslations()
  if (!email.trackingEnabled && !email.openCount && !email.clickCount) return null

  return (
    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
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
          {t.inbox.clicks} {email.clickCount}x
        </span>
      )}
    </div>
  )
}

// ─── Local email item ─────────────────────────────────────────────────────────
function LocalEmailItem({
  email,
  selected,
  bulkSelected,
  onClick,
  onToggleBulk,
  onAction,
  contacts,
  onTrackOpen,
  onTrackClick,
}: {
  email: CRMEmail
  selected: boolean
  bulkSelected: boolean
  onClick: () => void
  onToggleBulk: () => void
  onAction: (action: 'mark_read' | 'mark_unread' | 'delete' | 'snooze_1h' | 'snooze_1d' | 'snooze_1w', email: CRMEmail) => void
  contacts: Contact[]
  onTrackOpen: (id: string) => void
  onTrackClick: (id: string) => void
}) {
  const t = useTranslations()
  const contact = email.contactId ? contacts.find((c) => c.id === email.contactId) : undefined

  const unread = email.isRead === false

  return (
    <div
      onClick={onClick}
      className={`group px-4 py-3 border-b border-white/4 cursor-pointer transition-colors ${
        selected ? 'bg-brand-600/10 border-l-2 border-l-brand-500' : 'hover:bg-white/4'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={bulkSelected}
          onChange={(e) => {
            e.stopPropagation()
            onToggleBulk()
          }}
          onClick={(e) => e.stopPropagation()}
          className={`mt-1 rounded border-white/12 bg-white/6 text-brand-500 focus:ring-brand-500 transition-opacity ${
            bulkSelected ? 'opacity-100' : 'opacity-35 group-hover:opacity-100'
          }`}
          aria-label={t.inbox.selectMessage}
          title={t.inbox.selectMessage}
        />
        <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0">
          <User size={14} className="text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className={`text-sm truncate ${unread ? 'text-white font-semibold' : 'text-slate-300'}`}>
              {contact ? `${contact.firstName} ${contact.lastName}` : email.to.join(', ')}
            </p>
            <span className="text-[10px] text-slate-500 flex-shrink-0">
              {formatRelativeDate(email.sentAt ?? email.createdAt)}
            </span>
          </div>
          <p className={`text-xs truncate ${unread ? 'text-white font-semibold' : 'text-white'}`}>{email.subject || ''}</p>
          <p className="text-[10px] text-slate-600 truncate mt-0.5">{email.body.slice(0, 80)}</p>
          {email.status === 'scheduled' && (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
              <Clock size={9} />
              {email.scheduledFor ? formatDateTime(email.scheduledFor) : t.inbox.scheduled}
            </span>
          )}
          <TrackingBadges email={email} />
          {email.trackingEnabled && (
            <div className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onTrackOpen(email.id)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-emerald-500/15 text-slate-500 hover:text-emerald-400 border border-white/8 transition-colors"
              >
                {t.common.view}
              </button>
              <button
                onClick={() => onTrackClick(email.id)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-blue-500/15 text-slate-500 hover:text-blue-400 border border-white/8 transition-colors"
              >
                {t.inbox.clicks}
              </button>
            </div>
          )}
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <select
              value=""
              onChange={(e) => {
                const action = e.target.value as 'mark_read' | 'mark_unread' | 'delete' | 'snooze_1h' | 'snooze_1d' | 'snooze_1w'
                if (!action) return
                onAction(action, email)
                e.currentTarget.value = ''
              }}
              className="text-[10px] px-2 py-1 rounded-lg bg-white/6 border border-white/10 text-slate-300"
              aria-label={t.common.actions}
              title={t.common.actions}
            >
              <option value="">{t.common.actions}</option>
              <option value="mark_read">{t.inbox.markRead}</option>
              <option value="mark_unread">{t.inbox.markUnread}</option>
              <option value="snooze_1h">Snooze 1h</option>
              <option value="snooze_1d">{t.inbox.snoozeOneDay}</option>
              <option value="snooze_1w">Snooze 1w</option>
              <option value="delete">{t.common.delete}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Thread view ──────────────────────────────────────────────────────────────
function ThreadView({
  thread,
  match,
  linkSource,
  hasPersistedLink,
  linkedEmails,
  onReply,
  onReplyAll,
  onCreateFollowUp,
  onThreadAction,
  onPinLink,
  onUnpinLink,
  onManualLinkSave,
  onDownloadAttachment,
  allContacts,
  allDeals,
  canEditLinks,
  canCreateFollowUp,
}: {
  thread: GmailThread | null
  match: ThreadMatch | null
  linkSource: 'auto' | 'manual' | null
  hasPersistedLink: boolean
  linkedEmails: CRMEmail[]
  onReply: (to: string, subject: string) => void
  onReplyAll: (thread: GmailThread, messageIndex: number) => void
  onCreateFollowUp: (thread: GmailThread, match: ThreadMatch | null) => void
  onThreadAction: (thread: GmailThread, action: 'mark_read' | 'mark_unread' | 'archive' | 'trash') => void
  onPinLink: (thread: GmailThread, match: ThreadMatch | null) => void
  onUnpinLink: (thread: GmailThread) => void
  onManualLinkSave: (thread: GmailThread, contactId?: string, dealId?: string) => void
  onDownloadAttachment: (messageId: string, attachmentId: string, filename: string) => void
  allContacts: Contact[]
  allDeals: Array<{ id: string; title: string }>
  canEditLinks: boolean
  canCreateFollowUp: boolean
}) {
  const t = useTranslations()
  const [manualContactId, setManualContactId] = useState(match?.contact?.id ?? '')
  const [manualDealId, setManualDealId] = useState(match?.dealId ?? '')

  useEffect(() => {
    setManualContactId(match?.contact?.id ?? '')
    setManualDealId(match?.dealId ?? '')
  }, [match?.contact?.id, match?.dealId])

  if (!thread) return (
    <div className="flex items-center justify-center h-full text-slate-600 text-sm">
      {t.inbox.noMessages}
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-white/6 flex-shrink-0">
        <h2 className="text-base font-semibold text-white">{thread.messages[0]?.subject ?? ''}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{thread.messages.length} {t.common.notes.toLowerCase()}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {match?.contact && (
            <Link
              to={`/contacts/${match.contact.id}`}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-300 border border-brand-500/30 hover:bg-brand-600/30 transition-colors"
            >
              <User size={9} />
              {match.contact.firstName} {match.contact.lastName}
            </Link>
          )}
          {match?.dealId && (
            <Link
              to="/deals"
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors"
            >
              {t.inbox.dealPlaceholder}: {match.dealTitle}
            </Link>
          )}
          {match?.companyName && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-slate-400 border border-white/10">
              {match.companyName}
            </span>
          )}
          {linkSource && (
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
              linkSource === 'manual'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                : 'bg-white/8 text-slate-500 border-white/10'
            }`}>
              {linkSource === 'manual' ? t.inbox.pinnedLink : t.inbox.autoLink}
            </span>
          )}
          {!hasPersistedLink && match && canEditLinks && (
            <button
              onClick={() => onPinLink(thread, match)}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors"
              title={t.inbox.pinLink}
              aria-label={t.inbox.pinLink}
            >
              {t.inbox.pinLink}
            </button>
          )}
          {hasPersistedLink && canEditLinks && (
            <button
              onClick={() => onUnpinLink(thread)}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-slate-400 border border-white/10 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/20 transition-colors"
              title={t.inbox.unpin}
              aria-label={t.inbox.unpin}
            >
              {t.inbox.unpin}
            </button>
          )}
          {canCreateFollowUp && (
            <button
              onClick={() => onCreateFollowUp(thread, match)}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 transition-colors"
              title={t.inbox.followUpCreated}
              aria-label={t.inbox.followUpCreated}
            >
              <Plus size={10} />
              {t.followUps.title}
            </button>
          )}
          <button
            onClick={() => onThreadAction(thread, 'mark_read')}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-slate-400 border border-white/10 hover:bg-emerald-500/15 hover:text-emerald-300 transition-colors"
          >
            {t.inbox.markRead}
          </button>
          <button
            onClick={() => onThreadAction(thread, 'mark_unread')}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-slate-400 border border-white/10 hover:bg-indigo-500/15 hover:text-indigo-300 transition-colors"
          >
            {t.inbox.markUnread}
          </button>
          <button
            onClick={() => onThreadAction(thread, 'archive')}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-slate-400 border border-white/10 hover:bg-amber-500/15 hover:text-amber-300 transition-colors"
          >
            {t.inbox.archive}
          </button>
          <button
            onClick={() => onThreadAction(thread, 'trash')}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-slate-400 border border-white/10 hover:bg-red-500/15 hover:text-red-300 transition-colors"
          >
            {t.inbox.trash}
          </button>
          {canEditLinks && <div className="flex items-center gap-1">
            <select
              value={manualContactId}
              onChange={(e) => setManualContactId(e.target.value)}
              className="bg-[#0d0e1a] border border-white/10 rounded-full px-2 py-0.5 text-[10px] text-slate-300"
              title={t.inbox.contactPlaceholder}
              aria-label={t.inbox.contactPlaceholder}
            >
              <option value="">{t.inbox.contactPlaceholder}</option>
              {allContacts.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
            <select
              value={manualDealId}
              onChange={(e) => setManualDealId(e.target.value)}
              className="bg-[#0d0e1a] border border-white/10 rounded-full px-2 py-0.5 text-[10px] text-slate-300"
              title={t.inbox.dealPlaceholder}
              aria-label={t.inbox.dealPlaceholder}
            >
              <option value="">{t.inbox.dealPlaceholder}</option>
              {allDeals.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
            <button
              onClick={() => onManualLinkSave(thread, manualContactId || undefined, manualDealId || undefined)}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-300 border border-brand-500/30 hover:bg-brand-600/30 transition-colors"
              title={t.inbox.saveLink}
              aria-label={t.inbox.saveLink}
            >
              {t.inbox.saveLink}
            </button>
          </div>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {thread.messages.map((msg, i) => (
          <div key={msg.id ?? i} className="glass rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-xs font-bold text-brand-400">
                  {(msg.from?.charAt(0) ?? '?').toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{msg.from?.replace(/<.*>/, '').trim()}</p>
                  <p className="text-[10px] text-slate-500">{t.common.to}: {msg.to}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <Clock size={12} />
                <span className="text-xs">{msg.date ? formatDateTime(msg.date) : ''}</span>
                <button
                  onClick={() => onReply(msg.from, `Re: ${msg.subject}`)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/6 hover:bg-brand-600/20 hover:text-brand-400 transition-colors"
                >
                  <Reply size={11} />
                  {t.common.back}
                </button>
                <button
                  onClick={() => onReplyAll(thread, i)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/6 hover:bg-indigo-600/20 hover:text-indigo-300 transition-colors"
                >
                  <Reply size={11} />
                  {t.inbox.replyAll}
                </button>
              </div>
            </div>
            <div className="px-4 py-4">
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{msg.body || msg.snippet}</p>
              {(msg.attachments?.length ?? 0) > 0 && (
                <div className="mt-3 space-y-1.5">
                  {msg.attachments!.map((att) => (
                    <button
                      key={att.attachmentId}
                      onClick={() => onDownloadAttachment(msg.id, att.attachmentId, att.filename)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 text-xs text-slate-300 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1 truncate">
                        <Paperclip size={11} />
                        {att.filename}
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Download size={11} />
                        {Math.ceil((att.size || 0) / 1024)} KB
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {linkedEmails.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <p className="text-xs text-slate-500 mb-2">{t.inbox.crmSentInThread}</p>
            <div className="space-y-1.5">
              {linkedEmails.map((email) => (
                <p key={email.id} className="text-xs text-slate-300 truncate">
                  {formatRelativeDate(email.sentAt ?? email.createdAt)} - {email.subject}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── LocalEmailView ────────────────────────────────────────────────────────────
function LocalEmailView({
  email,
  contacts,
  onReply,
  onEmailAction,
  onTrackOpen,
  onTrackClick,
  canDeleteEmails,
}: {
  email: CRMEmail | null
  contacts: Contact[]
  onReply: (to: string, subject: string) => void
  onEmailAction: (action: 'mark_read' | 'mark_unread' | 'delete' | 'snooze_1h' | 'snooze_1d' | 'snooze_1w', email: CRMEmail) => void
  onTrackOpen: (id: string) => void
  onTrackClick: (id: string) => void
  canDeleteEmails: boolean
}) {
  const t = useTranslations()
  if (!email) return (
    <div className="flex items-center justify-center h-full text-slate-600 text-sm">
      {t.inbox.noMessages}
    </div>
  )

  const contact = email.contactId ? contacts.find((c) => c.id === email.contactId) : undefined

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-white/6 flex-shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">{email.subject || ''}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.common.to}: {contact ? `${contact.firstName} ${contact.lastName}` : email.to.join(', ')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => onReply(email.to[0] ?? '', `Re: ${email.subject}`)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/6 hover:bg-brand-600/15 hover:text-brand-400 text-slate-400 transition-colors"
          >
            <Reply size={12} />
            {t.common.back}
          </button>
          <div className="relative inline-flex items-center">
            <select
              value=""
              onChange={(e) => {
                const action = e.target.value as 'mark_read' | 'mark_unread' | 'delete' | 'snooze_1h' | 'snooze_1d' | 'snooze_1w'
                if (!action) return
                if (action === 'delete' && !canDeleteEmails) return
                onEmailAction(action, email)
                e.currentTarget.value = ''
              }}
              className="appearance-none cursor-pointer text-xs pl-3 pr-9 py-1.5 rounded-full bg-white/6 border border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/15 outline-none focus:ring-2 focus:ring-brand-500/30 min-w-[7.5rem]"
              aria-label={t.common.actions}
              title={t.common.actions}
            >
              <option value="">{t.common.actions}</option>
              <option value="mark_read">{t.inbox.markRead}</option>
              <option value="mark_unread">{t.inbox.markUnread}</option>
              <option value="snooze_1h">Snooze 1h</option>
              <option value="snooze_1d">{t.inbox.snoozeOneDay}</option>
              <option value="snooze_1w">Snooze 1w</option>
              {canDeleteEmails ? <option value="delete">{t.common.delete}</option> : null}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full btn-gradient flex items-center justify-center text-xs font-bold text-white">
              {email.from.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{email.from}</p>
              <p className="text-[10px] text-slate-500">
                {email.sentAt ? formatDateTime(email.sentAt) : ''}
                {email.gmailMessageId && (
                  <span className="ml-2 text-emerald-400">{t.settings.connected} Gmail</span>
                )}
              </p>
              <TrackingBadges email={email} />
              {email.trackingEnabled && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button
                    onClick={() => onTrackOpen(email.id)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-emerald-500/15 text-slate-500 hover:text-emerald-400 border border-white/8 transition-colors"
                  >
                    {t.common.view}
                  </button>
                  <button
                    onClick={() => onTrackClick(email.id)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-blue-500/15 text-slate-500 hover:text-blue-400 border border-white/8 transition-colors"
                  >
                    {t.inbox.clicks}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="px-4 py-4">
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{email.body}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function Inbox() {
  const t = useTranslations()
  const currentUser = useAuthStore((s) => s.currentUser)
  const {
    emails, threads, threadsLoading, isGmailConnected,
    gmailAddress, threadLinks, threadWorkspace, threadsError, threadsLastSyncedAt, threadsNextPageToken, threadsHistoryId, syncState, lastSyncErrorAt, lastSyncErrorMessage, loadThreads, fetchThreadLinks, fetchThreadWorkspace, setThreadLink, clearThreadLink, setThreadOwner, setThreadNote, deleteEmail, disconnectGmail,
    trackEmailOpen, trackEmailClick, processScheduledEmails, refreshTrackingMetrics, wakeDueSnoozedEmails, snoozeEmail,
  } = useEmailStore()
  const { inboxViews, addInboxView, deleteInboxView } = useViewsStore()
  const { accessToken, setGmailToken, clearGmailToken, isTokenValid } = useGmailToken()
  const contacts = useContactsStore((s) => s.contacts)
  const deals = useDealsStore((s) => s.deals)
  const companies = useCompaniesStore((s) => s.companies)
  const orgUsers = useAuthStore((s) => s.users)
  const addActivity = useActivitiesStore((s) => s.addActivity)
  const { settings } = useSettingsStore()

  const [folder, setFolder] = useState<'inbox' | 'sent' | 'scheduled' | 'drafts' | 'snoozed'>('inbox')
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [replyTo, setReplyTo] = useState<{ to: string; subject: string } | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [listQuery, setListQuery] = useState('')
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set())
  const [selectedLocalEmailIds, setSelectedLocalEmailIds] = useState<Set<string>>(new Set())
  const [inboxQuickFilter, setInboxQuickFilter] = useState<'all' | 'unread' | 'linked' | 'mine'>('all')
  const [emailQuickFilter, setEmailQuickFilter] = useState<'all' | 'tracked' | 'opened' | 'clicked'>('all')
  const [advancedFilters, setAdvancedFilters] = useState<InboxAdvancedFilters>({
    unreadOnly: false,
    linkedOnly: false,
    mineOnly: false,
    hasAttachments: false,
    tracking: 'all',
  })
  const [selectedInboxViewId, setSelectedInboxViewId] = useState('')
  const [newInboxViewName, setNewInboxViewName] = useState('')

  const canCreateActivities = !!currentUser && hasPermission(currentUser.role, 'activities:create')
  const canLinkEmails = !!currentUser && hasPermission(currentUser.role, 'email:link')
  const canDeleteEmails = !!currentUser && hasPermission(currentUser.role, 'email:update')

  const connected = !!gmailAddress

  // Build contact email lookup map for thread chip matching
  const contactByEmail = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const c of contacts) {
      if (c.email) map.set(c.email.toLowerCase(), { id: c.id, name: `${c.firstName} ${c.lastName}`.trim() })
    }
    return map
  }, [contacts])

  useEffect(() => {
    refreshTrackingMetrics().catch(() => {
      // Non-blocking: tracking counters are best-effort.
    })
  }, [refreshTrackingMetrics, emails.length])

  async function refreshAccessToken(): Promise<string> {
    const { data, error } = await supabase!.functions.invoke('gmail-refresh-token')
    if (error || !data?.access_token) {
      throw new Error('Token refresh failed — please reconnect Gmail')
    }
    const newExpiry = Date.now() + (data.expires_in ?? 3600) * 1000
    setGmailToken(data.access_token, newExpiry)
    return data.access_token as string
  }

  // 401 refresh+retry wrapper
  async function refreshAndRetry<T>(fn: (token: string) => Promise<T>): Promise<T> {
    const activeToken = accessToken ?? await refreshAccessToken()
    try {
      return await fn(activeToken)
    } catch (err) {
      if (err instanceof GmailApiError && err.status === 401) {
        const refreshedToken = await refreshAccessToken()
        return await fn(refreshedToken)
      }
      throw err
    }
  }

  const handleLoadThreads = async (query = '') => {
    try {
      await refreshAndRetry((token) => useEmailStore.getState().loadThreads(token, query))
      if (query.trim()) trackUxAction('inbox_search', { queryLength: query.trim().length })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.errors.generic)
    }
  }

  const handleLoadMoreThreads = async () => {
    if (!threadsNextPageToken) return
    try {
      await refreshAndRetry((token) =>
        useEmailStore.getState().loadThreads(token, listQuery, {
          append: true,
          pageToken: threadsNextPageToken,
        }),
      )
      trackUxAction('inbox_load_more')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.errors.generic)
    }
  }

  const handleLocalEmailAction = (action: 'mark_read' | 'mark_unread' | 'delete' | 'snooze_1h' | 'snooze_1d' | 'snooze_1w', email: CRMEmail) => {
    if (action === 'mark_read') {
      useEmailStore.getState().updateEmail(email.id, { isRead: true })
      return
    }
    if (action === 'mark_unread') {
      useEmailStore.getState().updateEmail(email.id, { isRead: false })
      return
    }
    if (action === 'snooze_1h' || action === 'snooze_1d' || action === 'snooze_1w') {
      const ms = action === 'snooze_1h'
        ? 60 * 60 * 1000
        : action === 'snooze_1d'
          ? 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000
      snoozeEmail(email.id, new Date(Date.now() + ms).toISOString())
      toast.success(t.inbox.snoozed)
      return
    }
    deleteEmail(email.id)
    if (selectedEmailId === email.id) setSelectedEmailId(null)
    toast.success(t.common.delete)
  }

  // Folder list built with translations
  const FOLDERS = [
    { id: 'inbox', label: t.inbox.title, icon: <InboxIcon size={15} /> },
    { id: 'sent', label: t.inbox.sent, icon: <Send size={15} /> },
    { id: 'scheduled', label: t.email.sendLater, icon: <Clock size={15} /> },
    { id: 'drafts', label: t.inbox.drafts, icon: <Mail size={15} /> },
    { id: 'snoozed', label: t.inbox.snoozed, icon: <Clock size={15} /> },
  ]

  // Load Gmail threads when connected (token can be refreshed on-demand)
  useEffect(() => {
    if (connected && folder === 'inbox') {
      handleLoadThreads()
    }
  }, [connected, folder])

  useEffect(() => {
    if (connected) {
      fetchThreadLinks()
      fetchThreadWorkspace()
    }
  }, [connected, fetchThreadLinks, fetchThreadWorkspace])

  useEffect(() => {
    if (!connected || folder !== 'inbox') return
    const timer = window.setTimeout(() => {
      handleLoadThreads(listQuery.trim())
    }, 280)
    return () => window.clearTimeout(timer)
  }, [listQuery, connected, folder])

  const handleConnectGmail = async () => {
    const clientId = settings.googleClientId
    if (!clientId) {
      toast.error(`${t.settings.gmailIntegration} ${t.settings.apiKey}`)
      return
    }
    setConnecting(true)
    try {
      await initiateGmailOAuth(clientId)
      // Browser will redirect — no further action needed here
    } catch (err) {
      setConnecting(false)
      toast.error(err instanceof Error ? err.message : t.errors.gmailConnectionError)
    }
  }

  useEffect(() => {
    if (!connected) return
    const run = async () => {
      try {
        await refreshAndRetry(async (token) => processScheduledEmails(token))
      } catch {
        // ignore periodic scheduler errors
      }
    }
    run()
    const id = window.setInterval(run, 15000)
    return () => window.clearInterval(id)
  }, [connected, processScheduledEmails, accessToken])

  useEffect(() => {
    const id = window.setInterval(() => {
      wakeDueSnoozedEmails()
    }, 5000)
    return () => window.clearInterval(id)
  }, [wakeDueSnoozedEmails])

  const mailboxEmails = useMemo(
    () => {
      if (!currentUser?.id) return emails
      return emails.filter((e) => !e.ownerUserId || e.ownerUserId === currentUser.id)
    },
    [emails, currentUser?.id],
  )
  const sentEmails = useMemo(() => mailboxEmails.filter((e) => e.status === 'sent'), [mailboxEmails])
  const scheduledEmails = useMemo(() => mailboxEmails.filter((e) => e.status === 'scheduled'), [mailboxEmails])
  const draftEmails = useMemo(() => mailboxEmails.filter((e) => e.status === 'draft'), [mailboxEmails])
  const snoozedEmails = useMemo(() => mailboxEmails.filter((e) => e.status === 'snoozed'), [mailboxEmails])
  const queryMatcher = useMemo(() => buildInboxQueryMatcher(listQuery), [listQuery])
  const filteredThreads = threads.filter((thread) => {
    const lastMsg = thread.messages[thread.messages.length - 1]
    return queryMatcher({
      from: lastMsg?.from ?? '',
      to: parseEmails(lastMsg?.to ?? ''),
      subject: lastMsg?.subject ?? '',
      snippet: thread.snippet ?? '',
      body: thread.messages.map((msg) => msg.body ?? msg.snippet ?? '').join('\n'),
      unread: Boolean(lastMsg?.labelIds?.includes('UNREAD')),
      hasAttachment: thread.messages.some((message) => (message.attachments?.length ?? 0) > 0),
      tracked: false,
      opened: false,
      clicked: false,
      mine: (threadWorkspace[thread.id]?.ownerUserId ?? '') === (currentUser?.id ?? ''),
    })
  })
  const filteredSentEmails = sentEmails.filter((email) => queryMatcher({
    from: email.from,
    to: email.to,
    subject: email.subject,
    snippet: email.body.slice(0, 200),
    body: email.body,
    unread: email.isRead === false,
    hasAttachment: (email.attachments?.length ?? 0) > 0,
    tracked: Boolean(email.trackingEnabled),
    opened: (email.openCount ?? 0) > 0,
    clicked: (email.clickCount ?? 0) > 0,
    mine: (email.ownerUserId ?? '') === (currentUser?.id ?? ''),
  }))
  const filteredScheduledEmails = scheduledEmails.filter((email) => queryMatcher({
    from: email.from,
    to: email.to,
    subject: email.subject,
    snippet: email.body.slice(0, 200),
    body: email.body,
    unread: email.isRead === false,
    hasAttachment: (email.attachments?.length ?? 0) > 0,
    tracked: Boolean(email.trackingEnabled),
    opened: (email.openCount ?? 0) > 0,
    clicked: (email.clickCount ?? 0) > 0,
    mine: (email.ownerUserId ?? '') === (currentUser?.id ?? ''),
  }))
  const filteredDraftEmails = draftEmails.filter((email) => queryMatcher({
    from: email.from,
    to: email.to,
    subject: email.subject,
    snippet: email.body.slice(0, 200),
    body: email.body,
    unread: email.isRead === false,
    hasAttachment: (email.attachments?.length ?? 0) > 0,
    tracked: false,
    opened: false,
    clicked: false,
    mine: (email.ownerUserId ?? '') === (currentUser?.id ?? ''),
  }))
  const filteredSnoozedEmails = snoozedEmails.filter((email) => queryMatcher({
    from: email.from,
    to: email.to,
    subject: email.subject,
    snippet: email.body.slice(0, 200),
    body: email.body,
    unread: email.isRead === false,
    hasAttachment: (email.attachments?.length ?? 0) > 0,
    tracked: Boolean(email.trackingEnabled),
    opened: (email.openCount ?? 0) > 0,
    clicked: (email.clickCount ?? 0) > 0,
    mine: (email.ownerUserId ?? '') === (currentUser?.id ?? ''),
  }))
  const selectedThread = threads.find((th) => th.id === selectedThreadId) ?? null
  const selectedEmail = mailboxEmails.find((e) => e.id === selectedEmailId) ?? null

  const threadMatchById = useMemo(() => {
    const byId = new Map<string, ThreadMatch>()
    const contactsByEmail = new Map(contacts.filter((c) => !!c.email).map((c) => [c.email.toLowerCase(), c] as const))
    const companyById = new Map(companies.map((c) => [c.id, c] as const))
    const companyByDomain = new Map(
      companies.filter((c) => !!c.domain).map((c) => [c.domain.toLowerCase(), c] as const),
    )

    for (const thread of threads) {
      const addresses = thread.messages.flatMap((msg) => [extractEmail(msg.from), ...msg.to.split(',').map((p) => extractEmail(p))]).filter(Boolean)
      const uniqueAddresses = [...new Set(addresses)]
      const matchedContact = uniqueAddresses.map((addr) => contactsByEmail.get(addr)).find(Boolean)

      let companyId = matchedContact?.companyId
      if (!companyId) {
        const domainMatchedCompany = uniqueAddresses
          .map((addr) => emailDomain(addr))
          .map((domain) => companyByDomain.get(domain))
          .find(Boolean)
        companyId = domainMatchedCompany?.id
      }

      const relatedDeal = deals.find((d) =>
        (matchedContact && d.contactId === matchedContact.id) ||
        (companyId && d.companyId === companyId),
      )

      byId.set(thread.id, {
        contact: matchedContact,
        companyId,
        companyName: companyId ? companyById.get(companyId)?.name : undefined,
        dealId: relatedDeal?.id,
        dealTitle: relatedDeal?.title,
      })
    }
    return byId
  }, [threads, contacts, companies, deals])

  const persistedThreadMatchById = useMemo(() => {
    const byId = new Map<string, ThreadMatch>()
    for (const [threadId, link] of Object.entries(threadLinks)) {
      const contact = link.contactId ? contacts.find((c) => c.id === link.contactId) : undefined
      const companyId = link.companyId ?? contact?.companyId
      byId.set(threadId, {
        contact,
        companyId: companyId ?? undefined,
        companyName: companyId ? companies.find((c) => c.id === companyId)?.name : undefined,
        dealId: link.dealId ?? undefined,
        dealTitle: link.dealId ? deals.find((d) => d.id === link.dealId)?.title : undefined,
      })
    }
    return byId
  }, [threadLinks, contacts, companies, deals])

  const selectedThreadMatch = selectedThread
    ? (persistedThreadMatchById.get(selectedThread.id) ?? threadMatchById.get(selectedThread.id) ?? null)
    : null
  const selectedThreadLink = selectedThread ? (threadLinks[selectedThread.id] ?? null) : null
  const selectedWorkspace = selectedThread ? (threadWorkspace[selectedThread.id] ?? null) : null
  const selectedThreadLinkedEmails = selectedThread
    ? mailboxEmails.filter((e) => e.gmailThreadId === selectedThread.id)
    : []

  const inboxThreadsVisible = filteredThreads.filter((thread) => {
    if (inboxQuickFilter === 'all') return true
    if (inboxQuickFilter === 'unread') {
      const lastMsg = thread.messages[thread.messages.length - 1]
      return Boolean(lastMsg?.labelIds?.includes('UNREAD'))
    }
    if (inboxQuickFilter === 'mine') {
      return (threadWorkspace[thread.id]?.ownerUserId ?? '') === (currentUser?.id ?? '')
    }
    const match = persistedThreadMatchById.get(thread.id) ?? threadMatchById.get(thread.id)
    if (!Boolean(match?.contact || match?.companyId || match?.dealId)) return false
    return true
  }).filter((thread) => {
    const lastMsg = thread.messages[thread.messages.length - 1]
    const hasAttachment = thread.messages.some((message) => (message.attachments?.length ?? 0) > 0)
    const linked = Boolean((persistedThreadMatchById.get(thread.id) ?? threadMatchById.get(thread.id))?.contact
      || (persistedThreadMatchById.get(thread.id) ?? threadMatchById.get(thread.id))?.companyId
      || (persistedThreadMatchById.get(thread.id) ?? threadMatchById.get(thread.id))?.dealId)
    const mine = (threadWorkspace[thread.id]?.ownerUserId ?? '') === (currentUser?.id ?? '')
    if (advancedFilters.unreadOnly && !lastMsg?.labelIds?.includes('UNREAD')) return false
    if (advancedFilters.linkedOnly && !linked) return false
    if (advancedFilters.mineOnly && !mine) return false
    if (advancedFilters.hasAttachments && !hasAttachment) return false
    return true
  })

  const applyEmailQuickFilter = (items: CRMEmail[]) => items.filter((email) => {
    if (emailQuickFilter === 'all') return true
    if (emailQuickFilter === 'tracked') return Boolean(email.trackingEnabled)
    if (emailQuickFilter === 'opened') return (email.openCount ?? 0) > 0
    if ((email.clickCount ?? 0) <= 0) return false
    return true
  }).filter((email) => {
    if (advancedFilters.tracking === 'tracked' && !email.trackingEnabled) return false
    if (advancedFilters.tracking === 'opened' && (email.openCount ?? 0) <= 0) return false
    if (advancedFilters.tracking === 'clicked' && (email.clickCount ?? 0) <= 0) return false
    return true
  })

  const sentEmailsVisible = applyEmailQuickFilter(filteredSentEmails)
  const scheduledEmailsVisible = applyEmailQuickFilter(filteredScheduledEmails)
  const draftEmailsVisible = filteredDraftEmails
  const snoozedEmailsVisible = applyEmailQuickFilter(filteredSnoozedEmails)
  const localFolderVisibleEmails = useMemo(() => {
    if (folder === 'sent') return sentEmailsVisible
    if (folder === 'scheduled') return scheduledEmailsVisible
    if (folder === 'drafts') return draftEmailsVisible
    if (folder === 'snoozed') return snoozedEmailsVisible
    return []
  }, [folder, sentEmailsVisible, scheduledEmailsVisible, draftEmailsVisible, snoozedEmailsVisible])
  const isSyncStale = !!threadsLastSyncedAt && Date.now() - new Date(threadsLastSyncedAt).getTime() > 10 * 60 * 1000
  const syncVisualState = syncState === 'error' ? 'error' : (syncState === 'syncing' ? 'syncing' : (isSyncStale ? 'stale' : 'healthy'))
  const syncText = syncVisualState === 'syncing'
    ? t.inbox.syncSyncing
    : syncVisualState === 'error'
      ? t.inbox.syncError
      : syncVisualState === 'stale'
        ? t.inbox.syncStale
        : t.inbox.syncHealthy

  const applyInboxSavedView = (viewId: string) => {
    setSelectedInboxViewId(viewId)
    const view = inboxViews.find((item) => item.id === viewId)
    if (!view) return
    setListQuery(view.query)
    setAdvancedFilters(view.filters)
  }

  const saveCurrentInboxView = () => {
    if (!newInboxViewName.trim()) return
    const created = addInboxView(newInboxViewName, listQuery, advancedFilters)
    setSelectedInboxViewId(created.id)
    setNewInboxViewName('')
    toast.success(t.inbox.savedViewCreated)
  }

  const openReply = (to: string, subject: string) => {
    setReplyTo({ to, subject })
    setComposerOpen(true)
  }

  const toggleBulkThread = (threadId: string) => {
    setSelectedThreadIds((prev) => {
      const next = new Set(prev)
      if (next.has(threadId)) next.delete(threadId)
      else next.add(threadId)
      return next
    })
  }

  const toggleBulkLocalEmail = (emailId: string) => {
    setSelectedLocalEmailIds((prev) => {
      const next = new Set(prev)
      if (next.has(emailId)) next.delete(emailId)
      else next.add(emailId)
      return next
    })
  }

  const selectAllVisibleLocalEmails = () => {
    setSelectedLocalEmailIds(new Set(localFolderVisibleEmails.map((e) => e.id)))
  }

  const clearLocalBulkSelection = () => setSelectedLocalEmailIds(new Set())

  const applyBulkLocalEmailAction = (
    action: 'mark_read' | 'mark_unread' | 'delete' | 'snooze_1h' | 'snooze_1d' | 'snooze_1w',
  ) => {
    if (!selectedLocalEmailIds.size) return
    const ids = [...selectedLocalEmailIds]
    const store = useEmailStore.getState()
    let applied = 0
    for (const id of ids) {
      const email = mailboxEmails.find((e) => e.id === id)
      if (!email) continue
      if (action === 'delete' && !canDeleteEmails) continue
      applied += 1
      if (action === 'mark_read') {
        store.updateEmail(id, { isRead: true })
      } else if (action === 'mark_unread') {
        store.updateEmail(id, { isRead: false })
      } else if (action === 'delete') {
        deleteEmail(id)
        if (selectedEmailId === id) setSelectedEmailId(null)
      } else {
        const ms =
          action === 'snooze_1h'
            ? 60 * 60 * 1000
            : action === 'snooze_1d'
              ? 24 * 60 * 60 * 1000
              : 7 * 24 * 60 * 60 * 1000
        snoozeEmail(id, new Date(Date.now() + ms).toISOString())
      }
    }
    setSelectedLocalEmailIds(new Set())
    if (!applied) return
    toast.success(t.inbox.appliedToMessages.replace('{n}', String(applied)))
  }

  const applyBulkThreadAction = async (action: 'mark_read' | 'mark_unread' | 'archive' | 'trash') => {
    if (!selectedThreadIds.size) return
    try {
      const ids = [...selectedThreadIds]
      await refreshAndRetry(async (token) => {
        await Promise.all(ids.map((threadId) => {
          if (action === 'mark_read') {
            return modifyGmailThreadLabels(token, threadId, { removeLabelIds: ['UNREAD'] })
          }
          if (action === 'mark_unread') {
            return modifyGmailThreadLabels(token, threadId, { addLabelIds: ['UNREAD'] })
          }
          if (action === 'archive') {
            return modifyGmailThreadLabels(token, threadId, { removeLabelIds: ['INBOX'] })
          }
          return trashGmailThread(token, threadId)
        }))
      })

      setSelectedThreadIds(new Set())
      setSelectedThreadId(null)
      await handleLoadThreads(listQuery)
      toast.success(t.inbox.appliedToThreads.replace('{n}', String(ids.length)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.errors.gmailConnectionError)
    }
  }

  const openReplyAll = (thread: GmailThread, messageIndex: number) => {
    const msg = thread.messages[messageIndex]
    if (!msg) return
    const currentMailbox = (gmailAddress ?? '').toLowerCase().trim()
    const recipients = [
      ...parseEmails(msg.from),
      ...parseEmails(msg.to),
      ...parseEmails(msg.cc ?? ''),
    ].filter((email, idx, arr) => email !== currentMailbox && arr.indexOf(email) === idx)
    openReply(recipients.join(', '), `Re: ${msg.subject}`)
  }

  const runThreadAction = async (thread: GmailThread, action: 'mark_read' | 'mark_unread' | 'archive' | 'trash') => {
    try {
      await refreshAndRetry(async (token) => {
        if (action === 'mark_read') {
          await modifyGmailThreadLabels(token, thread.id, { removeLabelIds: ['UNREAD'] })
          return
        }
        if (action === 'mark_unread') {
          await modifyGmailThreadLabels(token, thread.id, { addLabelIds: ['UNREAD'] })
          return
        }
        if (action === 'archive') {
          await modifyGmailThreadLabels(token, thread.id, { removeLabelIds: ['INBOX'] })
          return
        }
        await trashGmailThread(token, thread.id)
      })
      await handleLoadThreads(listQuery)
      toast.success(`${t.inbox.threadUpdated}: ${action}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.errors.gmailConnectionError)
    }
  }

  const handleDisconnectGmail = async () => {
    if (!supabase) {
      clearGmailToken()
      disconnectGmail()
      return
    }
    setDisconnecting(true)
    try {
      const { error } = await supabase.functions.invoke('gmail-disconnect')
      if (error) throw error
      clearGmailToken()
      disconnectGmail()
      toast.success(t.settings.gmailDisconnected)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.inbox.disconnectError)
    } finally {
      setDisconnecting(false)
    }
  }

  const createFollowUpFromThread = (thread: GmailThread, match: ThreadMatch | null) => {
    const lastSubject = thread.messages[thread.messages.length - 1]?.subject ?? thread.messages[0]?.subject ?? 'Email follow-up'
    addActivity({
      type: 'task',
      subject: `${t.followUps.title}: ${lastSubject}`,
      description: `Auto-created from Gmail thread ${thread.id}`,
      status: 'pending',
      contactId: match?.contact?.id,
      companyId: match?.companyId,
      dealId: match?.dealId,
      createdBy: '',
    })
    toast.success(t.inbox.followUpCreated)
  }

  const pinThreadLink = (thread: GmailThread, match: ThreadMatch | null) => {
    if (!match || (!match.contact?.id && !match.companyId && !match.dealId)) {
      toast.error(t.inbox.noEntityToPin)
      return
    }

    setThreadLink({
      threadId: thread.id,
      contactId: match.contact?.id,
      companyId: match.companyId,
      dealId: match.dealId,
      source: 'manual',
    })
    toast.success(t.inbox.pinnedLink)
  }

  const unpinThreadLink = (thread: GmailThread) => {
    clearThreadLink(thread.id)
    toast.success(t.inbox.pinnedLinkRemoved)
  }

  const saveManualThreadLink = (thread: GmailThread, contactId?: string, dealId?: string) => {
    const deal = dealId ? deals.find((d) => d.id === dealId) : undefined
    const contact = contactId ? contacts.find((c) => c.id === contactId) : undefined
    setThreadLink({
      threadId: thread.id,
      contactId: contact?.id,
      dealId: deal?.id,
      companyId: deal?.companyId ?? contact?.companyId,
      source: 'manual',
    })
    toast.success(t.inbox.manualLinkSaved)
  }

  const handleDownloadAttachment = async (messageId: string, attachmentId: string, filename: string) => {
    try {
      await refreshAndRetry(async (token) => {
        const { data } = await downloadGmailAttachment(token, messageId, attachmentId)
        const bytes = atob(data.replace(/-/g, '+').replace(/_/g, '/'))
        const arr = new Uint8Array(bytes.length)
        for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i)
        const blob = new Blob([arr])
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename || 'attachment'
        a.click()
        URL.revokeObjectURL(url)
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.inbox.downloadAttachmentError)
    }
  }

  return (
    <div className="flex h-full overflow-hidden p-4 gap-3">
      {/* ── Left: Folders ────────────────────────────────────────────────── */}
      <div className="w-52 flex-shrink-0 border border-white/8 rounded-2xl overflow-hidden flex flex-col bg-navy-900/50">
        <div className="p-3 border-b border-white/6">
          <PermissionGate permission="email:send">
            <button
              onClick={() => {
                setSelectedEmailId(null)
                setSelectedThreadId(null)
                setComposerOpen(true)
                setReplyTo(null)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl btn-gradient text-white text-xs font-semibold"
            >
              <Plus size={13} />
              {t.inbox.compose}
            </button>
          </PermissionGate>
        </div>

        {/* Connection status */}
        <div className="px-3 py-2 border-b border-white/6">
          {connected ? (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Wifi size={11} className="text-emerald-400" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-emerald-400 truncate">{gmailAddress ?? 'Gmail'}</p>
              </div>
              <button
                onClick={handleDisconnectGmail}
                disabled={disconnecting}
                className="text-slate-600 hover:text-red-400 transition-colors"
                title={t.settings.disconnect}
                aria-label={t.settings.disconnect}
              >
                {disconnecting ? <Loader2 size={10} className="animate-spin" /> : <WifiOff size={10} />}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGmail}
              disabled={connecting}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/4 hover:bg-brand-600/15 border border-white/8 hover:border-brand-500/30 text-slate-500 hover:text-brand-400 transition-colors text-[10px] font-medium"
            >
              {connecting ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
              {t.settings.connect} Gmail
            </button>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {FOLDERS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFolder(f.id as 'inbox' | 'sent' | 'scheduled' | 'drafts' | 'snoozed')
                setSelectedThreadId(null)
                setSelectedEmailId(null)
                setSelectedThreadIds(new Set())
                setSelectedLocalEmailIds(new Set())
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                folder === f.id
                  ? 'nav-active text-white'
                  : 'text-slate-500 hover:text-white hover:bg-white/4'
              }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Center: Email list ───────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 border border-white/8 rounded-2xl overflow-hidden flex flex-col bg-navy-900/35">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/6 flex-shrink-0">
          <div>
            <span className="text-sm font-semibold text-white capitalize">{FOLDERS.find((f) => f.id === folder)?.label}</span>
            {folder === 'inbox' && threadsLastSyncedAt && (
              <p className="text-[10px] text-slate-600 mt-0.5">
                {t.common.updatedAt}: {formatDateTime(threadsLastSyncedAt)}
                {threadsHistoryId ? ` · h:${threadsHistoryId}` : ''}
              </p>
            )}
          </div>
          {connected && folder === 'inbox' && (
            <button
              onClick={() => handleLoadThreads()}
              disabled={threadsLoading}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/6 transition-colors"
              title={t.inbox.refreshInbox}
              aria-label={t.inbox.refreshInbox}
            >
              <RefreshCw size={13} className={threadsLoading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
        {folder === 'inbox' && connected && selectedThreadIds.size > 0 && (
          <div className="px-3 py-2 border-b border-white/6 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 mr-1">{t.inbox.selectedCount.replace('{n}', String(selectedThreadIds.size))}</span>
            <button
              onClick={() => applyBulkThreadAction('mark_read')}
              className="text-[10px] px-2 py-1 rounded-full bg-white/6 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors"
            >
              {t.inbox.markRead}
            </button>
            <button
              onClick={() => applyBulkThreadAction('mark_unread')}
              className="text-[10px] px-2 py-1 rounded-full bg-white/6 text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors"
            >
              {t.inbox.markUnread}
            </button>
            <button
              onClick={() => applyBulkThreadAction('archive')}
              className="text-[10px] px-2 py-1 rounded-full bg-white/6 text-slate-300 hover:bg-amber-500/20 hover:text-amber-300 transition-colors"
            >
              {t.inbox.archive}
            </button>
            <button
              onClick={() => applyBulkThreadAction('trash')}
              className="text-[10px] px-2 py-1 rounded-full bg-white/6 text-slate-300 hover:bg-red-500/20 hover:text-red-300 transition-colors"
            >
              {t.inbox.trash}
            </button>
          </div>
        )}
        {(folder === 'sent' || folder === 'scheduled' || folder === 'drafts' || folder === 'snoozed') && selectedLocalEmailIds.size > 0 && (
          <div className="px-3 py-2 border-b border-white/6 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 mr-1">{t.inbox.selectedCount.replace('{n}', String(selectedLocalEmailIds.size))}</span>
            <button
              type="button"
              onClick={() => applyBulkLocalEmailAction('mark_read')}
              className="text-[10px] px-2 py-1 rounded-full bg-white/6 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors"
            >
              {t.inbox.markRead}
            </button>
            <button
              type="button"
              onClick={() => applyBulkLocalEmailAction('mark_unread')}
              className="text-[10px] px-2 py-1 rounded-full bg-white/6 text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors"
            >
              {t.inbox.markUnread}
            </button>
            <button
              type="button"
              onClick={() => applyBulkLocalEmailAction('snooze_1h')}
              className="text-[10px] px-2 py-1 rounded-full bg-white/6 text-slate-300 hover:bg-violet-500/20 hover:text-violet-300 transition-colors"
            >
              Snooze 1h
            </button>
            <button
              type="button"
              onClick={() => applyBulkLocalEmailAction('snooze_1d')}
              className="text-[10px] px-2 py-1 rounded-full bg-white/6 text-slate-300 hover:bg-violet-500/20 hover:text-violet-300 transition-colors"
            >
              {t.inbox.snoozeOneDay}
            </button>
            <button
              type="button"
              onClick={() => applyBulkLocalEmailAction('snooze_1w')}
              className="text-[10px] px-2 py-1 rounded-full bg-white/6 text-slate-300 hover:bg-violet-500/20 hover:text-violet-300 transition-colors"
            >
              Snooze 1w
            </button>
            {canDeleteEmails && (
              <button
                type="button"
                onClick={() => applyBulkLocalEmailAction('delete')}
                className="text-[10px] px-2 py-1 rounded-full bg-white/6 text-slate-300 hover:bg-red-500/20 hover:text-red-300 transition-colors"
              >
                {t.common.bulkDelete}
              </button>
            )}
            <button
              type="button"
              onClick={selectAllVisibleLocalEmails}
              disabled={localFolderVisibleEmails.length === 0}
              className="text-[10px] px-2 py-1 rounded-full bg-white/6 text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              {t.common.selectAll}
            </button>
            <button
              type="button"
              onClick={clearLocalBulkSelection}
              className="text-[10px] px-2 py-1 rounded-full bg-white/6 text-slate-300 hover:bg-white/10 transition-colors"
            >
              {t.common.clear}
            </button>
          </div>
        )}
        <div className="px-3 py-2 border-b border-white/6">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder={t.inbox.searchPlaceholder}
              className="w-full bg-[#0d0e1a] border border-white/8 rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-brand-500/40"
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-600">{t.inbox.searchOperatorsHint}</p>
        </div>
        {folder === 'inbox' && (
          <div className="px-3 py-2 border-b border-white/6 flex flex-wrap gap-1.5">
            {([
              ['all', t.common.all],
              ['unread', t.notifications.unread],
              ['linked', t.inbox.pinnedLink],
              ['mine', t.common.assignedTo],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setInboxQuickFilter(id)}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                  inboxQuickFilter === id
                    ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                    : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setAdvancedFilters((prev) => ({ ...prev, hasAttachments: !prev.hasAttachments }))}
              className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                advancedFilters.hasAttachments
                  ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                  : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-300'
              }`}
            >
              {t.inbox.hasAttachments}
            </button>
            <button
              onClick={() => setAdvancedFilters((prev) => ({ ...prev, mineOnly: !prev.mineOnly }))}
              className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                advancedFilters.mineOnly
                  ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                  : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-300'
              }`}
            >
              {t.inbox.onlyMine}
            </button>
          </div>
        )}
        {folder === 'inbox' && (
          <div className="px-3 py-2 border-b border-white/6 space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={selectedInboxViewId}
                onChange={(e) => applyInboxSavedView(e.target.value)}
                className="flex-1 bg-[#0d0e1a] border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200"
              >
                <option value="">{t.inbox.savedViews}</option>
                {inboxViews.map((view) => (
                  <option key={view.id} value={view.id}>{view.name}</option>
                ))}
              </select>
              {selectedInboxViewId && (
                <button
                  onClick={() => {
                    deleteInboxView(selectedInboxViewId)
                    setSelectedInboxViewId('')
                  }}
                  className="text-[10px] px-2 py-1 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30"
                >
                  {t.common.delete}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={newInboxViewName}
                onChange={(e) => setNewInboxViewName(e.target.value)}
                placeholder={t.inbox.savedViewNamePlaceholder}
                className="flex-1 bg-[#0d0e1a] border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200"
              />
              <button
                onClick={saveCurrentInboxView}
                className="text-[10px] px-2 py-1 rounded-lg bg-brand-500/15 text-brand-300 border border-brand-500/30"
              >
                {t.common.save}
              </button>
            </div>
          </div>
        )}
        {(folder === 'sent' || folder === 'scheduled') && (
          <div className="px-3 py-2 border-b border-white/6 flex flex-wrap gap-1.5">
            {([
              ['all', t.common.all],
              ['tracked', t.followUps.title],
              ['opened', t.common.view],
              ['clicked', t.inbox.clicks],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setEmailQuickFilter(id)}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                  emailQuickFilter === id
                    ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                    : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Inbox: Gmail threads */}
          {folder === 'inbox' && (
            <>
              {!connected && (
                <div className="p-6 text-center">
                  <Mail size={28} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500 mb-1">{t.settings.disconnected} Gmail</p>
                  <p className="text-xs text-slate-600">{t.settings.connect} Gmail</p>
                </div>
              )}
              {connected && threadsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="text-brand-400 animate-spin" />
                </div>
              )}
              {connected && !threadsLoading && inboxThreadsVisible.length === 0 && (
                <div className="p-6 text-center text-slate-600 text-sm">{t.inbox.noMessages}</div>
              )}
              {connected && (
                <div className="mx-3 mt-3 p-2 rounded-lg border border-white/8 bg-white/4 text-[11px] text-slate-300">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full mr-2 ${
                    syncVisualState === 'healthy'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : syncVisualState === 'syncing'
                        ? 'bg-brand-500/15 text-brand-300'
                        : syncVisualState === 'stale'
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-red-500/15 text-red-300'
                  }`}>
                    {syncText}
                  </span>
                  {lastSyncErrorMessage && syncVisualState === 'error' ? `${lastSyncErrorMessage}` : null}
                  {lastSyncErrorAt && syncVisualState === 'error' ? ` · ${formatDateTime(lastSyncErrorAt)}` : null}
                </div>
              )}
              {connected && threadsError && !threadsLoading && (
                <div className="mx-3 my-3 p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-[11px] text-red-300">
                  {threadsError}
                </div>
              )}
              {connected && inboxThreadsVisible.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  selected={selectedThreadId === thread.id}
                  bulkSelected={selectedThreadIds.has(thread.id)}
                  onClick={() => { setSelectedThreadId(thread.id); setSelectedEmailId(null) }}
                  onToggleBulk={() => toggleBulkThread(thread.id)}
                  contactByEmail={contactByEmail}
                />
              ))}
              {connected && !threadsLoading && !!threadsNextPageToken && (
                <div className="p-3 border-t border-white/6">
                  <button
                    onClick={handleLoadMoreThreads}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white/6 hover:bg-white/10 text-slate-300 transition-colors"
                  >
                    {t.inbox.loadMore}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Sent: local emails */}
          {folder === 'sent' && (
            <>
              {sentEmailsVisible.length === 0 && (
                <div className="p-6 text-center">
                  <Send size={28} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500">{t.inbox.noMessages}</p>
                </div>
              )}
              {sentEmailsVisible.map((email) => (
                <LocalEmailItem
                  key={email.id}
                  email={email}
                  selected={selectedEmailId === email.id}
                  bulkSelected={selectedLocalEmailIds.has(email.id)}
                  onToggleBulk={() => toggleBulkLocalEmail(email.id)}
                  onClick={() => {
                    useEmailStore.getState().updateEmail(email.id, { isRead: true })
                    setSelectedEmailId(email.id)
                    setSelectedThreadId(null)
                  }}
                  onAction={handleLocalEmailAction}
                  contacts={contacts}
                  onTrackOpen={trackEmailOpen}
                  onTrackClick={trackEmailClick}
                />
              ))}
            </>
          )}
          {folder === 'scheduled' && (
            <>
              {scheduledEmailsVisible.length === 0 && (
                <div className="p-6 text-center">
                  <Clock size={28} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500">{t.inbox.noMessages}</p>
                </div>
              )}
              {scheduledEmailsVisible.map((email) => (
                <LocalEmailItem
                  key={email.id}
                  email={email}
                  selected={selectedEmailId === email.id}
                  bulkSelected={selectedLocalEmailIds.has(email.id)}
                  onToggleBulk={() => toggleBulkLocalEmail(email.id)}
                  onClick={() => {
                    useEmailStore.getState().updateEmail(email.id, { isRead: true })
                    setSelectedEmailId(email.id)
                    setSelectedThreadId(null)
                  }}
                  onAction={handleLocalEmailAction}
                  contacts={contacts}
                  onTrackOpen={trackEmailOpen}
                  onTrackClick={trackEmailClick}
                />
              ))}
            </>
          )}
          {folder === 'drafts' && (
            <>
              {draftEmailsVisible.length === 0 && (
                <div className="p-6 text-center">
                  <Mail size={28} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500">{t.inbox.noMessages}</p>
                </div>
              )}
              {draftEmailsVisible.map((email) => (
                <LocalEmailItem
                  key={email.id}
                  email={email}
                  selected={selectedEmailId === email.id}
                  bulkSelected={selectedLocalEmailIds.has(email.id)}
                  onToggleBulk={() => toggleBulkLocalEmail(email.id)}
                  onClick={() => {
                    useEmailStore.getState().updateEmail(email.id, { isRead: true })
                    setSelectedEmailId(email.id)
                    setSelectedThreadId(null)
                  }}
                  onAction={handleLocalEmailAction}
                  contacts={contacts}
                  onTrackOpen={trackEmailOpen}
                  onTrackClick={trackEmailClick}
                />
              ))}
            </>
          )}
          {folder === 'snoozed' && (
            <>
              {snoozedEmailsVisible.length === 0 && (
                <div className="p-6 text-center">
                  <Clock size={28} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500">{t.inbox.noMessages}</p>
                </div>
              )}
              {snoozedEmailsVisible.map((email) => (
                <LocalEmailItem
                  key={email.id}
                  email={email}
                  selected={selectedEmailId === email.id}
                  bulkSelected={selectedLocalEmailIds.has(email.id)}
                  onToggleBulk={() => toggleBulkLocalEmail(email.id)}
                  onClick={() => {
                    useEmailStore.getState().updateEmail(email.id, { isRead: true })
                    setSelectedEmailId(email.id)
                    setSelectedThreadId(null)
                  }}
                  onAction={handleLocalEmailAction}
                  contacts={contacts}
                  onTrackOpen={trackEmailOpen}
                  onTrackClick={trackEmailClick}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Right: Email/Thread view ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden border border-white/8 rounded-2xl bg-navy-900/25">
        {folder === 'inbox' && selectedThread && (
          <div className="px-3 py-2 border-b border-white/6 flex items-center gap-2 flex-wrap">
            <select
              aria-label={t.common.assignedTo}
              value={selectedWorkspace?.ownerUserId ?? ''}
              onChange={(e) => setThreadOwner(selectedThread.id, e.target.value || undefined)}
              className="bg-[#0d0e1a] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300"
            >
              <option value="">{t.common.assignedTo}</option>
              {orgUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <input
              value={selectedWorkspace?.internalNote ?? ''}
              onChange={(e) => setThreadNote(selectedThread.id, e.target.value)}
              placeholder={t.common.notes}
              className="flex-1 min-w-[220px] bg-[#0d0e1a] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-600"
            />
          </div>
        )}
        {folder === 'inbox' ? (
          <ThreadView
            thread={selectedThread}
            match={selectedThreadMatch}
            linkSource={selectedThreadLink?.source ?? (selectedThreadMatch ? 'auto' : null)}
            hasPersistedLink={!!selectedThreadLink}
            linkedEmails={selectedThreadLinkedEmails}
            onReply={openReply}
            onReplyAll={openReplyAll}
            onCreateFollowUp={createFollowUpFromThread}
            onThreadAction={runThreadAction}
            onPinLink={pinThreadLink}
            onUnpinLink={unpinThreadLink}
            onManualLinkSave={saveManualThreadLink}
            onDownloadAttachment={handleDownloadAttachment}
            allContacts={contacts}
            allDeals={deals.map((d) => ({ id: d.id, title: d.title }))}
            canEditLinks={canLinkEmails}
            canCreateFollowUp={canCreateActivities}
          />
        ) : (
          <>
            <LocalEmailView
              email={selectedEmail}
              contacts={contacts}
              onReply={openReply}
              onEmailAction={handleLocalEmailAction}
              onTrackOpen={trackEmailOpen}
              onTrackClick={trackEmailClick}
              canDeleteEmails={canDeleteEmails}
            />
            {selectedEmail && folder !== 'snoozed' && (
              <div className="px-3 py-2 border-t border-white/6">
                {folder === 'scheduled' && selectedEmail.undoableUntil && new Date(selectedEmail.undoableUntil).getTime() > Date.now() && (
                  <button
                    onClick={() => {
                      deleteEmail(selectedEmail.id)
                      setSelectedEmailId(null)
                      toast.success(t.email.undoSendSuccess)
                    }}
                    className="mr-2 text-xs px-3 py-1.5 rounded-lg border border-amber-400/40 bg-amber-500/12 text-amber-200 hover:bg-amber-500/20 transition-colors"
                  >
                    {t.email.undoSend}
                  </button>
                )}
                <button
                  onClick={() => {
                    snoozeEmail(selectedEmail.id, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
                    toast.success(t.inbox.snoozed)
                    setFolder('snoozed')
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/6 text-slate-300 hover:bg-white/10 transition-colors"
                >
                  {t.inbox.snoozeOneDay}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Composer */}
      <EmailComposer
        isOpen={composerOpen}
        onClose={() => { setComposerOpen(false); setReplyTo(null) }}
        defaultTo={replyTo?.to ?? ''}
        defaultSubject={replyTo?.subject ?? ''}
        draftId={folder === 'drafts' ? selectedEmail?.id : undefined}
        defaultBody={folder === 'drafts' ? selectedEmail?.body ?? '' : ''}
      />
    </div>
  )
}
