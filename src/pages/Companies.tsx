import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Building2, Filter, X, Trash2 } from 'lucide-react'
import { useCompaniesStore } from '../store/companiesStore'
import { useContactsStore } from '../store/contactsStore'
import { useDealsStore } from '../store/dealsStore'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { SearchBar } from '../components/shared/SearchBar'
import { SmartViewBar } from '../components/shared/SmartViewBar'
import { EmptyState } from '../components/shared/EmptyState'
import { SlideOver, ConfirmDialog } from '../components/ui/Modal'
import { CompanyForm } from '../components/companies/CompanyForm'
import { Select } from '../components/ui/Select'
import { toast } from '../store/toastStore'
import { formatCurrency } from '../utils/formatters'
import { COMPANY_INDUSTRY_LABELS, COMPANY_SIZE_OPTIONS } from '../utils/constants'
import type { Company, CompanyStatus, SmartViewFilter } from '../types'
import { PermissionGate } from '../components/auth/PermissionGate'
import { useTranslations } from '../i18n'

type StatusBadge = 'yellow' | 'green' | 'indigo' | 'red'
const STATUS_COLORS: Record<string, StatusBadge> = {
  prospect: 'yellow', customer: 'green', partner: 'indigo', churned: 'red',
}

export function Companies() {
  const t = useTranslations()
  const navigate = useNavigate()
  const { companies, addCompany, updateCompany, deleteCompany } = useCompaniesStore()
  const contacts = useContactsStore((s) => s.contacts)
  const deals = useDealsStore((s) => s.deals)

  const statusLabel = (status: string) => (t.companies.statusLabels as Record<string, string>)[status] ?? status

  const [search, setSearch] = useState('')
  const [industryFilter, setIndustryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sizeFilter, setSizeFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editCompany, setEditCompany] = useState<Company | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [viewFilters, setViewFilters] = useState<SmartViewFilter[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDelete, setShowBulkDelete] = useState(false)

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
      if (industryFilter && c.industry !== industryFilter) return false
      if (statusFilter && c.status !== statusFilter) return false
      if (sizeFilter && c.size !== sizeFilter) return false
      // Apply smart view filters
      for (const vf of viewFilters) {
        const fieldValue = (c as unknown as Record<string, unknown>)[vf.field]
        if (vf.operator === 'eq' && fieldValue !== vf.value) return false
        if (vf.operator === 'neq' && fieldValue === vf.value) return false
        if (vf.operator === 'contains' && typeof fieldValue === 'string' && !fieldValue.toLowerCase().includes(String(vf.value).toLowerCase())) return false
      }
      return true
    })
  }, [companies, search, industryFilter, statusFilter, sizeFilter, viewFilters])

  const hasFilters = industryFilter || statusFilter || sizeFilter

  const handleCreate = (data: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'contacts' | 'deals' | 'tags'>) => {
    addCompany({ ...data, contacts: [], deals: [], tags: [] })
    setIsFormOpen(false)
    toast.success(t.companies.created)
  }

  const handleEdit = (data: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'contacts' | 'deals' | 'tags'>) => {
    if (!editCompany) return
    updateCompany(editCompany.id, data)
    setEditCompany(undefined)
    toast.success(t.companies.updated)
  }

  const handleDelete = (id: string) => {
    deleteCompany(id)
    toast.success(t.companies.deleted)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(c => c.id)))
  }

  const handleBulkDelete = () => {
    selectedIds.forEach(id => useCompaniesStore.getState().deleteCompany(id))
    toast.success(`${selectedIds.size} ${t.companies.bulkDeleted}`)
    setSelectedIds(new Set())
    setShowBulkDelete(false)
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <SearchBar value={search} onChange={setSearch} placeholder={t.common.searchPlaceholder} className="w-72" />
        <Button
          variant={showFilters ? 'secondary' : 'ghost'}
          size="sm"
          leftIcon={<Filter size={14} />}
          onClick={() => setShowFilters((v) => !v)}
        >
          {t.common.filters}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-slate-400">{selectedIds.size} {t.common.selected}</span>

              {/* Mass Status Update */}
              <select
                onChange={(e) => {
                  if (!e.target.value) return
                  const status = e.target.value as CompanyStatus
                  selectedIds.forEach(id => useCompaniesStore.getState().updateCompany(id, { status }))
                  toast.success(`${selectedIds.size} ${t.nav.companies.toLowerCase()} ${t.common.changeStatus.toLowerCase()} ${statusLabel(status)}`)
                  setSelectedIds(new Set())
                  e.target.value = ''
                }}
                className="bg-[#0d0e1a] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none"
                defaultValue=""
              >
                <option value="" disabled>{t.common.changeStatus}...</option>
                <option value="prospect">{t.companies.statusLabels.prospect}</option>
                <option value="customer">{t.companies.statusLabels.customer}</option>
                <option value="partner">{t.companies.statusLabels.partner}</option>
                <option value="churned">{t.companies.statusLabels.churned}</option>
              </select>

              <PermissionGate permission="companies:delete">
                <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />}
                  onClick={() => setShowBulkDelete(true)}>
                  {t.common.delete}
                </Button>
              </PermissionGate>
            </>
          )}
          <PermissionGate permission="companies:create">
            <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setIsFormOpen(true)}>
              {t.companies.newCompany}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Smart Views bar */}
      <SmartViewBar entityType="company" onFiltersChange={setViewFilters} />

      {/* Filters */}
      {showFilters && (
        <div className="flex gap-3 flex-wrap items-center bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <Select
            options={Object.entries(COMPANY_INDUSTRY_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            placeholder={t.companies.industry}
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
          />
          <Select
            options={[
              { value: 'prospect', label: t.companies.statusLabels.prospect },
              { value: 'customer', label: t.companies.statusLabels.customer },
              { value: 'partner', label: t.companies.statusLabels.partner },
              { value: 'churned', label: t.companies.statusLabels.churned },
            ]}
            placeholder={t.common.status}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <Select
            options={COMPANY_SIZE_OPTIONS.map((s) => ({ value: s, label: s }))}
            placeholder={t.companies.size}
            value={sizeFilter}
            onChange={(e) => setSizeFilter(e.target.value)}
          />
          {hasFilters && (
            <Button
              variant="ghost" size="sm" leftIcon={<X size={14} />}
              onClick={() => { setIndustryFilter(''); setStatusFilter(''); setSizeFilter('') }}
            >
              {t.common.clear}
            </Button>
          )}
        </div>
      )}

      <p className="text-xs text-zinc-500">{filtered.length} {t.nav.companies.toLowerCase()}</p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 size={28} />}
          title={t.companies.emptyTitle}
          description={t.companies.emptyDescription}
          action={{ label: t.companies.newCompany, onClick: () => setIsFormOpen(true) }}
        />
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="rounded border-white/12 bg-white/6 text-brand-500 focus:ring-brand-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">{t.companies.title}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">{t.companies.industry}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">{t.companies.size}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">{t.companies.country}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">{t.nav.contacts}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">{t.nav.deals}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">{t.common.status}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((company) => {
                const contactCount = contacts.filter((c) => c.companyId === company.id).length
                const dealCount = deals.filter((d) => d.companyId === company.id).length
                return (
                  <tr
                    key={company.id}
                    className="hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/companies/${company.id}`)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(company.id)}
                        onChange={() => toggleSelect(company.id)}
                        className="rounded border-white/12 bg-white/6 text-brand-500 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={company.name} size="sm" />
                        <div>
                          <p className="font-medium text-zinc-200">{company.name}</p>
                          <p className="text-xs text-zinc-500">{company.domain || company.website}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {COMPANY_INDUSTRY_LABELS[company.industry] ?? company.industry}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{company.size || '—'}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{company.country || '—'}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{contactCount}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{dealCount}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_COLORS[company.status]}>
                        {statusLabel(company.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <PermissionGate permission="companies:update">
                          <Button
                            variant="ghost" size="xs"
                            onClick={() => { setEditCompany(company); setIsFormOpen(true) }}
                          >
                            {t.common.edit}
                          </Button>
                        </PermissionGate>
                        <PermissionGate permission="companies:delete">
                          <Button
                            variant="ghost" size="xs"
                            onClick={() => setDeleteId(company.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            {t.common.delete}
                          </Button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditCompany(undefined) }}
        title={editCompany ? t.companies.editCompany : t.companies.newCompany}
      >
        <CompanyForm
          company={editCompany}
          onSubmit={editCompany ? handleEdit : handleCreate}
          onCancel={() => { setIsFormOpen(false); setEditCompany(undefined) }}
        />
      </SlideOver>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) handleDelete(deleteId) }}
        title={`${t.common.delete} ${t.companies.title.toLowerCase()}`}
        message={t.common.bulkDeleteConfirm}
        confirmLabel={t.common.delete}
        danger
      />
      <ConfirmDialog
        isOpen={showBulkDelete}
        onClose={() => setShowBulkDelete(false)}
        onConfirm={handleBulkDelete}
        title={`${t.common.delete} ${selectedIds.size} ${t.nav.companies.toLowerCase()}`}
        message={t.common.bulkDeleteConfirm}
        confirmLabel={t.common.delete}
        danger
      />
    </div>
  )
}
