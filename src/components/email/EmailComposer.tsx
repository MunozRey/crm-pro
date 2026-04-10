import { useEffect, useMemo, useState } from 'react'
import { X, Send, ChevronDown, FileText, Eye, Loader2 } from 'lucide-react'
import { useGmailToken } from '../../contexts/GmailTokenContext'
import { useEmailStore } from '../../store/emailStore'
import { useActivitiesStore } from '../../store/activitiesStore'
import { useContactsStore } from '../../store/contactsStore'
import { useDealsStore } from '../../store/dealsStore'
import { useCompaniesStore } from '../../store/companiesStore'
import { useTemplateStore } from '../../store/templateStore'
import { formatCurrency } from '../../utils/formatters'
import { toast } from '../../store/toastStore'
import { useTranslations } from '../../i18n'
import { supabase } from '../../lib/supabase'

interface EmailComposerProps {
  isOpen: boolean
  onClose: () => void
  defaultTo?: string
  defaultSubject?: string
  defaultBody?: string
  contactId?: string
  dealId?: string
  companyId?: string
}

export function EmailComposer({
  isOpen,
  onClose,
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
  contactId,
  dealId,
  companyId,
}: EmailComposerProps) {
  const t = useTranslations()
  const [to, setTo] = useState(defaultTo)
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState(defaultBody)
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [showReplyTo, setShowReplyTo] = useState(false)
  const [sending, setSending] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [trackingEnabled, setTrackingEnabled] = useState(false)
  const [sendLater, setSendLater] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [attachments, setAttachments] = useState<Array<{
    name: string
    mimeType: string
    size: number
    dataBase64: string
  }>>([])

  const { sendEmail, scheduleEmail, isGmailConnected, enableTracking } = useEmailStore()
  const { accessToken } = useGmailToken()
  const contacts = useContactsStore((s) => s.contacts)
  const deals = useDealsStore((s) => s.deals)
  const companies = useCompaniesStore((s) => s.companies)
  const templates = useTemplateStore((s) => s.templates)
  const incrementUsage = useTemplateStore((s) => s.incrementUsage)

  const draftKey = useMemo(
    () => `crm_email_draft:${contactId ?? 'na'}:${dealId ?? 'na'}:${companyId ?? 'na'}:${defaultTo}`,
    [companyId, contactId, dealId, defaultTo],
  )

  useEffect(() => {
    if (!isOpen) return
    const raw = localStorage.getItem(draftKey)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as {
        to?: string
        cc?: string
        bcc?: string
        replyTo?: string
        subject?: string
        body?: string
        attachments?: Array<{ name: string; mimeType: string; size: number; dataBase64: string }>
      }
      setTo(parsed.to ?? defaultTo)
      setCc(parsed.cc ?? '')
      setBcc(parsed.bcc ?? '')
      setReplyTo(parsed.replyTo ?? '')
      setSubject(parsed.subject ?? defaultSubject)
      setBody(parsed.body ?? defaultBody)
      setAttachments(parsed.attachments ?? [])
      setShowCc(!!parsed.cc)
      setShowBcc(!!parsed.bcc)
      setShowReplyTo(!!parsed.replyTo)
    } catch {
      localStorage.removeItem(draftKey)
    }
  }, [defaultBody, defaultSubject, defaultTo, draftKey, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const payload = JSON.stringify({ to, cc, bcc, replyTo, subject, body, attachments })
    localStorage.setItem(draftKey, payload)
  }, [attachments, bcc, body, cc, draftKey, isOpen, replyTo, subject, to])

  if (!isOpen) return null

  const contact = contactId ? contacts.find((c) => c.id === contactId) : undefined
  const deal = dealId ? deals.find((d) => d.id === dealId) : undefined
  const company = companyId ? companies.find((c) => c.id === companyId) : contact?.companyId ? companies.find((c) => c.id === contact.companyId) : undefined

  const hasUnsavedDraft = !!(to.trim() || cc.trim() || bcc.trim() || replyTo.trim() || subject.trim() || body.trim())
  const requestClose = () => {
    if (!hasUnsavedDraft || window.confirm(t.email.discardDraftConfirm)) {
      onClose()
    }
  }

  const applyTemplate = (template: typeof templates[0]) => {
    let subj = template.subject
    let bod = template.body
    const vars: Record<string, string> = {
      '{{firstName}}': contact?.firstName ?? '',
      '{{lastName}}': contact?.lastName ?? '',
      '{{company}}': company?.name ?? '',
      '{{dealTitle}}': deal?.title ?? '',
      '{{dealValue}}': deal ? formatCurrency(deal.value, deal.currency) : '',
      '{{email}}': contact?.email ?? '',
      '{{jobTitle}}': contact?.jobTitle ?? '',
    }
    for (const [key, value] of Object.entries(vars)) {
      subj = subj.replaceAll(key, value)
      bod = bod.replaceAll(key, value)
    }
    setSubject(subj)
    setBody(bod)
    incrementUsage(template.id)
    setShowTemplates(false)
    toast.success(`${t.emailTemplates.title} — "${template.name}"`)
  }

  const CATEGORY_LABELS: Record<string, string> = {
    intro: t.emailTemplates.categoryLabels.intro,
    follow_up: t.emailTemplates.categoryLabels.follow_up,
    proposal: t.emailTemplates.categoryLabels.proposal,
    closing: t.emailTemplates.categoryLabels.closing,
    nurture: t.emailTemplates.categoryLabels.nurture,
    custom: t.emailTemplates.categoryLabels.custom,
  }

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) {
      toast.error(`${t.common.email} & ${t.activities.subject}`)
      return
    }
    setSending(true)
    try {
      const getFreshAccessToken = async (): Promise<string | undefined> => {
        if (accessToken) return accessToken
        if (!supabase) return undefined
        const { data, error } = await supabase.functions.invoke('gmail-refresh-token')
        if (error || !data?.access_token) return undefined
        return data.access_token as string
      }

      const toList = to.split(',').map((e) => e.trim()).filter(Boolean)
      const tokenForSend = connected ? await getFreshAccessToken() : undefined
      const payload = {
        to: toList,
        cc: cc ? cc.split(',').map((e) => e.trim()).filter(Boolean) : undefined,
        bcc: bcc ? bcc.split(',').map((e) => e.trim()).filter(Boolean) : undefined,
        replyTo: replyTo.trim() || undefined,
        attachments,
        subject,
        body,
        contactId,
        dealId,
        companyId,
      }

      const sent = sendLater && scheduledAt
        ? scheduleEmail({ ...payload, runAt: new Date(scheduledAt).toISOString() })
        : await sendEmail({ ...payload, accessToken: tokenForSend })
      localStorage.removeItem(draftKey)
      if (trackingEnabled) {
        enableTracking(sent.id)
      }
      // Log email as activity
      useActivitiesStore.getState().addActivity({
        type: 'email',
        subject,
        description: sendLater && scheduledAt
          ? `Email scheduled to ${toList.join(', ')} (${scheduledAt}): ${subject}`
          : `Email sent to ${toList.join(', ')}: ${subject}`,
        status: 'completed',
        contactId,
        dealId,
        createdBy: '',
      })
      toast.success(sendLater && scheduledAt ? t.email.emailScheduled : `${t.common.email} ✓`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.noResults)
    } finally {
      setSending(false)
    }
  }

  const connected = isGmailConnected()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-md" onClick={requestClose} />
      <div className="relative w-full max-w-2xl mx-4 mb-4 sm:mb-0 glass rounded-2xl shadow-float border-white/10 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{t.inbox.compose}</span>
            {connected
              ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Gmail</span>
              : <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-slate-500">{t.settings.disconnected}</span>
            }
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplates((v) => !v)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors ${
                showTemplates ? 'bg-amber-500/20 text-amber-400' : 'bg-white/6 hover:bg-white/10 text-slate-400'
              }`}
            >
              <FileText size={12} />
              {t.nav.templates}
            </button>
            <button onClick={requestClose} title={t.email.closeComposer} aria-label={t.email.closeComposer} className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors">
              <span className="sr-only">{t.email.closeComposer}</span>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Template picker */}
        {showTemplates && (
          <div className="border-b border-white/8 max-h-56 overflow-y-auto">
            <div className="px-4 py-2 border-b border-white/6 sticky top-0 bg-[#111220]">
              <p className="text-xs font-medium text-amber-400">{t.emailTemplates.title}</p>
            </div>
            {templates.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                {t.common.noResults}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/6 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white font-medium group-hover:text-brand-400 transition-colors">{tpl.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/6 text-slate-500">{CATEGORY_LABELS[tpl.category]}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{tpl.subject}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Form fields */}
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 border-b border-white/6 pb-3">
            <span className="text-xs text-slate-500 w-12 flex-shrink-0">{t.common.to}</span>
            <div className="flex-1 flex items-center gap-2">
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder={t.common.searchPlaceholder}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
              />
              <button
                onClick={() => setShowCc((v) => !v)}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
              >
                {t.email.ccLabel} <ChevronDown size={11} className={showCc ? 'rotate-180' : ''} />
              </button>
              <button
                onClick={() => setShowBcc((v) => !v)}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
              >
                {t.email.bccLabel} <ChevronDown size={11} className={showBcc ? 'rotate-180' : ''} />
              </button>
              <button
                onClick={() => setShowReplyTo((v) => !v)}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
              >
                {t.email.replyToLabel} <ChevronDown size={11} className={showReplyTo ? 'rotate-180' : ''} />
              </button>
            </div>
          </div>

          {showCc && (
            <div className="flex items-center gap-3 border-b border-white/6 pb-3">
              <span className="text-xs text-slate-500 w-12 flex-shrink-0">{t.email.ccLabel}</span>
              <input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder={t.common.email}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
              />
            </div>
          )}
          {showBcc && (
            <div className="flex items-center gap-3 border-b border-white/6 pb-3">
              <span className="text-xs text-slate-500 w-12 flex-shrink-0">{t.email.bccLabel}</span>
              <input
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder={t.common.email}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
              />
            </div>
          )}
          {showReplyTo && (
            <div className="flex items-center gap-3 border-b border-white/6 pb-3">
              <span className="text-xs text-slate-500 w-12 flex-shrink-0">{t.email.replyToLabel}</span>
              <input
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder={t.common.email}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
              />
            </div>
          )}

          <div className="flex items-center gap-3 border-b border-white/6 pb-3">
            <span className="text-xs text-slate-500 w-12 flex-shrink-0">{t.activities.subject}</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={`${t.activities.subject}...`}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none font-medium"
            />
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`${t.common.description}...`}
            rows={10}
            className="w-full bg-[#0d0e1a]/45 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none resize-none leading-relaxed"
          />
          <div className="border-t border-white/6 pt-3 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">{t.inbox.attachments}</span>
              <label className="text-xs px-2 py-1 rounded-full bg-white/6 text-slate-300 hover:bg-white/10 cursor-pointer">
                {t.email.addFile}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? [])
                    const next = await Promise.all(files.map(async (file) => {
                      const dataBase64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onload = () => {
                          const result = String(reader.result ?? '')
                          const b64 = result.split(',')[1] ?? ''
                          resolve(b64)
                        }
                        reader.onerror = () => reject(reader.error)
                        reader.readAsDataURL(file)
                      })
                      return {
                        name: file.name,
                        mimeType: file.type || 'application/octet-stream',
                        size: file.size,
                        dataBase64,
                      }
                    }))
                    setAttachments((prev) => [...prev, ...next])
                    e.currentTarget.value = ''
                  }}
                />
              </label>
            </div>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((file, idx) => (
                  <span key={`${file.name}-${idx}`} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-slate-300 border border-white/10">
                    {file.name} ({Math.ceil(file.size / 1024)} KB)
                    <button
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-500 hover:text-red-300"
                      title={t.common.remove}
                      aria-label={t.common.remove}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-600">{t.email.attachHint}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/8 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-slate-600">
              {connected ? `Gmail — ${t.settings.connected}` : `${t.settings.gmailIntegration} — ${t.settings.disconnected}`}
            </p>
            {/* Tracking toggle */}
            <button
              type="button"
              onClick={() => setTrackingEnabled((v) => !v)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors ${
                trackingEnabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/6 text-slate-500 hover:text-slate-300 border border-white/8'
              }`}
              title={t.followUps.title}
            >
              <Eye size={11} />
              {t.followUps.title}
            </button>
            <button
              type="button"
              onClick={() => setSendLater((v) => !v)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors ${
                sendLater
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'bg-white/6 text-slate-500 hover:text-slate-300 border border-white/8'
              }`}
            >
              {t.email.sendLater}
            </button>
            {sendLater && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                title={t.email.scheduleSendTime}
                aria-label={t.email.scheduleSendTime}
                className="bg-[#0d0e1a] border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200"
              />
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !to.trim() || !subject.trim() || (sendLater && !scheduledAt)}
            className="flex items-center gap-2 px-4 py-2 rounded-full btn-gradient text-white text-sm font-semibold disabled:opacity-40"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {t.inbox.compose}
          </button>
        </div>
      </div>
    </div>
  )
}
