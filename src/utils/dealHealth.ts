import { differenceInDays, parseISO } from 'date-fns'
import type { Deal, Activity, DealStage } from '../types'

export type DealHealthStatus = 'strong' | 'on_track' | 'needs_attention' | 'at_risk'

export interface DealHealth {
  score: number           // 0–100
  status: DealHealthStatus
  primaryReason: string   // first issue, or '' if healthy
  reasons: string[]
}

const STAGE_THRESHOLDS_DAYS: Partial<Record<DealStage, number>> = {
  lead: 14,
  qualified: 21,
  proposal: 14,
  negotiation: 30,
}

export function computeDealHealth(deal: Deal, activities: Activity[]): DealHealth {
  // Closed deals are always "strong" (no score shown)
  if (deal.stage === 'closed_won' || deal.stage === 'closed_lost') {
    return { score: 100, status: 'strong', primaryReason: '', reasons: [] }
  }

  let score = 100
  const reasons: string[] = []
  const now = new Date()
  const dealActivities = activities.filter(a => a.dealId === deal.id)

  // Factor 1: days since last completed activity
  const lastCompleted = dealActivities
    .filter(a => a.status === 'completed' && a.completedAt)
    .sort((a, b) => (b.completedAt! > a.completedAt! ? 1 : -1))[0]

  const daysSince = lastCompleted?.completedAt
    ? differenceInDays(now, parseISO(lastCompleted.completedAt))
    : 999

  if (daysSince >= 30) { score -= 40; reasons.push('No activity in 30+ days') }
  else if (daysSince >= 14) { score -= 20; reasons.push('No activity in 14+ days') }
  else if (daysSince >= 7)  { score -= 10; reasons.push('No activity in 7+ days') }

  // Factor 2: overdue activities
  const overdue = dealActivities.filter(
    a => a.status === 'pending' && a.dueDate && a.dueDate < now.toISOString()
  ).length
  if (overdue >= 2) { score -= 20; reasons.push(`${overdue} overdue activities`) }
  else if (overdue === 1) { score -= 10; reasons.push('1 overdue activity') }

  // Factor 3: stuck in stage
  const daysInStage = differenceInDays(now, parseISO(deal.updatedAt))
  const threshold = STAGE_THRESHOLDS_DAYS[deal.stage]
  if (threshold) {
    if (daysInStage > threshold * 2) { score -= 25; reasons.push(`Stuck ${daysInStage}d in stage`) }
    else if (daysInStage > threshold) { score -= 10; reasons.push(`${daysInStage}d in stage`) }
  }

  // Factor 4: past expected close date
  if (deal.expectedCloseDate) {
    const daysToClose = differenceInDays(parseISO(deal.expectedCloseDate), now)
    if (daysToClose < -7)  { score -= 20; reasons.push('Past close date 7+ days') }
    else if (daysToClose < 0) { score -= 10; reasons.push('Past expected close date') }
  }

  score = Math.max(0, Math.min(100, score))
  const status: DealHealthStatus =
    score >= 80 ? 'strong' :
    score >= 60 ? 'on_track' :
    score >= 35 ? 'needs_attention' : 'at_risk'

  return { score, status, primaryReason: reasons[0] ?? '', reasons }
}

export function healthStatusColor(status: DealHealthStatus) {
  return status === 'strong'          ? 'text-emerald-400'
       : status === 'on_track'        ? 'text-sky-400'
       : status === 'needs_attention' ? 'text-amber-400'
       : 'text-red-400'
}

export function healthStatusBg(status: DealHealthStatus) {
  return status === 'strong'          ? 'bg-emerald-500/15 border-emerald-500/25'
       : status === 'on_track'        ? 'bg-sky-500/15 border-sky-500/25'
       : status === 'needs_attention' ? 'bg-amber-500/15 border-amber-500/25'
       : 'bg-red-500/15 border-red-500/25'
}
