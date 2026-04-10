import { useMemo, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { addMonths, subMonths, format, startOfMonth, endOfMonth, differenceInDays, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { es, enUS, ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar, DollarSign, Filter, X } from 'lucide-react'
import { useDealsStore } from '../store/dealsStore'
import { useContactsStore } from '../store/contactsStore'
import { useCompaniesStore } from '../store/companiesStore'
import { formatCurrency } from '../utils/formatters'
import { DEAL_STAGE_COLORS } from '../utils/constants'
import { useAuthStore } from '../store/authStore'
import type { Deal, DealStage } from '../types'
import { useTranslations, useI18nStore } from '../i18n'

const STAGE_HEX: Record<DealStage, string> = {
  lead: '#3b82f6',
  qualified: '#f59e0b',
  proposal: '#8b5cf6',
  negotiation: '#f97316',
  closed_won: '#10b981',
  closed_lost: '#ef4444',
}

const MONTHS_VISIBLE = 3

export function PipelineTimeline() {
  const t = useTranslations()
  const language = useI18nStore((s) => s.language)
  const dateLocale = language === 'pt' ? ptBR : language === 'en' ? enUS : es

  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [stageFilter, setStageFilter] = useState<DealStage | ''>('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [hoveredDeal, setHoveredDeal] = useState<string | null>(null)

  // Manual store subscriptions
  const [deals, setDeals] = useState<Deal[]>([])
  const computeDeals = useCallback(() => setDeals(useDealsStore.getState().deals), [])
  useEffect(() => {
    computeDeals()
    return useDealsStore.subscribe(computeDeals)
  }, [computeDeals])

  const contacts = useContactsStore((s) => s.contacts)
  const companies = useCompaniesStore((s) => s.companies)
  const orgUsers = useAuthStore((s) => s.users)

  // Date range: current 3 months
  const startDate = startOfMonth(currentMonth)
  const endDate = endOfMonth(addMonths(currentMonth, MONTHS_VISIBLE - 1))
  const totalDays = differenceInDays(endDate, startDate) + 1

  // Filter deals that have expected close dates within view or are active open
  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (d.stage === 'closed_lost') return false
      if (stageFilter && d.stage !== stageFilter) return false
      if (assigneeFilter && d.assignedTo !== assigneeFilter) return false
      // Show deals with close date in range OR open deals without close date
      if (!d.expectedCloseDate) return true
      try {
        return isWithinInterval(parseISO(d.expectedCloseDate), {
          start: startOfDay(subMonths(startDate, 1)),
          end: endOfDay(addMonths(endDate, 1)),
        })
      } catch { return false }
    }).sort((a, b) => (a.expectedCloseDate || '').localeCompare(b.expectedCloseDate || ''))
  }, [deals, stageFilter, assigneeFilter, startDate, endDate])

  // Month columns
  const months = useMemo(() => {
    return Array.from({ length: MONTHS_VISIBLE }, (_, i) => addMonths(currentMonth, i))
  }, [currentMonth])

  // For each month, compute its start/end position as % of totalDays
  const monthPositions = useMemo(() => {
    return months.map((m) => {
      const mStart = startOfMonth(m)
      const mEnd = endOfMonth(m)
      const left = (differenceInDays(mStart, startDate) / totalDays) * 100
      const width = ((differenceInDays(mEnd, mStart) + 1) / totalDays) * 100
      return { month: m, left, width }
    })
  }, [months, startDate, totalDays])

  // Compute bar position for a deal
  function getDealBar(deal: Deal): { left: number; width: number; outOfRange: boolean } {
    const closeDate = deal.expectedCloseDate ? parseISO(deal.expectedCloseDate) : null
    if (!closeDate) {
      return { left: 0, width: 100, outOfRange: false }
    }
    // Bar: from start of month to close date (or full range if beyond)
    const barStart = startDate
    const barEnd = closeDate

    const leftDays = Math.max(0, differenceInDays(barStart, startDate))
    const endDays = differenceInDays(barEnd, startDate)
    const clampedEnd = Math.min(endDays, totalDays - 1)

    if (clampedEnd < 0) return { left: 0, width: 2, outOfRange: true }

    const left = (leftDays / totalDays) * 100
    const width = Math.max(((clampedEnd - leftDays) / totalDays) * 100, 1.5)
    const outOfRange = endDays > totalDays - 1
    return { left, width, outOfRange }
  }

  // Summary stats
  const totalPipeline = filteredDeals
    .filter((d) => !['closed_won', 'closed_lost'].includes(d.stage))
    .reduce((s, d) => s + d.value, 0)
  const expectedThisQuarter = filteredDeals
    .filter((d) => {
      if (!d.expectedCloseDate) return false
      try {
        return isWithinInterval(parseISO(d.expectedCloseDate), { start: startDate, end: endDate })
      } catch { return false }
    })
    .reduce((s, d) => s + d.value * (d.probability / 100), 0)

  const getContact = (id: string) => contacts.find((c) => c.id === id)
  const getCompany = (id: string) => companies.find((c) => c.id === id)

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar size={20} className="text-brand-400" />
            {t.nav.timeline}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {filteredDeals.length} {t.nav.deals} · {formatCurrency(totalPipeline)} {t.deals.pipeline}
          </p>
        </div>

        {/* Nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="p-2 rounded-xl glass border-white/8 text-slate-400 hover:text-white hover:bg-white/6 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-white px-2 capitalize">
            {format(currentMonth, 'MMM yyyy', { locale: dateLocale })} — {format(addMonths(currentMonth, MONTHS_VISIBLE - 1), 'MMM yyyy', { locale: dateLocale })}
          </span>
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="p-2 rounded-xl glass border-white/8 text-slate-400 hover:text-white hover:bg-white/6 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass p-4 rounded-xl">
          <p className="text-xs text-slate-500 mb-1">{t.deals.title}</p>
          <p className="text-2xl font-bold text-white">{filteredDeals.length}</p>
        </div>
        <div className="glass p-4 rounded-xl">
          <p className="text-xs text-slate-500 mb-1">{t.dashboard.pipelineValue}</p>
          <p className="text-2xl font-bold text-brand-400">{formatCurrency(totalPipeline)}</p>
        </div>
        <div className="glass p-4 rounded-xl">
          <p className="text-xs text-slate-500 mb-1">{t.forecast.weighted}</p>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(expectedThisQuarter)}</p>
        </div>
        <div className="glass p-4 rounded-xl">
          <p className="text-xs text-slate-500 mb-1">{'Tasa de conversión'}</p>
          <p className="text-2xl font-bold text-amber-400">
            {filteredDeals.length > 0
              ? `${Math.round(filteredDeals.reduce((s, d) => s + d.probability, 0) / filteredDeals.length)}%`
              : '—'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap glass rounded-xl p-3">
        <Filter size={14} className="text-slate-500" />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as DealStage | '')}
          className="bg-[#0d0e1a] border border-white/8 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500/40"
        >
          <option value="">{t.deals.stage}</option>
          {(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won'] as DealStage[]).map((s) => (
            <option key={s} value={s}>{t.deals.stageLabels[s]}</option>
          ))}
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="bg-[#0d0e1a] border border-white/8 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500/40"
        >
          <option value="">{t.common.assignedTo}</option>
          {orgUsers.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
        </select>
        {(stageFilter || assigneeFilter) && (
          <button
            onClick={() => { setStageFilter(''); setAssigneeFilter('') }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/6 transition-colors"
          >
            <X size={12} /> {t.common.clear}
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="glass rounded-2xl overflow-hidden">
        {/* Month header */}
        <div className="flex border-b border-white/8 bg-navy-900/40">
          <div className="w-48 flex-shrink-0 px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-white/6">
            {t.deals.title}
          </div>
          <div className="flex-1 relative h-10">
            {monthPositions.map(({ month, left, width }) => (
              <div
                key={month.toISOString()}
                className="absolute top-0 bottom-0 flex items-center justify-center border-r border-white/6"
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                <span className="text-xs font-semibold text-slate-400 capitalize">
                  {format(month, 'MMM yyyy', { locale: dateLocale })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Deal rows */}
        <div className="divide-y divide-white/4">
          {filteredDeals.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Calendar size={32} className="mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">{t.deals.emptyTitle}</p>
              <p className="text-xs text-slate-600 mt-1">{t.common.filters}</p>
            </div>
          ) : (
            filteredDeals.map((deal) => {
              const bar = getDealBar(deal)
              const contact = getContact(deal.contactId)
              const company = getCompany(deal.companyId)
              const stageColor = STAGE_HEX[deal.stage]
              const isHovered = hoveredDeal === deal.id

              return (
                <div
                  key={deal.id}
                  className={`flex items-center transition-colors ${isHovered ? 'bg-white/4' : 'hover:bg-white/[0.02]'}`}
                  onMouseEnter={() => setHoveredDeal(deal.id)}
                  onMouseLeave={() => setHoveredDeal(null)}
                >
                  {/* Deal info */}
                  <div
                    className="w-48 flex-shrink-0 px-3 py-3 border-r border-white/6 cursor-pointer"
                    onClick={() => navigate('/deals')}
                  >
                    <p className="text-xs font-medium text-white truncate">{deal.title}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {company?.name || contact ? `${contact?.firstName} ${contact?.lastName}` : '—'}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: stageColor + '25', color: stageColor }}>
                        {t.deals.stageLabels[deal.stage]}
                      </span>
                    </div>
                  </div>

                  {/* Gantt bar area */}
                  <div className="flex-1 relative h-[52px] px-0">
                    {/* Month dividers */}
                    {monthPositions.slice(1).map(({ left }, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-px bg-white/4"
                        style={{ left: `${left}%` }}
                      />
                    ))}

                    {/* Deal bar */}
                    {!bar.outOfRange && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-6 rounded-full flex items-center px-2 gap-1.5 cursor-pointer transition-all duration-200 overflow-hidden"
                        style={{
                          left: `${bar.left}%`,
                          width: `${bar.width}%`,
                          backgroundColor: stageColor + '30',
                          borderLeft: `3px solid ${stageColor}`,
                          opacity: isHovered ? 1 : 0.85,
                          boxShadow: isHovered ? `0 0 10px ${stageColor}40` : 'none',
                        }}
                        onClick={() => navigate('/deals')}
                        title={`${deal.title} · ${formatCurrency(deal.value)} · ${deal.probability}%`}
                      >
                        <DollarSign size={9} style={{ color: stageColor, flexShrink: 0 }} />
                        {bar.width > 8 && (
                          <span className="text-[9px] font-semibold text-white truncate">
                            {formatCurrency(deal.value)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Close date marker */}
                    {deal.expectedCloseDate && (() => {
                      const closeDay = differenceInDays(parseISO(deal.expectedCloseDate), startDate)
                      if (closeDay < 0 || closeDay > totalDays) return null
                      const pct = (closeDay / totalDays) * 100
                      return (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 opacity-40"
                          style={{ left: `${pct}%`, backgroundColor: stageColor }}
                          title={`${t.deals.expectedClose}: ${deal.expectedCloseDate}`}
                        />
                      )
                    })()}
                  </div>

                  {/* Right: value + probability */}
                  <div className="w-32 flex-shrink-0 text-right px-3 border-l border-white/6">
                    <p className="text-xs font-semibold text-emerald-400">{formatCurrency(deal.value)}</p>
                    <p className="text-[10px] text-slate-500">{deal.probability}% {t.deals.probability}</p>
                    <p className="text-[10px] text-slate-600 truncate">{deal.assignedTo.split(' ')[0]}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won'] as DealStage[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STAGE_HEX[s] }} />
            <span className="text-[11px] text-slate-500">{t.deals.stageLabels[s]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
