import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleHelp, Clock3, Flame, Plus, RefreshCw, Trash2, UserPlus } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useLeadsStore } from '../store/leadsStore'
import { useAuthStore } from '../store/authStore'
import { useTranslations } from '../i18n'
import type { LeadLifecycleStage } from '../types'
import { formatDateTime } from '../utils/formatters'
import { toast } from '../store/toastStore'

const STAGES: LeadLifecycleStage[] = ['subscriber', 'lead', 'mql', 'sql', 'opportunity', 'customer']

function HintPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const updatePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({
      top: rect.bottom + 6,
      left: Math.max(8, rect.right - 256),
    })
  }

  useEffect(() => {
    if (!open) return
    updatePosition()
    const onLayoutChange = () => updatePosition()
    window.addEventListener('scroll', onLayoutChange, true)
    window.addEventListener('resize', onLayoutChange)
    return () => {
      window.removeEventListener('scroll', onLayoutChange, true)
      window.removeEventListener('resize', onLayoutChange)
    }
  }, [open])

  return (
    <div className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((value) => {
            const next = !value
            if (next) updatePosition()
            return next
          })
        }}
        onMouseEnter={() => {
          updatePosition()
          setOpen(true)
        }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => {
          updatePosition()
          setOpen(true)
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 120)
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/14 text-slate-400 hover:text-slate-200 hover:border-white/30 transition-colors"
        aria-label={text}
        title={text}
      >
        <CircleHelp size={10} />
      </button>
      {open && position && createPortal(
        <div
          className="fixed z-[80] w-64 rounded-lg border border-white/10 bg-[#111220] p-2 text-[11px] leading-4 text-slate-300 shadow-xl"
          style={{ top: position.top, left: position.left }}
        >
          {text}
        </div>,
        document.body
      )}
    </div>
  )
}

