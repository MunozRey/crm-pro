import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { CRMNotification, NotificationType } from '../types'
import { useAuthStore } from './authStore'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getOrgId, sbDelete } from '../lib/supabaseHelpers'

const MAX_NOTIFICATIONS = 200

export const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  'deal_won', 'deal_lost', 'deal_stage_changed',
  'activity_overdue', 'activity_assigned',
  'follow_up_due', 'contact_assigned',
  'goal_achieved', 'goal_at_risk',
  'mention', 'system',
]

// ── Snake ↔ Camel mappers ───────────────────────────────────────────────────

function rowToNotification(row: Record<string, unknown>): CRMNotification {
  return {
    id: row.id as string,
    type: (row.type as NotificationType) ?? 'system',
    title: (row.title as string) ?? '',
    message: (row.message as string) ?? '',
    entityType: (row.entity_type as CRMNotification['entityType']) ?? undefined,
    entityId: (row.entity_id as string) ?? undefined,
    userId: (row.user_id as string) ?? '',
    triggeredBy: (row.triggered_by as string) ?? undefined,
    isRead: (row.is_read as boolean) ?? false,
    createdAt: (row.created_at as string) ?? '',
  }
}

function notificationToRow(n: Partial<CRMNotification>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (n.type !== undefined) row.type = n.type
  if (n.title !== undefined) row.title = n.title
  if (n.message !== undefined) row.message = n.message
  if (n.entityType !== undefined) row.entity_type = n.entityType
  if (n.entityId !== undefined) row.entity_id = n.entityId
  if (n.userId !== undefined) row.user_id = n.userId
  if (n.triggeredBy !== undefined) row.triggered_by = n.triggeredBy
  if (n.isRead !== undefined) row.is_read = n.isRead
  return row
}

// ── Seed notifications ──────────────────────────────────────────────────────

function getSeedNotifications(): CRMNotification[] {
  const now = new Date()
  return [
    {
      id: 'notif-seed-1',
      type: 'deal_won',
      title: 'Deal ganado: Migracion Cloud TechStart',
      message: 'El deal "Migracion Cloud TechStart" se ha cerrado exitosamente por 45.000 EUR',
      entityType: 'deal',
      entityId: 'deal-001',
      userId: 'user-001',
      triggeredBy: 'David Munoz',
      isRead: false,
      createdAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
    },
    {
      id: 'notif-seed-2',
      type: 'deal_stage_changed',
      title: 'ERP Integration avanzo',
      message: 'De qualified a proposal',
      entityType: 'deal',
      entityId: 'deal-003',
      userId: 'user-001',
      triggeredBy: 'Sara Garcia',
      isRead: false,
      createdAt: new Date(now.getTime() - 5 * 3600000).toISOString(),
    },
    {
      id: 'notif-seed-3',
      type: 'activity_overdue',
      title: 'Actividad vencida: Llamada de seguimiento',
      message: 'La llamada programada con Laura Sanchez esta vencida',
      entityType: 'activity',
      entityId: 'act-001',
      userId: 'user-001',
      triggeredBy: 'Sistema',
      isRead: false,
      createdAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
    },
    {
      id: 'notif-seed-4',
      type: 'goal_achieved',
      title: 'Objetivo logrado: Actividades mensuales',
      message: 'Has completado tu objetivo de 50 actividades este mes',
      entityType: 'goal',
      userId: 'user-001',
      triggeredBy: 'Sistema',
      isRead: true,
      createdAt: new Date(now.getTime() - 48 * 3600000).toISOString(),
    },
    {
      id: 'notif-seed-5',
      type: 'system',
      title: 'Bienvenido a CRM Pro',
      message: 'Tu cuenta ha sido configurada. Explora las funcionalidades del sistema.',
      userId: 'user-001',
      triggeredBy: 'Sistema',
      isRead: true,
      createdAt: new Date(now.getTime() - 72 * 3600000).toISOString(),
    },
  ]
}

// ── Store ───────────────────────────────────────────────────────────────────

