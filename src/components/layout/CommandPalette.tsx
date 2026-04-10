import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, Building2, KanbanSquare, Activity, LayoutDashboard, BarChart3, Settings, ArrowRight } from 'lucide-react'
import { useContactsStore } from '../../store/contactsStore'
import { useCompaniesStore } from '../../store/companiesStore'
import { useDealsStore } from '../../store/dealsStore'
import { useTranslations } from '../../i18n'

interface CommandItem {
  id: string
  label: string
  sublabel?: string
  icon: React.ReactNode
  action: () => void
  category: string
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const t = useTranslations()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const contacts = useContactsStore((s) => s.contacts)
  const companies = useCompaniesStore((s) => s.companies)
  const deals = useDealsStore((s) => s.deals)

  const go = (path: string) => { navigate(path); onClose() }

  const navLabel = t.navSections.main
  const staticItems: CommandItem[] = [
    { id: 'nav-dashboard', label: t.nav.dashboard, icon: <LayoutDashboard size={15} />, action: () => go('/'), category: navLabel },
    { id: 'nav-contacts', label: t.nav.contacts, icon: <Users size={15} />, action: () => go('/contacts'), category: navLabel },
    { id: 'nav-companies', label: t.nav.companies, icon: <Building2 size={15} />, action: () => go('/companies'), category: navLabel },
    { id: 'nav-deals', label: t.nav.deals, icon: <KanbanSquare size={15} />, action: () => go('/deals'), category: navLabel },
    { id: 'nav-activities', label: t.nav.activities, icon: <Activity size={15} />, action: () => go('/activities'), category: navLabel },
    { id: 'nav-reports', label: t.nav.reports, icon: <BarChart3 size={15} />, action: () => go('/reports'), category: navLabel },
    { id: 'nav-settings', label: t.nav.settings, icon: <Settings size={15} />, action: () => go('/settings'), category: navLabel },
  ]

  const dynamicItems: CommandItem[] = useMemo(() => {
    if (query.length < 2) return []
    const q = query.toLowerCase()
    const results: CommandItem[] = []

    contacts.filter((c) => `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(q)).slice(0, 4).forEach((c) => {
      results.push({
        id: `contact-${c.id}`,
        label: `${c.firstName} ${c.lastName}`,
        sublabel: c.email,
        icon: <Users size={15} />,
        action: () => go(`/contacts/${c.id}`),
        category: t.nav.contacts,
      })
    })

    companies.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 3).forEach((c) => {
      results.push({
        id: `company-${c.id}`,
        label: c.name,
        sublabel: c.industry,
        icon: <Building2 size={15} />,
        action: () => go(`/companies/${c.id}`),
        category: t.nav.companies,
      })
    })

    deals.filter((d) => d.title.toLowerCase().includes(q)).slice(0, 3).forEach((d) => {
      results.push({
        id: `deal-${d.id}`,
        label: d.title,
        sublabel: `€${d.value.toLocaleString()}`,
        icon: <KanbanSquare size={15} />,
        action: () => go('/deals'),
        category: 'Deals',
      })
    })

    return results
  }, [query, contacts, companies, deals])

  const filteredStatic = query.length < 2
    ? staticItems
    : staticItems.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))

  const allItems = [...dynamicItems, ...filteredStatic]

  useEffect(() => {
    setSelected(0)
  }, [query])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, allItems.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
      if (e.key === 'Enter' && allItems[selected]) { allItems[selected].action() }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, allItems, selected, onClose])

  if (!isOpen) return null

  // Group by category
  const groups: Record<string, CommandItem[]> = {}
  allItems.forEach((item) => {
    if (!groups[item.category]) groups[item.category] = []
    groups[item.category].push(item)
  })

  let itemIndex = 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" aria-modal="true">
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 glass rounded-2xl shadow-float border-white/12 overflow-hidden animate-scale-in">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8">
          <Search size={16} className="text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.common.searchPlaceholder}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded-md bg-white/8 text-[10px] font-medium text-slate-500 flex-shrink-0">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {allItems.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-500">{t.common.noResults} "{query}"</p>
          )}

          {Object.entries(groups).map(([category, items]) => (
            <div key={category}>
              <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">{category}</p>
              {items.map((item) => {
                const idx = itemIndex++
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setSelected(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      selected === idx ? 'bg-brand-600/15 text-white' : 'text-slate-400 hover:text-white hover:bg-white/4'
                    }`}
                  >
                    <span className={`flex-shrink-0 ${selected === idx ? 'text-brand-400' : 'text-slate-500'}`}>
                      {item.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="text-sm font-medium block truncate">{item.label}</span>
                      {item.sublabel && (
                        <span className="text-xs text-slate-500 block truncate">{item.sublabel}</span>
                      )}
                    </span>
                    {selected === idx && <ArrowRight size={14} className="flex-shrink-0 text-brand-400" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/6 flex items-center gap-4 text-[10px] text-slate-600">
          <span><kbd className="font-semibold">↑↓</kbd> navegar</span>
          <span><kbd className="font-semibold">↵</kbd> abrir</span>
          <span><kbd className="font-semibold">ESC</kbd> cerrar</span>
        </div>
      </div>
    </div>
  )
}
