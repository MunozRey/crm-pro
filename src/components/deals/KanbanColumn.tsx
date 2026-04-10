import { Droppable } from '@hello-pangea/dnd'
import type { Deal, DealStage } from '../../types'
import { DealCard } from './DealCard'
import { formatCurrency } from '../../utils/formatters'
import { useTranslations } from '../../i18n'

interface KanbanColumnProps {
  stage: DealStage
  deals: Deal[]
  onDealClick: (deal: Deal) => void
  color: string
}

export function KanbanColumn({ stage, deals, onDealClick, color }: KanbanColumnProps) {
  const t = useTranslations()
  const totalValue = deals.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold text-slate-300">{t.deals.stageLabels[stage]}</span>
          <span className="text-xs text-slate-500 bg-white/4 px-1.5 py-0.5 rounded-full">
            {deals.length}
          </span>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {formatCurrency(totalValue)}
        </span>
      </div>

      {/* Drop zone */}
      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 rounded-xl min-h-[200px] p-2 space-y-2 transition-colors
              ${snapshot.isDraggingOver
                ? 'bg-indigo-500/10 border border-indigo-500/30'
                : 'bg-navy-800/30 border border-white/6'
              }
            `}
          >
            {deals.map((deal, index) => (
              <DealCard
                key={deal.id}
                deal={deal}
                index={index}
                onClick={() => onDealClick(deal)}
              />
            ))}
            {provided.placeholder}
            {deals.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center h-20 text-slate-700 text-xs">
                Arrastra deals aquí
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  )
}
