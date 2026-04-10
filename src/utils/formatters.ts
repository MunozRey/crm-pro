import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    return format(date, 'dd MMM yyyy', { locale: es })
  } catch {
    return dateStr
  }
}

export function formatDateShort(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    return format(date, 'dd/MM/yyyy')
  } catch {
    return dateStr
  }
}

export function formatRelativeDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    if (isToday(date)) return 'Hoy'
    if (isYesterday(date)) return 'Ayer'
    return formatDistanceToNow(date, { addSuffix: true, locale: es })
  } catch {
    return dateStr
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-ES').format(value)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function formatPhoneNumber(phone: string): string {
  return phone
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '…'
}
