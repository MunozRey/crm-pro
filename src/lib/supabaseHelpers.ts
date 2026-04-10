import { supabase, isSupabaseConfigured } from './supabase'
import { useAuthStore } from '../store/authStore'

/** Get current org ID from authStore -- used for all inserts */
export function getOrgId(): string {
  const orgId = useAuthStore.getState().organizationId
  if (!orgId) throw new Error('[supabaseHelpers] No organizationId in authStore')
  return orgId
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as { message?: unknown }).message
    if (typeof msg === 'string') return msg
  }
  return 'Unknown error'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => supabase as any

/** Generic select with ordering */
export async function sbSelect<T>(table: string): Promise<T[]> {
  if (!isSupabaseConfigured || !supabase) return []
  const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as T[]
}

/** Generic insert -- adds organization_id automatically */
export async function sbInsert(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured')
  const { data, error } = await sb().from(table).insert({ ...row, organization_id: getOrgId() }).select().single()
  if (error) throw error
  return data as Record<string, unknown>
}

/** Generic update by id */
export async function sbUpdate(table: string, id: string, updates: Record<string, unknown>): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured')
  const { error } = await sb().from(table).update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/** Generic delete by id */
export async function sbDelete(table: string, id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

/** Generic bulk delete */
export async function sbBulkDelete(table: string, ids: string[]): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from(table).delete().in('id', ids)
  if (error) throw error
}

export function runSupabaseWrite(
  context: string,
  operation: PromiseLike<{ error: unknown | null }>,
  onError?: (message: string) => void,
): void {
  operation
    .then(({ error }) => {
      if (!error) return
      const message = getErrorMessage(error)
      console.error(`[${context}]`, message)
      onError?.(message)
    }, (error: unknown) => {
      const message = getErrorMessage(error)
      console.error(`[${context}]`, message)
      onError?.(message)
    })
}
