import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Plus, Trash2, Bot, User, Loader2, ChevronDown, TrendingUp, Star } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import { useTranslations } from '../i18n'
import { useAIStore } from '../store/aiStore'
import { useContactsStore } from '../store/contactsStore'
import { useCompaniesStore } from '../store/companiesStore'
import { useDealsStore } from '../store/dealsStore'
import { useActivitiesStore } from '../store/activitiesStore'
import { salesAssistantStream, enrichContact, enrichDeal } from '../services/aiService'
import { toast } from '../store/toastStore'
import type { ContactEnrichment, DealEnrichment } from '../types'

// ─── Enrichment Card ─────────────────────────────────────────────────────────
function ContactEnrichmentCard({ data }: { data: ContactEnrichment }) {
  const t = useTranslations()
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{t.contacts.score}</span>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-20 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-600 to-violet-500 transition-all duration-700"
                style={{ width: `${data.leadScore}%` }}
              />
            </div>
            <span className={`text-sm font-bold ${data.leadScore >= 70 ? 'text-emerald-400' : data.leadScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
              {data.leadScore}
            </span>
          </div>
        </div>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400">{data.personalityType}</span>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1 font-medium">{t.common.description}</p>
        <p className="text-xs text-slate-300 leading-relaxed">{data.insights}</p>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1 font-medium">{t.common.tags}</p>
        <div className="flex flex-wrap gap-1">
          {data.buyingSignals.map((s, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-400 border border-emerald-500/20">{s}</span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1 font-medium">{t.emailTemplates.categoryLabels.intro}</p>
        <p className="text-xs italic text-brand-300 bg-brand-500/8 rounded-lg px-3 py-2">"{data.suggestedEmailOpener}"</p>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1 font-medium">{t.followUps.suggestedAction}</p>
        <p className="text-xs text-slate-300 leading-relaxed">{data.approachStrategy}</p>
      </div>
    </div>
  )
}

function DealEnrichmentCard({ data }: { data: DealEnrichment }) {
  const t = useTranslations()
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-slate-500">{t.deals.probability} IA</span>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-20 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-violet-500 transition-all duration-700"
              style={{ width: `${data.winProbabilityAI}%` }}
            />
          </div>
          <span className={`text-sm font-bold ${data.winProbabilityAI >= 60 ? 'text-emerald-400' : data.winProbabilityAI >= 35 ? 'text-amber-400' : 'text-red-400'}`}>
            {data.winProbabilityAI}%
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">{data.executiveSummary}</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-emerald-400 font-medium mb-1 uppercase tracking-wide">{t.goals.onTrack}</p>
          {data.keyStrengths.map((s, i) => <p key={i} className="text-[10px] text-slate-400 mb-0.5">• {s}</p>)}
        </div>
        <div>
          <p className="text-[10px] text-red-400 font-medium mb-1 uppercase tracking-wide">{t.goals.atRisk}</p>
          {data.keyRisks.map((r, i) => <p key={i} className="text-[10px] text-slate-400 mb-0.5">• {r}</p>)}
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1 font-medium">{t.followUps.suggestedAction}</p>
        {data.nextSteps.map((s, i) => (
          <div key={i} className="flex items-start gap-1.5 mb-1">
            <span className="text-brand-400 text-xs font-bold flex-shrink-0">{i + 1}.</span>
            <p className="text-xs text-slate-300">{s}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1 font-medium">{t.common.notes}</p>
        <div className="flex flex-wrap gap-1">
          {data.talkingPoints.map((t, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/6 text-slate-400 border border-white/8">{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function AIAgent() {
  const t = useTranslations()
  const {
    openRouterKey, conversations, activeConversationId,
    contactEnrichments, dealEnrichments,
    createConversation, deleteConversation, setActiveConversation,
    addMessage, setStreaming, isStreaming,
    saveContactEnrichment, saveDealEnrichment, getActiveConversation,
  } = useAIStore()

  const contacts = useContactsStore((s) => s.contacts)
  const companies = useCompaniesStore((s) => s.companies)
  const deals = useDealsStore((s) => s.deals)
  const activities = useActivitiesStore((s) => s.activities)

  const [input, setInput] = useState('')
  const [selectedContactId, setSelectedContactId] = useState('')
  const [selectedDealId, setSelectedDealId] = useState('')
  const [enrichingContact, setEnrichingContact] = useState(false)
  const [enrichingDeal, setEnrichingDeal] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeConv = getActiveConversation()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConv?.messages, streamingText])

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return
    if (!openRouterKey) { toast.error(`${t.settings.aiConfig}: ${t.settings.apiKey}`); return }

    let convId = activeConversationId
    if (!convId) {
      const conv = createConversation(input.slice(0, 40) + (input.length > 40 ? '...' : ''))
      convId = conv.id
    }

    const userMsg = input.trim()
    setInput('')
    addMessage(convId, { role: 'user', content: userMsg })
    setStreaming(true)
    setStreamingText('')

    const conv = useAIStore.getState().conversations.find((c) => c.id === convId)!
    const allMessages = [...conv.messages, { role: 'user' as const, content: userMsg, timestamp: '' }]

    try {
      let full = ''
      for await (const chunk of salesAssistantStream(allMessages, { contacts, deals, activities })) {
        full += chunk
        setStreamingText(full)
      }
      addMessage(convId, { role: 'assistant', content: full })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.noResults)
    } finally {
      setStreaming(false)
      setStreamingText('')
    }
  }

  const handleEnrichContact = async () => {
    if (!selectedContactId) return
    if (!openRouterKey) { toast.error(`${t.settings.aiConfig}: ${t.settings.apiKey}`); return }
    const contact = contacts.find((c) => c.id === selectedContactId)!
    const company = companies.find((c) => c.id === contact.companyId)
    setEnrichingContact(true)
    try {
      const enrichment = await enrichContact(contact, company)
      saveContactEnrichment(selectedContactId, enrichment)
      toast.success(t.contacts.updated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.noResults)
    } finally {
      setEnrichingContact(false)
    }
  }

  const handleEnrichDeal = async () => {
    if (!selectedDealId) return
    if (!openRouterKey) { toast.error(`${t.settings.aiConfig}: ${t.settings.apiKey}`); return }
    const deal = deals.find((d) => d.id === selectedDealId)!
    const contact = contacts.find((c) => c.id === deal.contactId)
    const company = companies.find((c) => c.id === deal.companyId)
    setEnrichingDeal(true)
    try {
      const enrichment = await enrichDeal(deal, contact, company)
      saveDealEnrichment(selectedDealId, enrichment)
      toast.success(t.deals.updated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.noResults)
    } finally {
      setEnrichingDeal(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Conversation list ─────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 border-r border-white/6 flex flex-col bg-navy-900/50">
        <div className="p-3 border-b border-white/6">
          <button
            onClick={() => createConversation()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl btn-gradient text-white text-xs font-semibold"
          >
            <Plus size={13} />
            {t.common.create}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-6">{t.common.noResults}</p>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setActiveConversation(conv.id)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                conv.id === activeConversationId
                  ? 'bg-brand-600/15 text-white'
                  : 'text-slate-400 hover:bg-white/4 hover:text-slate-200'
              }`}
            >
              <Bot size={13} className="flex-shrink-0" />
              <span className="flex-1 text-xs truncate">{conv.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id) }}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Center: Chat ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!activeConv && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl btn-gradient flex items-center justify-center shadow-brand">
                <Sparkles size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white mb-1">{t.nav.aiAssistant}</h2>
                <p className="text-sm text-slate-500 max-w-sm">
                  {t.common.description}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-sm w-full mt-2">
                {[
                  t.deals.title,
                  t.activities.typeLabels.email,
                  t.leaderboard.conversionRate,
                  t.deals.pipeline,
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-left text-xs p-3 rounded-xl glass glass-hover text-slate-400 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeConv?.messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-xl btn-gradient flex items-center justify-center flex-shrink-0 mt-0.5 shadow-brand-sm">
                  <Bot size={14} className="text-white" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-brand-600/20 text-white border border-brand-500/20 rounded-tr-sm'
                    : 'glass text-slate-200 rounded-tl-sm'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{msg.content}</ReactMarkdown>
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User size={14} className="text-slate-400" />
                </div>
              )}
            </div>
          ))}

          {/* Streaming response */}
          {isStreaming && streamingText && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-xl btn-gradient flex items-center justify-center flex-shrink-0 mt-0.5 shadow-brand-sm">
                <Bot size={14} className="text-white" />
              </div>
              <div className="max-w-[75%] glass rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-200 leading-relaxed">
                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{streamingText}</ReactMarkdown>
              </div>
            </div>
          )}
          {isStreaming && !streamingText && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-xl btn-gradient flex items-center justify-center flex-shrink-0 shadow-brand-sm">
                <Loader2 size={14} className="text-white animate-spin" />
              </div>
              <div className="glass rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/6">
          {!openRouterKey && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-xs text-amber-400">⚠️ {t.settings.aiConfig}: <strong>{t.settings.apiKey}</strong></span>
            </div>
          )}
          <div className="flex items-end gap-3 glass rounded-2xl px-4 py-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder={t.common.searchPlaceholder}
              rows={2}
              disabled={isStreaming}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none resize-none leading-relaxed"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming || !openRouterKey}
              className="flex-shrink-0 w-8 h-8 rounded-xl btn-gradient flex items-center justify-center disabled:opacity-40 transition-all hover:scale-105"
            >
              {isStreaming ? <Loader2 size={14} className="text-white animate-spin" /> : <Send size={14} className="text-white" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: Enrichment Panel ─────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-l border-white/6 overflow-y-auto">
        {/* Contact enrichment */}
        <div className="p-4 border-b border-white/6">
          <div className="flex items-center gap-2 mb-3">
            <Star size={14} className="text-brand-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wide">{t.contacts.editContact}</h3>
          </div>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <select
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand-500/40 appearance-none pr-6"
              >
                <option value="">{t.deals.contact}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
            <button
              onClick={handleEnrichContact}
              disabled={!selectedContactId || enrichingContact}
              className="px-3 py-2 rounded-xl btn-gradient text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0"
            >
              {enrichingContact ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              IA
            </button>
          </div>
          {selectedContactId && contactEnrichments[selectedContactId] && (
            <ContactEnrichmentCard data={contactEnrichments[selectedContactId]} />
          )}
        </div>

        {/* Deal enrichment */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-violet-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wide">{t.nav.aiAssistant}</h3>
          </div>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <select
                value={selectedDealId}
                onChange={(e) => setSelectedDealId(e.target.value)}
                className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand-500/40 appearance-none pr-6"
              >
                <option value="">{t.deals.title}</option>
                {deals.filter((d) => !['closed_won', 'closed_lost'].includes(d.stage)).map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
            <button
              onClick={handleEnrichDeal}
              disabled={!selectedDealId || enrichingDeal}
              className="px-3 py-2 rounded-xl btn-gradient text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0"
            >
              {enrichingDeal ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              IA
            </button>
          </div>
          {selectedDealId && dealEnrichments[selectedDealId] && (
            <DealEnrichmentCard data={dealEnrichments[selectedDealId]} />
          )}
        </div>
      </div>
    </div>
  )
}
