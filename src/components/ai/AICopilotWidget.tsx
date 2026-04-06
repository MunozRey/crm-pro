import { useState, useEffect, useCallback } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { useAIStore } from '../../store/aiStore'
import { useContactsStore } from '../../store/contactsStore'
import { useDealsStore } from '../../store/dealsStore'
import { useActivitiesStore } from '../../store/activitiesStore'
import { useAuthStore } from '../../store/authStore'
import { computeDealHealth } from '../../utils/dealHealth'
import { generateDailyBrief } from '../../services/aiService'
import type { DailyBrief } from '../../services/aiService'

// ── Session storage cache ─────────────────────────────────────────────────────

const CACHE_KEY = 'ai_daily_brief'
const CACHE_TTL_MS = 30 * 60 * 1000

const tryLoadCache = (): { brief: DailyBrief; at: number } | null => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { brief: DailyBrief; at: number }
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

const saveCache = (brief: DailyBrief): void => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ brief, at: Date.now() }))
  } catch {
    // sessionStorage may be unavailable in certain environments — fail silently
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AICopilotWidget() {
  const { openRouterKey } = useAIStore()
  const contacts = useContactsStore((s) => s.contacts)
  const deals = useDealsStore((s) => s.deals)
  const activities = useActivitiesStore((s) => s.activities)
  const currentUser = useAuthStore((s) => s.currentUser)

  const [brief, setBrief] = useState<DailyBrief | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = useCallback(async () => {
    if (!openRouterKey || loading) return

    setLoading(true)
    setError(null)

    try {
      const openDeals = deals.filter(
        (d) => d.stage !== 'closed_won' && d.stage !== 'closed_lost',
      )
      const overdueActivities = activities.filter(
        (a) =>
          a.status === 'pending' &&
          a.dueDate != null &&
          a.dueDate < new Date().toISOString(),
      )
      const atRiskDealTitles = openDeals
        .filter((d) => computeDealHealth(d, activities).status === 'at_risk')
        .map((d) => d.title)
      const watchDealTitles = openDeals
        .filter((d) => computeDealHealth(d, activities).status === 'needs_attention')
        .map((d) => d.title)
      const pipelineValue = openDeals.reduce((s, d) => s + d.value, 0)
      const wonThisMonth = deals
        .filter(
          (d) =>
            d.stage === 'closed_won' &&
            d.updatedAt >=
              new Date(
                new Date().getFullYear(),
                new Date().getMonth(),
                1,
              ).toISOString(),
        )
        .reduce((s, d) => s + d.value, 0)

      const result = await generateDailyBrief(
        {
          userName: currentUser?.name ?? 'there',
          openDeals,
          overdueActivities,
          atRiskDealTitles,
          watchDealTitles,
          pipelineValue,
          wonThisMonth,
        },
      )

      saveCache(result)
      setBrief(result)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate briefing')
    } finally {
      setLoading(false)
    }
  }, [openRouterKey, deals, activities, contacts, currentUser, loading])

  // Auto-generate on mount: use cache if fresh, otherwise generate if openRouterKey exists
  useEffect(() => {
    if (!openRouterKey) return

    const cached = tryLoadCache()
    if (cached) {
      setBrief(cached.brief)
      setLastUpdated(new Date(cached.at))
      return
    }

    handleGenerate()
    // Only run on mount (and when openRouterKey first becomes available)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRouterKey])

  return (
    <div className="bg-navy-800/60 border border-brand-500/20 rounded-2xl p-5 relative overflow-hidden">
      {/* Gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-violet-500/5 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg btn-gradient flex items-center justify-center">
            <Sparkles size={13} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">AI Copilot</h2>
            <p className="text-[10px] text-slate-500">Daily Intelligence Briefing</p>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !openRouterKey}
          className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={lastUpdated ? `Last updated ${format(lastUpdated, 'HH:mm')}` : 'Generate briefing'}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {lastUpdated ? format(lastUpdated, 'HH:mm') : 'Generate'}
        </button>
      </div>

      {/* No API key state */}
      {!openRouterKey && (
        <p className="text-xs text-slate-500 py-4 text-center relative">
          Configure your OpenRouter API key in Settings to enable AI briefings.
        </p>
      )}

      {/* Error state */}
      {error && !loading && openRouterKey && (
        <div className="py-3 px-3 rounded-xl bg-red-500/8 border border-red-500/15 relative">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Loading shimmer */}
      {loading && (
        <div className="space-y-3 animate-pulse relative">
          <div className="h-3 bg-white/8 rounded-full w-3/4" />
          <div className="h-3 bg-white/8 rounded-full w-full" />
          <div className="h-3 bg-white/8 rounded-full w-2/3" />
          <div className="h-3 bg-white/8 rounded-full w-5/6" />
          <div className="h-3 bg-white/8 rounded-full w-1/2" />
        </div>
      )}

      {/* Brief content */}
      {brief && !loading && (
        <div className="space-y-4 relative">
          {/* Greeting */}
          <p className="text-sm text-slate-200 leading-relaxed">{brief.greeting}</p>

          {/* Priorities */}
          {brief.priorities.length > 0 && (
            <div className="space-y-2">
              {brief.priorities.map((p, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2.5 rounded-xl bg-white/4 border border-white/6"
                >
                  <span
                    className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      p.urgency === 'high'
                        ? 'bg-red-400'
                        : p.urgency === 'medium'
                        ? 'bg-amber-400'
                        : 'bg-sky-400'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-medium text-slate-200">{p.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{p.action}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Insight + Quick Win */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-brand-500/8 border border-brand-500/15">
              <p className="text-[10px] font-semibold text-brand-400 uppercase tracking-wide mb-1">
                Insight
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">{brief.insight}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide mb-1">
                Quick Win
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">{brief.quickWin}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
