import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  FunnelChart, Funnel, LabelList,
} from 'recharts'
import { useDealsStore } from '../store/dealsStore'
import { useContactsStore } from '../store/contactsStore'
import { useActivitiesStore } from '../store/activitiesStore'
import { formatCurrency } from '../utils/formatters'
import { DEAL_STAGES_ORDER } from '../utils/constants'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Avatar'
import { PermissionGate } from '../components/auth/PermissionGate'
import { Download } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import type { DealStage, ActivityType } from '../types'
import { subMonths, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { useTranslations } from '../i18n'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']

const TOOLTIP_STYLE = {
  backgroundColor: '#0d1025',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  color: '#e2e8f0',
}

export function Reports() {
  const t = useTranslations()
  const deals = useDealsStore((s) => s.deals)
  const contacts = useContactsStore((s) => s.contacts)
  const activities = useActivitiesStore((s) => s.activities)
  const orgUsers = useAuthStore((s) => s.users)

  const [dateFrom, setDateFrom] = useState(() => {
    return subMonths(new Date(), 6).toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])

  const filteredDeals = useMemo(() => {
    if (!dateFrom && !dateTo) return deals
    return deals.filter((d) => {
      try {
        const date = parseISO(d.createdAt)
        return isWithinInterval(date, {
          start: dateFrom ? startOfDay(parseISO(dateFrom)) : new Date(0),
          end: dateTo ? endOfDay(parseISO(dateTo)) : new Date(),
        })
      } catch { return false }
    })
  }, [deals, dateFrom, dateTo])

  // Revenue forecast (pipeline × probability)
  const forecastData = useMemo(() => {
    const stages: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation']
    return stages.map((stage) => {
      const stageDeals = filteredDeals.filter((d) => d.stage === stage)
      const totalValue = stageDeals.reduce((sum, d) => sum + d.value, 0)
      const weightedValue = stageDeals.reduce((sum, d) => sum + d.value * (d.probability / 100), 0)
      return {
        name: t.deals.stageLabels[stage],
        value: totalValue,
        weighted: weightedValue,
      }
    })
  }, [filteredDeals])

  // Won vs Lost
  const wonLostData = useMemo(() => {
    const won = filteredDeals.filter((d) => d.stage === 'closed_won').length
    const lost = filteredDeals.filter((d) => d.stage === 'closed_lost').length
    return [
      { name: t.deals.won, value: won, color: '#10b981' },
      { name: t.deals.lost, value: lost, color: '#ef4444' },
    ].filter((d) => d.value > 0)
  }, [filteredDeals])

  // Activities by type
  const activityTypeData = useMemo(() => {
    const types = Object.keys(t.activities.typeLabels) as ActivityType[]
    return types.map((type, i) => ({
      name: t.activities.typeLabels[type],
      value: activities.filter((a) => a.type === type).length,
      fill: COLORS[i % COLORS.length],
    })).filter((d) => d.value > 0)
  }, [activities])

  // Contacts by source
  const contactsBySource = useMemo(() => {
    const sources: Record<string, number> = {}
    contacts.forEach((c) => {
      sources[c.source] = (sources[c.source] ?? 0) + 1
    })
    return Object.entries(sources).map(([source, count], i) => ({
      name: source,
      value: count,
      color: COLORS[i % COLORS.length],
    }))
  }, [contacts])

  // Funnel conversion
  const funnelData = useMemo(() => {
    return DEAL_STAGES_ORDER.filter((s) => s !== 'closed_lost').map((stage) => ({
      name: t.deals.stageLabels[stage],
      value: filteredDeals.filter((d) => d.stage === stage).length,
      fill: '#6366f1',
    })).filter((d) => d.value > 0)
  }, [filteredDeals])

  const totalPipeline = filteredDeals
    .filter((d) => !['closed_won', 'closed_lost'].includes(d.stage))
    .reduce((sum, d) => sum + d.value, 0)

  const totalWon = filteredDeals
    .filter((d) => d.stage === 'closed_won')
    .reduce((sum, d) => sum + d.value, 0)

  // Per-salesperson breakdown
  const salesRepData = useMemo(() => {
    return orgUsers.map((u) => { const name = u.name;
      const userDeals = filteredDeals.filter((d) => d.assignedTo === name)
      const won = userDeals.filter((d) => d.stage === 'closed_won')
      const lost = userDeals.filter((d) => d.stage === 'closed_lost')
      const active = userDeals.filter((d) => !['closed_won', 'closed_lost'].includes(d.stage))
      const wonValue = won.reduce((s, d) => s + d.value, 0)
      const pipelineValue = active.reduce((s, d) => s + d.value, 0)
      const winRate = won.length + lost.length > 0
        ? Math.round((won.length / (won.length + lost.length)) * 100)
        : 0
      const activitiesCount = activities.filter((a) => a.createdBy === name).length
      return { name, wonDeals: won.length, wonValue, pipelineValue, activeDeals: active.length, winRate, activitiesCount }
    }).sort((a, b) => b.wonValue - a.wonValue)
  }, [filteredDeals, activities])

  const handleExportCSV = () => {
    const rows = [
      [t.common.type, t.common.name, t.common.value, t.deals.stage, t.common.assignedTo, t.common.createdAt],
      ...filteredDeals.map((d) => [
        'Deal', d.title, String(d.value), t.deals.stageLabels[d.stage], d.assignedTo, d.createdAt.split('T')[0],
      ]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-deals-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Date filter */}
      <div className="flex items-center gap-4 flex-wrap">
        <p className="text-sm font-medium text-slate-400">{t.reports.periodLabel}:</p>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        <span className="text-slate-600">→</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        <div className="ml-auto">
          <PermissionGate permission="reports:export">
            <Button variant="secondary" size="sm" leftIcon={<Download size={14} />} onClick={handleExportCSV}>
              {t.common.export} CSV
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: t.reports.pipeline, value: formatCurrency(totalPipeline), color: 'text-brand-400' },
          { label: t.deals.stageLabels.closed_won, value: formatCurrency(totalWon), color: 'text-emerald-400' },
          { label: t.dashboard.activeDealsLabel, value: filteredDeals.filter((d) => !['closed_won', 'closed_lost'].includes(d.stage)).length, color: 'text-blue-400' },
          { label: t.reports.conversionRate, value: (() => {
            const closed = filteredDeals.filter((d) => ['closed_won', 'closed_lost'].includes(d.stage)).length
            const won = filteredDeals.filter((d) => d.stage === 'closed_won').length
            return closed > 0 ? `${Math.round((won / closed) * 100)}%` : '—'
          })(), color: 'text-yellow-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Revenue forecast */}
        <div className="glass p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-1">{t.reports.salesOverview}</h3>
          <p className="text-xs text-slate-500 mb-4">{t.forecast.weighted}</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={forecastData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1d35" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={TOOLTIP_STYLE}
                formatter={(v: unknown, name: unknown) => [formatCurrency(Number(v)), name === 'value' ? t.common.total : t.forecast.weighted]} />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} name="value" />
              <Bar dataKey="weighted" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="weighted" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Won vs Lost donut */}
        <div className="glass p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-1">{t.deals.won} vs {t.deals.lost}</h3>
          <p className="text-xs text-slate-500 mb-4">{t.reports.pipeline}</p>
          {wonLostData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={wonLostData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label>
                  {wonLostData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-60 text-slate-600 text-sm">{t.common.noResults}</div>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Activities by type */}
        <div className="glass p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">{t.reports.activityReport}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={activityTypeData} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {activityTypeData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Contacts by source */}
        <div className="glass p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">{t.contacts.title} ({t.contacts.source})</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={contactsBySource} cx="50%" cy="50%" outerRadius={75} dataKey="value" label labelLine={false} fontSize={10}>
                {contactsBySource.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline funnel */}
        <div className="glass p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">{t.reports.pipeline}</h3>
          {funnelData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <FunnelChart>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" fill="#94a3b8" stroke="none" dataKey="name" fontSize={10} />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-slate-600 text-sm">{t.common.noResults}</div>
          )}
        </div>
      </div>

      {/* Salesperson breakdown */}
      <div className="glass p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">{t.reports.performance}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {[t.common.name, t.leaderboard.dealsWon, t.leaderboard.revenue, t.reports.pipeline, t.dashboard.activeDealsLabel, t.reports.conversionRate, t.activities.title].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 py-2 pr-4 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {salesRepData.map((rep, idx) => (
                <tr key={rep.name} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 w-4">{idx + 1}</span>
                      <Avatar name={rep.name} size="xs" />
                      <span className="text-sm font-medium text-slate-200">{rep.name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-sm font-semibold text-emerald-400">{rep.wonDeals}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-sm font-semibold text-emerald-400">{formatCurrency(rep.wonValue)}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-sm text-brand-400">{formatCurrency(rep.pipelineValue)}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-sm text-white">{rep.activeDeals}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${rep.winRate}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-300">{rep.winRate}%</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="text-sm text-amber-400">{rep.activitiesCount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
