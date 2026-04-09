import { useState, useEffect, useMemo } from 'react'
import { Mail, Send, Inbox as InboxIcon, Loader2, RefreshCw, Wifi, WifiOff, User, Clock, Reply, Trash2, Plus, Eye, MousePointerClick } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEmailStore } from '../store/emailStore'
import { useContactsStore } from '../store/contactsStore'
import { initiateGmailOAuth } from '../services/gmailService'
import { useGmailToken } from '../contexts/GmailTokenContext'
import { supabase } from '../lib/supabase'
import { useSettingsStore } from '../store/settingsStore'
import { EmailComposer } from '../components/email/EmailComposer'
import { toast } from '../store/toastStore'
import { PermissionGate } from '../components/auth/PermissionGate'
import { useTranslations } from '../i18n'
import type { GmailThread, CRMEmail, Contact } from '../types'
import { formatRelativeDate } from '../utils/formatters'

// ─── Thread item ──────────────────────────────────────────────────────────────
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return (match ? match[1] : from).toLowerCase().trim()
}

function ThreadItem({
  thread,
  selected,
  onClick,
  contactByEmail,
}: {
  thread: GmailThread
  selected: boolean
  onClick: () => void
  contactByEmail: Map<string, { id: string; name: string }>
}) {
  const lastMsg = thread.messages[thread.messages.length - 1]
  const isUnread = lastMsg?.labelIds?.includes('UNREAD')
  const senderEmail = extractEmail(lastMsg?.from ?? '')
  const matchedContact = contactByEmail.get(senderEmail)

  return (
    <div
      onClick={onClick}
      className={`px-4 py-3 border-b border-white/4 cursor-pointer transition-colors ${
        selected ? 'bg-brand-600/10 border-l-2 border-l-brand-500' : 'hover:bg-white/4'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand-400">
          {(lastMsg?.from?.charAt(0) ?? '?').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className={`text-sm truncate ${isUnread ? 'font-semibold text-white' : 'text-slate-300'}`}>
              {lastMsg?.from?.replace(/<.*>/, '').trim() ?? 'Unknown'}
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
          Click {email.clickCount}x
        </span>
      )}
    </div>
  )
}

// ─── Local email item ─────────────────────────────────────────────────────────
function LocalEmailItem({
  email,
  selected,
  onClick,
  contacts,
  onTrackOpen,
  onTrackClick,
}: {
  email: CRMEmail
  selected: boolean
  onClick: () => void
  contacts: Contact[]
  onTrackOpen: (id: string) => void
  onTrackClick: (id: string) => void
}) {
  const t = useTranslations()
  const contact = email.contactId ? contacts.find((c) => c.id === email.contactId) : undefined

  return (
    <div
      onClick={onClick}
      className={`px-4 py-3 border-b border-white/4 cursor-pointer transition-colors ${
        selected ? 'bg-brand-600/10 border-l-2 border-l-brand-500' : 'hover:bg-white/4'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0">
          <User size={14} className="text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className="text-sm text-slate-300 truncate">
              {contact ? `${contact.firstName} ${contact.lastName}` : email.to.join(', ')}
            </p>
            <span className="text-[10px] text-slate-500 flex-shrink-0">
              {formatRelativeDate(email.sentAt ?? email.createdAt)}
            </span>
          </div>
          <p className="text-xs text-white truncate">{email.subject || ''}</p>
          <p className="text-[10px] text-slate-600 truncate mt-0.5">{email.body.slice(0, 80)}</p>
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
                Click
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Thread view ──────────────────────────────────────────────────────────────
function ThreadView({
  thread,
  onReply,
}: {
  thread: GmailThread | null
  localEmail: CRMEmail | null
  onReply: (to: string, subject: string) => void
}) {
  const t = useTranslations()
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
                <span className="text-xs">{msg.date ? new Date(msg.date).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</span>
                <button
                  onClick={() => onReply(msg.from, `Re: ${msg.subject}`)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/6 hover:bg-brand-600/20 hover:text-brand-400 transition-colors"
                >
                  <Reply size={11} />
                  {t.common.back}
                </button>
              </div>
            </div>
            <div className="px-4 py-4">
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{msg.body || msg.snippet}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── LocalEmailView ────────────────────────────────────────────────────────────
function LocalEmailView({ email, contacts, onReply, onDelete, onTrackOpen, onTrackClick }: {
  email: CRMEmail | null
  contacts: Contact[]
  onReply: (to: string, subject: string) => void
  onDelete: (id: string) => void
  onTrackOpen: (id: string) => void
  onTrackClick: (id: string) => void
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => onReply(email.to[0] ?? '', `Re: ${email.subject}`)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/6 hover:bg-brand-600/15 hover:text-brand-400 text-slate-400 transition-colors"
          >
            <Reply size={12} />
            {t.common.back}
          </button>
          <button
            onClick={() => onDelete(email.id)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/6 hover:bg-red-500/15 hover:text-red-400 text-slate-500 transition-colors"
          >
            <Trash2 size={12} />
          </button>
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
                {email.sentAt ? new Date(email.sentAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
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
                    Click
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
  const {
    emails, threads, threadsLoading, isGmailConnected,
    gmailAddress, loadThreads, deleteEmail, disconnectGmail,
    trackEmailOpen, trackEmailClick,
  } = useEmailStore()
  const { accessToken, setGmailToken, clearGmailToken, isTokenValid } = useGmailToken()
  const contacts = useContactsStore((s) => s.contacts)
  const { settings } = useSettingsStore()

  const [folder, setFolder] = useState<'inbox' | 'sent'>('inbox')
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [replyTo, setReplyTo] = useState<{ to: string; subject: string } | null>(null)
  const [connecting, setConnecting] = useState(false)

  const connected = !!gmailAddress && isTokenValid()

  // Build contact email lookup map for thread chip matching
  const contactByEmail = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const c of contacts) {
      if (c.email) map.set(c.email.toLowerCase(), { id: c.id, name: `${c.firstName} ${c.lastName}`.trim() })
    }
    return map
  }, [contacts])

  // 401 refresh+retry wrapper
  async function refreshAndRetry<T>(
    fn: (token: string) => Promise<T>,
    token: string,
  ): Promise<T> {
    try {
      return await fn(token)
    } catch (err) {
      if (err instanceof Error && err.message.includes('401')) {
        const { data, error } = await supabase!.functions.invoke('gmail-refresh-token')
        if (error || !data?.access_token) throw new Error('Token refresh failed — please reconnect Gmail')
        const newExpiry = Date.now() + (data.expires_in ?? 3600) * 1000
        setGmailToken(data.access_token, newExpiry)
        return await fn(data.access_token)
      }
      throw err
    }
  }

  const handleLoadThreads = async (query = '') => {
    if (!accessToken) return
    try {
      await refreshAndRetry(
        (token) => useEmailStore.getState().loadThreads(token, query),
        accessToken,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error loading threads')
    }
  }

  // Folder list built with translations
  const FOLDERS = [
    { id: 'inbox', label: t.inbox.title, icon: <InboxIcon size={15} /> },
    { id: 'sent', label: t.inbox.sent, icon: <Send size={15} /> },
  ]

  // Load gmail threads when connected and token is valid
  useEffect(() => {
    if (connected && folder === 'inbox' && accessToken) {
      handleLoadThreads()
    }
  }, [connected, folder, accessToken])

  const handleConnectGmail = async () => {
    const clientId = (settings as { googleClientId?: string }).googleClientId
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
      toast.error(err instanceof Error ? err.message : 'Error al conectar Gmail')
    }
  }

  const sentEmails = emails.filter((e) => e.status === 'sent')
  const selectedThread = threads.find((th) => th.id === selectedThreadId) ?? null
  const selectedEmail = emails.find((e) => e.id === selectedEmailId) ?? null

  const openReply = (to: string, subject: string) => {
    setReplyTo({ to, subject })
    setComposerOpen(true)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Folders ────────────────────────────────────────────────── */}
      <div className="w-48 flex-shrink-0 border-r border-white/6 flex flex-col bg-navy-900/50">
        <div className="p-3 border-b border-white/6">
          <PermissionGate permission="email:send">
            <button
              onClick={() => { setComposerOpen(true); setReplyTo(null) }}
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
                onClick={() => { clearGmailToken(); disconnectGmail() }}
                className="text-slate-600 hover:text-red-400 transition-colors"
                title={t.settings.disconnect}
              >
                <WifiOff size={10} />
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
              onClick={() => { setFolder(f.id as 'inbox' | 'sent'); setSelectedThreadId(null); setSelectedEmailId(null) }}
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
      <div className="w-72 flex-shrink-0 border-r border-white/6 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/6 flex-shrink-0">
          <span className="text-sm font-semibold text-white capitalize">{FOLDERS.find((f) => f.id === folder)?.label}</span>
          {connected && folder === 'inbox' && (
            <button
              onClick={() => handleLoadThreads()}
              disabled={threadsLoading}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/6 transition-colors"
            >
              <RefreshCw size={13} className={threadsLoading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

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
              {connected && !threadsLoading && threads.length === 0 && (
                <div className="p-6 text-center text-slate-600 text-sm">{t.inbox.noMessages}</div>
              )}
              {connected && threads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  selected={selectedThreadId === thread.id}
                  onClick={() => { setSelectedThreadId(thread.id); setSelectedEmailId(null) }}
                  contactByEmail={contactByEmail}
                />
              ))}
            </>
          )}

          {/* Sent: local emails */}
          {folder === 'sent' && (
            <>
              {sentEmails.length === 0 && (
                <div className="p-6 text-center">
                  <Send size={28} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500">{t.inbox.noMessages}</p>
                </div>
              )}
              {sentEmails.map((email) => (
                <LocalEmailItem
                  key={email.id}
                  email={email}
                  selected={selectedEmailId === email.id}
                  onClick={() => { setSelectedEmailId(email.id); setSelectedThreadId(null) }}
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
      <div className="flex-1 min-w-0 overflow-hidden">
        {folder === 'inbox' ? (
          <ThreadView
            thread={selectedThread}
            localEmail={null}
            onReply={openReply}
          />
        ) : (
          <LocalEmailView
            email={selectedEmail}
            contacts={contacts}
            onReply={openReply}
            onDelete={(id) => { deleteEmail(id); setSelectedEmailId(null); toast.success(t.common.delete) }}
            onTrackOpen={trackEmailOpen}
            onTrackClick={trackEmailClick}
          />
        )}
      </div>

      {/* Composer */}
      <EmailComposer
        isOpen={composerOpen}
        onClose={() => { setComposerOpen(false); setReplyTo(null) }}
        defaultTo={replyTo?.to ?? ''}
        defaultSubject={replyTo?.subject ?? ''}
      />
    </div>
  )
}