interface NotificationsStore {
  notifications: CRMNotification[]
  isLoading: boolean
  error: string | null
  // Per-type preferences: disabled types are not shown (still stored but muted)
  disabledTypes: Set<NotificationType>

  fetchNotifications: () => Promise<void>
  notify: (
    type: NotificationType,
    title: string,
    message: string,
    opts?: {
      entityType?: CRMNotification['entityType']
      entityId?: string
      triggeredBy?: string
      userId?: string
    }
  ) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  deleteNotification: (id: string) => void
  clearAll: () => void
  getUnreadCount: () => number
  getUnread: () => CRMNotification[]
  getByEntity: (entityType: string, entityId: string) => CRMNotification[]
  toggleType: (type: NotificationType) => void
  isTypeEnabled: (type: NotificationType) => boolean
}

export const useNotificationsStore = create<NotificationsStore>()(
  (set, get) => ({
    notifications: [],
    isLoading: false,
    error: null,
    disabledTypes: new Set<NotificationType>(),

    fetchNotifications: async () => {
      set({ isLoading: true, error: null })
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(MAX_NOTIFICATIONS)
          if (error) throw error
          set({ notifications: (data ?? []).map(rowToNotification), isLoading: false })
        } else {
          set({ notifications: getSeedNotifications(), isLoading: false })
        }
      } catch (e: unknown) {
        set({ error: (e as Error).message, isLoading: false })
      }
    },

    notify: (type, title, message, opts) => {
      // Respect notification preferences
      if (get().disabledTypes.has(type)) return
      const currentUser = useAuthStore.getState().currentUser
      const notification: CRMNotification = {
        id: uuidv4(),
        type,
        title,
        message,
        entityType: opts?.entityType,
        entityId: opts?.entityId,
        userId: opts?.userId || currentUser?.id || 'system',
        triggeredBy: opts?.triggeredBy || currentUser?.name || 'Sistema',
        isRead: false,
        createdAt: new Date().toISOString(),
      }
      set((state) => ({
        notifications: [notification, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
      }))

      if (isSupabaseConfigured && supabase) {
        const row = notificationToRow(notification)
        ;(supabase as any).from('notifications').insert({ ...row, organization_id: getOrgId() } as any)
          .then(({ error }: any) => {
            if (error) set({ error: error.message })
          })
      }
    },

    markAsRead: (id) => {
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        ),
      }))

      if (isSupabaseConfigured && supabase) {
        ;(supabase as any).from('notifications').update({ is_read: true }).eq('id', id)
          .then(({ error }: any) => {
            if (error) set({ error: error.message })
          })
      }
    },

    markAllAsRead: () => {
      const unreadIds = get().notifications.filter((n) => !n.isRead).map((n) => n.id)
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      }))

      if (isSupabaseConfigured && supabase && unreadIds.length > 0) {
        ;(supabase as any).from('notifications').update({ is_read: true }).in('id', unreadIds)
          .then(({ error }: any) => {
            if (error) set({ error: error.message })
          })
      }
    },

    deleteNotification: (id) => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }))

      if (isSupabaseConfigured && supabase) {
        sbDelete('notifications', id).then(null, (e) => set({ error: (e as Error).message }))
      }
    },

    clearAll: () => {
      const ids = get().notifications.map((n) => n.id)
      set({ notifications: [] })

      if (isSupabaseConfigured && supabase && ids.length > 0) {
        ;(supabase as any).from('notifications').delete().in('id', ids)
          .then(({ error }: any) => {
            if (error) set({ error: error.message })
          })
      }
    },

    getUnreadCount: () => {
      return get().notifications.filter((n) => !n.isRead).length
    },

    getUnread: () => {
      return get().notifications.filter((n) => !n.isRead)
    },

    getByEntity: (entityType, entityId) => {
      return get().notifications.filter(
        (n) => n.entityType === entityType && n.entityId === entityId
      )
    },

    toggleType: (type) => {
      set((state) => {
        const next = new Set(state.disabledTypes)
        if (next.has(type)) next.delete(type)
        else next.add(type)
        return { disabledTypes: next }
      })
    },

    isTypeEnabled: (type) => {
      return !get().disabledTypes.has(type)
    },
  })
)