export function Leads() {
  const t = useTranslations()
  const {
    leads,
    isLoading,
    error,
    search,
    stageFilter,
    scoreFilter,
    fetchLeads,
    addLead,
    deleteLead,
    setSearch,
    setStageFilter,
    setScoreFilter,
    getFilteredLeads,
    leadEventsByLeadId,
    scoreInsightsByLeadId,
    scoreHistoryByLeadId,
    fetchLeadEvents,
    fetchScoreInsight,
    fetchScoreHistory,
    convertLeadToContact,
  } = useLeadsStore()
  const orgUsers = useAuthStore((s) => s.users)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null)
  const [expandedScoreLeadId, setExpandedScoreLeadId] = useState<string | null>(null)

  const filtered = useMemo(() => getFilteredLeads(), [leads, search, stageFilter, scoreFilter, getFilteredLeads])
  const stageLabels = t.leads.stageLabels

  const hotCount = filtered.filter((lead) => lead.score >= 70).length
  useEffect(() => {
    filtered.slice(0, 15).forEach((lead) => {
      fetchScoreInsight(lead.id)
    })
  }, [filtered, fetchScoreInsight])

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">{t.leads.title}</h1>
          <p className="text-sm text-slate-500">{filtered.length} {t.leads.title.toLowerCase()} • {hotCount} {t.leads.hot.toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchLeads() }}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-white/6 text-slate-300 hover:bg-white/10"
          >
            <RefreshCw size={12} />
            {t.leads.refresh}
          </button>
          <button
            onClick={() => setShowQuickAdd((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg btn-gradient text-white"
          >
            <Plus size={12} />
            {t.leads.addLead}
          </button>
        </div>
      </div>

      {showQuickAdd && (
        <div className="glass rounded-2xl border-white/10 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t.leads.firstName} className="bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t.leads.lastName} className="bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.common.email} className="bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder={t.leads.company} className="bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
          </div>
          <div className="mt-3">
            <button
              onClick={() => {
                if (!firstName || !lastName || !email) return
                addLead({
                  firstName,
                  lastName,
                  email,
                  companyName,
                  source: 'website',
                  assignedTo: orgUsers[0]?.id,
                  ownerUserId: orgUsers[0]?.id,
                  tags: [],
                })
                setFirstName('')
                setLastName('')
                setEmail('')
                setCompanyName('')
                setShowQuickAdd(false)
              }}
              className="text-xs px-3 py-2 rounded-lg bg-brand-500/20 text-brand-300 border border-brand-500/30 hover:bg-brand-500/25"
            >
              {t.leads.createLead}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.leads.searchPlaceholder}
          className="md:col-span-2 bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter((e.target.value as LeadLifecycleStage) || '')}
          className="bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
        >
          <option value="">{t.leads.allStages}</option>
          {STAGES.map((stage) => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}
        </select>
        <select
          value={scoreFilter}
          onChange={(e) => setScoreFilter((e.target.value as 'hot' | 'warm' | 'cold') || '')}
          className="bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
        >
          <option value="">{t.leads.allScores}</option>
          <option value="hot">{t.leads.hot} (70+)</option>
          <option value="warm">{t.leads.warm} (40-69)</option>
          <option value="cold">{t.leads.cold} (&lt;40)</option>
        </select>
      </div>

      <div className="glass rounded-2xl border-white/8 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/6 text-xs text-slate-400 uppercase tracking-wider">{t.leads.leadInbox}</div>
        {isLoading && <div className="px-4 py-5 text-sm text-slate-500">{t.leads.loadingLeads}</div>}
        {error && <div className="px-4 py-5 text-sm text-red-400">{error}</div>}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="px-4 py-6 text-sm text-slate-500">{t.leads.noLeads}</div>
        )}
        <div className="divide-y divide-white/4">
          {filtered.map((lead) => (
            <div key={lead.id}>
              <div className="px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-xs font-bold text-slate-300">
                {`${lead.firstName.charAt(0)}${lead.lastName.charAt(0)}`.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{lead.firstName} {lead.lastName}</p>
                <p className="text-xs text-slate-500 truncate">{lead.email}{lead.companyName ? ` • ${lead.companyName}` : ''}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                lead.score >= 70 ? 'bg-red-500/15 border-red-500/30 text-red-300' :
                  lead.score >= 40 ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' :
                    'bg-white/8 border-white/10 text-slate-400'
              }`}>
                <span className="inline-flex items-center gap-1">
                  {lead.score >= 70 && <Flame size={10} />}
                  {lead.score}
                </span>
              </span>
              {scoreInsightsByLeadId[lead.id] && (
                <span
                  title={`baseline=${scoreInsightsByLeadId[lead.id].baselineSignals} · eventScore=${scoreInsightsByLeadId[lead.id].eventScore} · recentSignals=${scoreInsightsByLeadId[lead.id].recentSignals}`}
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    scoreInsightsByLeadId[lead.id].confidence === 'high'
                      ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                      : scoreInsightsByLeadId[lead.id].confidence === 'medium'
                        ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                        : 'text-slate-300 border-white/10 bg-white/5'
                  }`}
                >
                  {t.leads.confidence}: {t.leads.confidenceLevels[scoreInsightsByLeadId[lead.id].confidence]}
                </span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/25">
                {stageLabels[lead.lifecycleStage]}
              </span>
              <button
                onClick={async () => {
                  const willExpand = expandedLeadId !== lead.id
                  setExpandedLeadId(willExpand ? lead.id : null)
                  if (willExpand) await fetchLeadEvents(lead.id)
                }}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-white/6 hover:bg-white/10 text-slate-300"
              >
                <Clock3 size={10} />
                {t.leads.timelineAction}
              </button>
              <button
                onClick={async () => {
                  const willExpand = expandedScoreLeadId !== lead.id
                  setExpandedScoreLeadId(willExpand ? lead.id : null)
                  if (willExpand) {
                    await Promise.all([
                      fetchScoreInsight(lead.id),
                      fetchScoreHistory(lead.id),
                    ])
                  }
                }}
                className="text-[10px] px-2 py-1 rounded bg-white/6 hover:bg-white/10 text-slate-300"
              >
                {t.leads.scoreBreakdownAction}
              </button>
              {lead.status !== 'converted' && (
                <div className="inline-flex items-center gap-1">
                  <button
                    onClick={async () => {
                      const ok = await convertLeadToContact(lead.id)
                      if (ok) {
                        toast.success(t.leads.convertAction)
                      } else {
                        toast.error(error ?? t.errors.generic)
                      }
                    }}
                    title={t.leads.convertActionHint}
                    aria-label={t.leads.convertActionHint}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                  >
                    <UserPlus size={10} />
                    {t.leads.convertAction}
                  </button>
                  <HintPopover text={t.leads.convertActionHint} />
                </div>
              )}
              <button
                onClick={() => {
                  deleteLead(lead.id)
                  toast.success(t.common.delete)
                }}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-red-500/12 border border-red-500/30 text-red-300 hover:bg-red-500/18"
                title={t.common.delete}
                aria-label={t.common.delete}
              >
                <Trash2 size={10} />
                {t.common.delete}
              </button>
              </div>
              {expandedLeadId === lead.id && (
                <div className="px-4 pb-4">
                  <div className="ml-12 rounded-lg border border-white/8 bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">{t.leads.timelineTitle}</p>
                    {(leadEventsByLeadId[lead.id] ?? []).length === 0 ? (
                      <p className="text-xs text-slate-500">{t.leads.noEvents}</p>
                    ) : (
                      <div className="space-y-2">
                        {(leadEventsByLeadId[lead.id] ?? []).map((event) => (
                          <div key={event.id} className="text-xs text-slate-300">
                            <span className="text-slate-500">{formatDateTime(event.createdAt)} • </span>
                            <span className="font-medium">{event.eventType}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {expandedScoreLeadId === lead.id && (
                <div className="px-4 pb-4">
                  <div className="ml-12 rounded-lg border border-white/8 bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">{t.leads.scoreBreakdownTitle}</p>
                    {!scoreInsightsByLeadId[lead.id] ? (
                      <p className="text-xs text-slate-500">{t.leads.noScoreInsight}</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                        <div className="rounded border border-white/8 px-2 py-1.5">
                          <p className="text-slate-500">{t.leads.confidence}</p>
                          <p className="text-slate-200 font-medium">{t.leads.confidenceLevels[scoreInsightsByLeadId[lead.id].confidence]}</p>
                        </div>
                        <div className="rounded border border-white/8 px-2 py-1.5">
                          <p className="text-slate-500">{t.leads.baselineSignals}</p>
                          <p className="text-slate-200 font-medium">{scoreInsightsByLeadId[lead.id].baselineSignals}</p>
                        </div>
                        <div className="rounded border border-white/8 px-2 py-1.5">
                          <p className="text-slate-500">{t.leads.eventScore}</p>
                          <p className="text-slate-200 font-medium">{scoreInsightsByLeadId[lead.id].eventScore}</p>
                        </div>
                        <div className="rounded border border-white/8 px-2 py-1.5">
                          <p className="text-slate-500">{t.leads.recentSignals}</p>
                          <p className="text-slate-200 font-medium">{scoreInsightsByLeadId[lead.id].recentSignals}</p>
                        </div>
                        <div className="rounded border border-white/8 px-2 py-1.5">
                          <p className="text-slate-500">{t.leads.scoreAction}</p>
                          <p className="text-slate-200 font-medium">
                            {(scoreInsightsByLeadId[lead.id].computedScore ?? lead.score)} / {scoreInsightsByLeadId[lead.id].persistedScore ?? lead.score}
                          </p>
                        </div>
                      </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">{t.leads.scoreHistory}</p>
                          {!(scoreHistoryByLeadId[lead.id]?.length) ? (
                            <p className="text-xs text-slate-500">{t.leads.noScoreInsight}</p>
                          ) : (
                            <svg viewBox="0 0 100 28" className="w-full h-10">
                              <polyline
                                fill="none"
                                stroke="rgb(99 102 241)"
                                strokeWidth="2"
                                points={scoreHistoryByLeadId[lead.id]
                                  .map((p, index, arr) => {
                                    const x = arr.length <= 1 ? 0 : (index / (arr.length - 1)) * 100
                                    const y = 28 - ((Math.max(0, Math.min(100, p.score)) / 100) * 28)
                                    return `${x},${y}`
                                  })
                                  .join(' ')}
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
