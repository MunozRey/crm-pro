type UxActionName =
  | 'quick_create_contact'
  | 'quick_create_deal'
  | 'quick_create_activity'
  | 'inbox_search'
  | 'inbox_load_more'
  | 'activity_complete'
  | 'activity_edit'
  | 'activity_delete'

interface UxMetricEvent {
  action: UxActionName
  timestamp: string
  meta?: Record<string, string | number | boolean | null>
}

const LS_KEY = 'crm_ux_metrics_v1'
const MAX_EVENTS = 400

export function trackUxAction(action: UxActionName, meta?: UxMetricEvent['meta']) {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const existing: UxMetricEvent[] = raw ? (JSON.parse(raw) as UxMetricEvent[]) : []
    const next: UxMetricEvent[] = [
      ...existing,
      { action, timestamp: new Date().toISOString(), meta },
    ].slice(-MAX_EVENTS)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  } catch {
    // Non-blocking telemetry helper.
  }
}

