import type { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: ReactNode
  subtitle?: string
  icon: ReactNode
  iconBg?: string
  trend?: {
    value: string
    up: boolean
  }
  accent?: 'blue' | 'violet' | 'emerald' | 'amber'
}

const accentMap = {
  blue:    { icon: 'bg-brand-600/15 text-brand-400', glow: 'group-hover:shadow-brand-sm' },
  violet:  { icon: 'bg-violet-600/15 text-violet-400', glow: 'group-hover:shadow-glow-violet' },
  emerald: { icon: 'bg-emerald-600/15 text-emerald-400', glow: '' },
  amber:   { icon: 'bg-amber-600/15 text-amber-400', glow: '' },
}

export function StatCard({ title, value, subtitle, icon, iconBg, trend, accent = 'blue' }: StatCardProps) {
  const ac = accentMap[accent]
  return (
    <div className={`glass rounded-2xl p-5 glass-hover group cursor-default transition-all duration-200 ${ac.glow}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{title}</p>
          <p className="text-2xl font-bold text-white truncate stat-number">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1.5">{subtitle}</p>}
          {trend && (
            <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium
              ${trend.up
                ? 'bg-emerald-500/12 text-emerald-400'
                : 'bg-red-500/12 text-red-400'
              }`}
            >
              <span>{trend.up ? '↑' : '↓'}</span>
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        <div className={`${iconBg ?? ac.icon} rounded-xl p-3 flex-shrink-0 ml-3 transition-transform duration-200 group-hover:scale-110`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
