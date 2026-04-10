import {
  Phone, Mail, Users, FileText, CheckSquare, Linkedin,
  Check, Clock, X, Edit2,
} from 'lucide-react'
import type { Activity, ActivityType } from '../../types'
import { formatDate, formatRelativeDate } from '../../utils/formatters'
import { useTranslations } from '../../i18n'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

const TYPE_ICONS: Record<ActivityType, React.ReactNode> = {
  call: <Phone size={14} />,
  email: <Mail size={14} />,
  meeting: <Users size={14} />,
  note: <FileText size={14} />,
  task: <CheckSquare size={14} />,
  linkedin: <Linkedin size={14} />,
}

const TYPE_COLORS: Record<ActivityType, string> = {
  call: 'bg-blue-500/15 text-blue-400',
  email: 'bg-purple-500/15 text-purple-400',
  meeting: 'bg-emerald-500/15 text-emerald-400',
  note: 'bg-yellow-500/15 text-yellow-400',
  task: 'bg-indigo-500/15 text-indigo-400',
  linkedin: 'bg-blue-600/15 text-blue-500',
}

interface ActivityItemProps {
  activity: Activity
  onComplete?: (id: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  showActions?: boolean
}

export function ActivityItem({ activity, onComplete, onEdit, onDelete, showActions = true }: ActivityItemProps) {
  const t = useTranslations()
  const isOverdue = activity.status === 'pending' && activity.dueDate &&
    activity.dueDate < new Date().toISOString().split('T')[0]

  return (
    <div className={`flex gap-3 p-3 rounded-xl ${isOverdue ? 'bg-red-500/5 border border-red-500/20' : 'hover:bg-zinc-800/40'} transition-colors`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[activity.type]}`}>
        {TYPE_ICONS[activity.type]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{activity.subject}</p>
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{activity.description}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {activity.status === 'completed' ? (
              <Badge variant="emerald"><Check size={10} className="mr-0.5" />{t.activities.statusLabels.completed}</Badge>
            ) : activity.status === 'cancelled' ? (
              <Badge variant="gray">{t.activities.statusLabels.cancelled}</Badge>
            ) : (
              <Badge variant={isOverdue ? 'rose' : 'yellow'}>
                <Clock size={10} className="mr-0.5" />
                {isOverdue ? t.activities.overdue : t.activities.statusLabels.pending}
              </Badge>
            )}
          </div>
        </div>

        {activity.outcome && (
          <p className="text-xs text-zinc-400 mt-1 italic">"{activity.outcome}"</p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <span className="text-[10px] text-zinc-600">{t.activities.typeLabels[activity.type]}</span>
          {activity.dueDate && (
            <span className={`text-[10px] ${isOverdue ? 'text-red-400' : 'text-zinc-600'}`}>
              {formatDate(activity.dueDate)}
            </span>
          )}
          <span className="text-[10px] text-zinc-600">{activity.createdBy}</span>
          <span className="text-[10px] text-zinc-700 ml-auto">{formatRelativeDate(activity.createdAt)}</span>
        </div>
      </div>

      {showActions && (
        <div className="flex items-start gap-1 flex-shrink-0">
          {activity.status === 'pending' && onComplete && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onComplete(activity.id)}
              aria-label={t.activities.completed}
              className="p-1 text-emerald-400 hover:text-emerald-300"
            >
              <Check size={14} />
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onEdit(activity.id)}
              aria-label={t.common.edit}
              className="p-1 text-slate-400 hover:text-slate-200"
            >
              <Edit2 size={14} />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onDelete(activity.id)}
              aria-label={t.common.delete}
              className="p-1 text-red-400 hover:text-red-300"
            >
              <X size={14} />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
