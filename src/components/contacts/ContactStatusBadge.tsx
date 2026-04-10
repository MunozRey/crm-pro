import { Badge } from '../ui/Badge'
import type { ContactStatus } from '../../types'
import { CONTACT_STATUS_COLORS } from '../../utils/constants'
import { useTranslations } from '../../i18n'

interface ContactStatusBadgeProps {
  status: ContactStatus
}

type BadgeColor = 'blue' | 'yellow' | 'green' | 'red'

export function ContactStatusBadge({ status }: ContactStatusBadgeProps) {
  const t = useTranslations()
  return (
    <Badge variant={CONTACT_STATUS_COLORS[status] as BadgeColor}>
      {t.contacts.statusLabels[status]}
    </Badge>
  )
}
