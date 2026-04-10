import { useState, useEffect } from 'react'
import { Bookmark, Plus, Pin, X, Flame, Users, Handshake, TrendingUp, Cloud } from 'lucide-react'
import { useViewsStore } from '../../store/viewsStore'
import type { CustomFieldEntityType, SmartViewFilter } from '../../types'
import { useTranslations } from '../../i18n'

// Icon map for view icons
const ICON_MAP: Record<string, React.ReactNode> = {
  flame: <Flame size={13} />,
  users: <Users size={13} />,
  handshake: <Handshake size={13} />,
  'trending-up': <TrendingUp size={13} />,
  cloud: <Cloud size={13} />,
  bookmark: <Bookmark size={13} />,
}

const COLOR_MAP: Record<string, string> = {
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  brand: 'bg-brand-500/20 text-brand-400 border-brand-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  sky: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

interface SmartViewBarProps {
  entityType: CustomFieldEntityType
  onFiltersChange: (filters: SmartViewFilter[]) => void
}

export function SmartViewBar({ entityType, onFiltersChange }: SmartViewBarProps) {
  const t = useTranslations()
  // Manual subscriptions for persisted store — never use useStore selector here
  const [views, setViews] = useState(() => useViewsStore.getState().views)
  const [activeViewId, setActiveViewId] = useState(() => useViewsStore.getState().activeViewId)

  useEffect(() => {
    return useViewsStore.subscribe((s) => {
      setViews(s.views)
      setActiveViewId(s.activeViewId)
    })
  }, [])

  const [showDropdown, setShowDropdown] = useState(false)

  const entityViews = views.filter((v) => v.entityType === entityType)
  const pinnedViews = entityViews.filter((v) => v.isPinned)
  const unpinnedViews = entityViews.filter((v) => !v.isPinned)
  const currentActiveId = activeViewId[entityType]

  const handleSelectView = (viewId: string | null) => {
    useViewsStore.getState().setActiveView(entityType, viewId)
    if (viewId) {
      const view = views.find((v) => v.id === viewId)
      onFiltersChange(view?.filters ?? [])
    } else {
      onFiltersChange([])
    }
    setShowDropdown(false)
  }

  if (entityViews.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* "All" pill */}
      <button
        onClick={() => handleSelectView(null)}
        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
          !currentActiveId
            ? 'bg-white/10 border-white/20 text-white'
            : 'bg-white/4 border-white/8 text-slate-500 hover:text-slate-300'
        }`}
      >
        {t.common.all}
      </button>

      {/* Pinned view pills */}
      {pinnedViews.map((view) => {
        const isActive = currentActiveId === view.id
        const colorClass = view.color ? (COLOR_MAP[view.color] ?? '') : ''
        return (
          <button
            key={view.id}
            onClick={() => handleSelectView(isActive ? null : view.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              isActive
                ? colorClass || 'bg-brand-500/20 text-brand-400 border-brand-500/30'
                : 'bg-white/4 border-white/8 text-slate-500 hover:text-slate-300'
            }`}
          >
            {view.icon && ICON_MAP[view.icon]}
            {view.name}
            {isActive && <X size={11} className="ml-0.5 opacity-60" />}
          </button>
        )
      })}

      {/* More views dropdown — shown only when there are unpinned views */}
      {unpinnedViews.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowDropdown((v) => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-[#0d0e1a] border border-white/8 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Plus size={12} />
            {t.common.view}
          </button>
          {showDropdown && (
            <>
              {/* Click-away overlay */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowDropdown(false)}
              />
              <div
                className="absolute top-full left-0 mt-1 w-56 rounded-xl border border-white/10 shadow-2xl z-50 py-1 bg-[#0d0f1e]"
              >
                {unpinnedViews.map((view) => (
                  <button
                    key={view.id}
                    onClick={() => handleSelectView(view.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {view.icon && ICON_MAP[view.icon]}
                    <span className="flex-1 text-left">{view.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        useViewsStore.getState().togglePin(view.id)
                      }}
                      className="text-slate-600 hover:text-brand-400 transition-colors"
                      title={t.common.add}
                    >
                      <Pin size={11} />
                    </button>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
