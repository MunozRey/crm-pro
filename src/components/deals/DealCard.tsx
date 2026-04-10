import { Draggable } from '@hello-pangea/dnd'
import type { Deal } from '../../types'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { DEAL_PRIORITY_COLORS } from '../../utils/constants'
import { Avatar } from '../ui/Avatar'
import { useContactsStore } from '../../store/contactsStore'
import { useCompaniesStore } from '../../store/companiesStore'
import { useActivitiesStore } from '../../store/activitiesStore'
import { computeDealHealth, healthStatusColor, healthStatusBg } from '../../utils/dealHealth'
import { CalendarDays } from 'lucide-react'

interface DealCardProps {
  deal: Deal
  index: number
  onClick: () => void
}

function getDealAgeDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
}

function getAgingColor(days: number): { bg: string; text: string } {
  if (days < 7) return { bg: 'bg-emerald-500/15', text: 'text-emerald-400' }
  if (days <= 30) return { bg: 'bg-amber-500/15', text: 'text-amber-400' }
  return { bg: 'bg-red-500/15', text: 'text-red-400' }
}

export function DealCard({ deal, index, onClick }: DealCardProps) {
  const contact = useContactsStore((s) => s.contacts.find((c) => c.id === deal.contactId))
  const company = useCompaniesStore((s) => s.companies.find((c) => c.id === deal.companyId))
  const activities = useActivitiesStore((s) => s.activities)
  const health = computeDealHealth(deal, activities)

  const isOverdue = deal.expectedCloseDate < new Date().toISOString().split('T')[0]
    && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost'

  const ageDays = getDealAgeDays(deal.createdAt)
  const aging = getAgingColor(ageDays)

  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`
            bg-[#111220] border rounded-xl p-3 cursor-pointer
            transition-all duration-150 select-none
            ${snapshot.isDragging
              ? 'border-indigo-500 shadow-xl shadow-indigo-500/10 rotate-1'
              : 'border-white/8 hover:border-white/16'
            }
          `}
        >
          {/* Title + priority dot + aging badge */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-sm font-medium text-white leading-snug line-clamp-2">{deal.title}</p>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${aging.bg} ${aging.text}`}>
                {ageDays}d
              </span>
            </div>
            <div
              className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
              style={{ backgroundColor: DEAL_PRIORITY_COLORS[deal.priority] }}
              title={`Prioridad: ${deal.priority}`}
            />
          </div>

          {/* Health badge */}
          {health.status !== 'strong' && health.status !== 'on_track' && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost' && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border mb-2 ${healthStatusBg(health.status)} ${healthStatusColor(health.status)}`}
              title={health.reasons.join(' · ')}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${health.status === 'at_risk' ? 'bg-red-400 animate-pulse' : 'bg-amber-400'}`} />
              {health.status === 'at_risk' ? 'At risk' : 'Watch'}
            </span>
          )}

          {/* Company */}
          {company && (
            <p className="text-xs text-slate-500 mb-2 truncate">{company.name}</p>
          )}

          {/* Value */}
          <p className="text-sm font-bold text-emerald-400 mb-2">
            {formatCurrency(deal.value, deal.currency)}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CalendarDays size={11} className={isOverdue ? 'text-red-400' : 'text-slate-600'} />
              <span className={`text-[10px] ${isOverdue ? 'text-red-400' : 'text-slate-600'}`}>
                {formatDate(deal.expectedCloseDate)}
              </span>
            </div>
            {contact && (
              <Avatar
                name={`${contact.firstName} ${contact.lastName}`}
                size="xs"
              />
            )}
          </div>
        </div>
      )}
    </Draggable>
  )
}
