import { useState, useMemo } from 'react'

export function useSearch<T>(
  items: T[],
  searchFields: (keyof T)[],
  query: string
): T[] {
  return useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter((item) =>
      searchFields.some((field) => {
        const val = item[field]
        if (typeof val === 'string') return val.toLowerCase().includes(q)
        return false
      })
    )
  }, [items, searchFields, query])
}

export function useSearchQuery(initial = '') {
  const [query, setQuery] = useState(initial)
  return { query, setQuery }
}
