import { useState, useCallback } from 'react'

export function useFilters<T extends Record<string, unknown>>(defaults: T) {
  const [filters, setFilters] = useState<T>(defaults)

  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(defaults)
  }, [defaults])

  const hasActiveFilters = Object.entries(filters).some(([, v]) => {
    if (Array.isArray(v)) return v.length > 0
    return v !== '' && v !== null && v !== undefined
  })

  return { filters, setFilter, clearFilters, hasActiveFilters }
}
