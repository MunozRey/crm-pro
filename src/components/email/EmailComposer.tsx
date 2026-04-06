import { useState } from 'react'
import { X, Send, Sparkles, Loader2, ChevronDown, FileText, Eye } from 'lucide-react'
import { useEmailStore } from '../../store/emailStore'
import { useAIStore } from '../../store/aiStore'
import { useContactsStore } from '../../store/contactsStore'
import { useDealsStore } from '../../store/dealsStore'
import { useCompaniesStore } from '../../store/companiesStore'
import { useTemplateStore } from '../../store/templateStore'
import { generateEmailDraft } from '../../services/aiService'
import { formatCurrency } from '../../utils/formatters'
import { toast } from '../../store/toastStore'
import { useTranslations } from '../../i18n'

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
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState(defaultBody)
  const [showCc, setShowCc] = useState(false)
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [aiIntent, setAiIntent] = useState('')
  const [showAI, setShowAI] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [trackingEnabled, setTrackingEnabled] = useState(false)

  const { sendEmail, isGmailConnected, enableTracking } = useEmailStore()
  const { openRouterKey } = useAIStore()
  const contacts = useContactsStore((s) => s.contacts)
  const deals = useDealsStore((s) => s.deals)
  const companies = useCompaniesStore((s) => s.companies)
  const templates = useTemplateStore((s) => s.templates)
  const incrementUsage = useTemplateStore((s) => s.incrementUsage)

  if (!isOpen) return null

  const contact = contactId ? contacts.find((c) => c.id === contactId) : undefined
  const deal = dealId ? deals.find((d) => d.id === dealId) : undefined
  const company = companyId ? companies.find((c) => c.id === companyId) : contact?.companyId ? companies.find((c) => c.id === contact.companyId) : undefined

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
      const sent = await sendEmail({
        to: to.split(',').map((e) => e.trim()).filter(Boolean),
        cc: cc ? cc.split(',').map((e) => e.trim()).filter(Boolean) : undefined,
        subject,
        body,
        contactId,
        dealId,
        companyId,
      })
      if (trackingEnabled) {
        enableTracking(sent.id)
      }
      toast.success(`${t.common.email} ✓`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.noResults)
    } finally {
      setSending(false)
    }
  }

  const handleGenerateDraft = async () => {
    if (!openRouterKey) { toast.error(`${t.settings.aiConfig}: ${t.settings.apiKey}`); return }
    if (!contact) { toast.error(`${t.common.add} ${t.contacts.title.toLowerCase()}`); return }
    setGenerating(true)
    try {
      const draft = await generateEmailDraft({ contact, deal, intent: aiIntent || t.nav.followUps })
      setSubject(draft.subject)
      setBody(draft.body)
      setShowAI(false)
      toast.success(`${t.nav.aiAssistant} ✓`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.noResults)
    } finally {
      setGenerating(false)
    }
  }

  const connected = isGmailConnected()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-xl mx-4 mb-4 sm:mb-0 glass rounded-2xl shadow-float border-white/10 overflow-hidden animate-slide-up">
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
              onClick={() => { setShowTemplates((v) => !v); setShowAI(false) }}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors ${
                showTemplates ? 'bg-amber-500/20 text-amber-400' : 'bg-white/6 hover:bg-white/10 text-slate-400'
              }`}
            >
              <FileText size={12} />
              {t.nav.templates}
            </button>
            {openRouterKey && (
              <button
                onClick={() => { setShowAI((v) => !v); setShowTemplates(false) }}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-brand-600/15 hover:bg-brand-600/25 text-brand-400 transition-colors"
              >
                <Sparkles size={12} />
                IA
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Template picker */}
        {showTemplates && (
          <div className="border-b border-white/8 max-h-56 overflow-y-auto">
            <div className="px-4 py-2 border-b border-white/6 sticky top-0 bg-navy-800/95 backdrop-blur-sm">
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

        {/* AI panel */}
        {showAI && (
          <div className="px-4 py-3 bg-brand-600/8 border-b border-brand-500/20">
            <p className="text-xs text-brand-400 mb-2 font-medium">{t.nav.aiAssistant}</p>
            <div className="flex gap-2">
              <input
                value={aiIntent}
                onChange={(e) => setAiIntent(e.target.value)}
                placeholder={`${t.activities.subject}...`}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-brand-500/40"
                onKeyDown={(e) => { if (e.key === 'Enter') handleGenerateDraft() }}
              />
              <button
                onClick={handleGenerateDraft}
                disabled={generating}
                className="px-3 py-1.5 rounded-lg btn-gradient text-xs text-white font-medium disabled:opacity-50 flex items-center gap-1.5"
              >
                {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {t.common.create}
              </button>
            </div>
          </div>
        )}

        {/* Form fields */}
        <div className="p-4 space-y-3">
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
                Cc <ChevronDown size={11} className={showCc ? 'rotate-180' : ''} />
              </button>
            </div>
          </div>

          {showCc && (
            <div className="flex items-center gap-3 border-b border-white/6 pb-3">
              <span className="text-xs text-slate-500 w-12 flex-shrink-0">Cc</span>
              <input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
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
            rows={8}
            className="w-full bg-transparent text-sm text-white placeholder:text-slate-600 outline-none resize-none leading-relaxed"
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !to.trim() || !subject.trim()}
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
