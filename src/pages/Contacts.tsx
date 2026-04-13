import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslations } from '../i18n'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus, Download, Trash2, LayoutGrid, LayoutList, Edit2,
  Filter, X, Search,
} from 'lucide-react'
import { useContactsStore } from '../store/contactsStore'
import { useCompaniesStore } from '../store/companiesStore'
import { useActivitiesStore } from '../store/activitiesStore'
import { useDealsStore } from '../store/dealsStore'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { SearchBar } from '../components/shared/SearchBar'
import { SmartViewBar } from '../components/shared/SmartViewBar'
import { EmptyState } from '../components/shared/EmptyState'
import { SlideOver, ConfirmDialog } from '../components/ui/Modal'
import { ContactForm } from '../components/contacts/ContactForm'
import { ContactStatusBadge } from '../components/contacts/ContactStatusBadge'
import { Select } from '../components/ui/Select'
import { toast } from '../store/toastStore'
import { formatRelativeDate, formatDateShort } from '../utils/formatters'
import { CONTACT_SOURCE_LABELS } from '../utils/constants'

import { findDuplicates } from '../utils/duplicateDetection'
import type { Contact, ContactStatus, DuplicateGroup, SmartViewFilter } from '../types'
import { Users } from 'lucide-react'
import { PermissionGate } from '../components/auth/PermissionGate'
import { useAuthStore } from '../store/authStore'

const CONTACT_SOURCE_LABELS_IMPORT = CONTACT_SOURCE_LABELS

export function Contacts() {
  const t = useTranslations()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') ?? ''

  const currentUser = useAuthStore((s) => s.currentUser)
  const orgUsers = useAuthStore((s) => s.users)
  const isSalesRep = currentUser?.role === 'sales_rep'

  const { contacts, addContact, updateContact, deleteContact, bulkDelete } = useContactsStore()
  const companies = useCompaniesStore((s) => s.companies)
  const activities = useActivitiesStore((s) => s.activities)
  const deals = useDealsStore((s) => s.deals)

  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [myDataOnly, setMyDataOnly] = useState(isSalesRep)
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'lastContacted'>('score')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [showFilters, setShowFilters] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editContact, setEditContact] = useState<Contact | undefined>()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [viewFilters, setViewFilters] = useState<SmartViewFilter[]>([])

  const getCompanyName = useCallback(
    (id: string) => companies.find((c) => c.id === id)?.name ?? '—',
    [companies]
  )

  const getContactScore = useCallback((contactId: string) => {
    const activityCount = activities.filter((a) => a.contactId === contactId).length
    const openDeals = deals.filter((d) => d.contactId === contactId && d.stage !== 'closed_won' && d.stage !== 'closed_lost').length
    const wonDeals = deals.filter((d) => d.contactId === contactId && d.stage === 'closed_won').length
    return Math.min(100, activityCount * 8 + openDeals * 20 + wonDeals * 30)
  }, [activities, deals])

  const filtered = useMemo(() => {
    const result = contacts.map((c) => ({ contact: c })).filter(({ contact: c }) => {
      const q = search.toLowerCase()
      if (q) {
        const name = `${c.firstName} ${c.lastName}`.toLowerCase()
        if (!name.includes(q) && !c.email.toLowerCase().includes(q)) return false
      }
      if (statusFilter && c.status !== statusFilter) return false
      if (sourceFilter && c.source !== sourceFilter) return false
      if (myDataOnly && currentUser) {
        if (c.assignedTo !== currentUser.name) return false
      } else if (assignedFilter && c.assignedTo !== assignedFilter) return false
      // Apply smart view filters
      for (const vf of viewFilters) {
        const fieldValue = (c as unknown as Record<string, unknown>)[vf.field]
        if (vf.operator === 'eq' && fieldValue !== vf.value) return false
        if (vf.operator === 'neq' && fieldValue === vf.value) return false
        if (vf.operator === 'contains' && typeof fieldValue === 'string' && !fieldValue.toLowerCase().includes(String(vf.value).toLowerCase())) return false
      }
      return true
    })

    result.sort((a, b) => {
      if (sortBy === 'name') return `${a.contact.firstName} ${a.contact.lastName}`.localeCompare(`${b.contact.firstName} ${b.contact.lastName}`)
      if (sortBy === 'lastContacted') return b.contact.lastContactedAt.localeCompare(a.contact.lastContactedAt)
      if (sortBy === 'score') return getContactScore(b.contact.id) - getContactScore(a.contact.id)
      return b.contact.createdAt.localeCompare(a.contact.createdAt)
    })

    return result
  }, [contacts, search, statusFilter, sourceFilter, assignedFilter, myDataOnly, currentUser, sortBy, viewFilters, getContactScore])

  useEffect(() => {
    if (searchParams.get('create') !== '1') return
    setIsFormOpen(true)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('create')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  const duplicates = useMemo(() => findDuplicates(contacts), [contacts])

  const hasFilters = statusFilter || sourceFilter || (!myDataOnly && assignedFilter)

  // For bulk ops and other uses that expect flat Contact[]
  const filteredContacts = useMemo(() => filtered.map(({ contact }) => contact), [filtered])

  const handleCreate = (data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'linkedDeals' | 'lastContactedAt'>) => {
    const now = new Date().toISOString()
    addContact({ ...data, tags: [], linkedDeals: [], lastContactedAt: now })
    setIsFormOpen(false)
    toast.success(t.contacts.created)
  }

  const handleEdit = (data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'linkedDeals' | 'lastContactedAt'>) => {
    if (!editContact) return
    updateContact(editContact.id, data)
    setEditContact(undefined)
    toast.success(t.contacts.updated)
  }

  const handleDelete = (id: string) => {
    deleteContact(id)
    toast.success(t.contacts.deleted)
  }

  const handleBulkDelete = () => {
    bulkDelete(Array.from(selectedIds))
    setSelectedIds(new Set())
    toast.success(`${selectedIds.size} ${t.contacts.bulkDeleted}`)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredContacts.map((c) => c.id)))
    }
  }

  const exportCSV = () => {
    const rows = [
      [t.contacts.firstName, t.contacts.lastName, t.common.email, t.common.phone, t.contacts.jobTitle, t.contacts.company, t.common.status, t.contacts.source, t.common.assignedTo],
      ...filteredContacts.map((c) => [
        c.firstName, c.lastName, c.email, c.phone, c.jobTitle,
        getCompanyName(c.companyId), c.status, c.source, c.assignedTo,
      ]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'contacts.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${t.common.export} CSV`)
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
          {t.common.filters} {hasFilters ? '·' : ''}
        </Button>

        <button
          onClick={() => setMyDataOnly((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            myDataOnly
              ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
              : 'bg-white/4 border-white/10 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users size={12} />
          {myDataOnly ? t.contacts.myContacts : t.common.all}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-slate-400">{selectedIds.size} {t.common.selected}</span>

              {/* Mass Status Update */}
              <select
                onChange={(e) => {
                  if (!e.target.value) return
                  const status = e.target.value as ContactStatus
                  selectedIds.forEach(id => updateContact(id, { status }))
                  toast.success(`${selectedIds.size} ${t.common.selected} → ${t.contacts.statusLabels[status]}`)
                  setSelectedIds(new Set())
                  e.target.value = ''
                }}
                className="bg-[#0d0e1a] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none"
                defaultValue=""
                aria-label={t.common.changeStatus}
                title={t.common.changeStatus}
              >
                <option value="" disabled>{t.common.changeStatus}...</option>
                <option value="prospect">{t.contacts.statusLabels.prospect}</option>
                <option value="customer">{t.contacts.statusLabels.customer}</option>
                <option value="churned">{t.contacts.statusLabels.churned}</option>
              </select>

              {/* Mass Assign */}
              <select
                onChange={(e) => {
                  if (!e.target.value) return
                  selectedIds.forEach(id => updateContact(id, { assignedTo: e.target.value }))
                  toast.success(`${selectedIds.size} ${t.common.assignedTo}`)
                  setSelectedIds(new Set())
                  e.target.value = ''
                }}
                className="bg-[#0d0e1a] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none"
                defaultValue=""
                aria-label={t.common.assignedTo}
                title={t.common.assignedTo}
              >
                <option value="" disabled>{t.common.assignedTo}...</option>
                {orgUsers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>

              {/* Mass Tag */}
              <div className="flex items-center gap-1">
                <input
                  id="bulkTagInput"
                  type="text"
                  placeholder={`${t.common.tags}...`}
                  className="bg-[#0d0e1a] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none w-24"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const tag = (e.target as HTMLInputElement).value.trim()
                      if (!tag) return
                      selectedIds.forEach(id => {
                        const c = contacts.find(c => c.id === id)
                        if (c && !c.tags.includes(tag)) {
                          updateContact(id, { tags: [...c.tags, tag] })
                        }
                      })
                      toast.success(`"${tag}" → ${selectedIds.size} ${t.nav.contacts.toLowerCase()}`)
                      setSelectedIds(new Set())
                      ;(e.target as HTMLInputElement).value = ''
                    }
                  }}
                />
              </div>

              <PermissionGate permission="contacts:delete">
                <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => setShowBulkDelete(true)}>
                  {t.common.delete}
                </Button>
              </PermissionGate>
            </>
          )}
          <PermissionGate permission="contacts:export">
            <Button variant="ghost" size="sm" leftIcon={<Download size={14} />} onClick={exportCSV}>
              CSV
            </Button>
          </PermissionGate>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Search size={14} />}
            onClick={() => {
              if (duplicates.length > 0) {
                setShowDuplicates(true)
              } else {
                toast.info(t.contacts.noDuplicates)
              }
            }}
          >
            {t.contacts.duplicates}
          </Button>
          <div className="flex rounded-lg border border-white/12 overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              aria-label={`${t.common.view} ${t.nav.contacts}`}
              className={`p-1.5 ${viewMode === 'table' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-300'} transition-colors`}
            >
              <LayoutList size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              aria-label={`${t.common.view} grid`}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-300'} transition-colors`}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <PermissionGate permission="contacts:create">
            <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setIsFormOpen(true)}>
              {t.contacts.newContact}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Smart Views bar */}
      <SmartViewBar entityType="contact" onFiltersChange={setViewFilters} />

      {/* Filters */}
      {showFilters && (
        <div className="flex gap-3 flex-wrap items-center glass p-4">
          <Select
            options={[
              { value: 'prospect', label: t.contacts.statusLabels.prospect },
              { value: 'customer', label: t.contacts.statusLabels.customer },
              { value: 'churned', label: t.contacts.statusLabels.churned },
            ]}
            placeholder={t.common.status}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <Select
            options={[
              { value: 'website', label: t.contacts.sourceLabels.website },
              { value: 'referral', label: t.contacts.sourceLabels.referral },
              { value: 'outbound', label: t.contacts.sourceLabels.outbound },
              { value: 'event', label: t.contacts.sourceLabels.event },
              { value: 'linkedin', label: t.contacts.sourceLabels.linkedin },
              { value: 'other', label: t.contacts.sourceLabels.other },
            ]}
            placeholder={t.contacts.source}
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          />
          <Select
            options={orgUsers.map((u) => ({ value: u.name, label: u.name }))}
            placeholder={t.common.assignedTo}
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<X size={14} />}
              onClick={() => { setStatusFilter(''); setSourceFilter(''); setAssignedFilter('') }}
            >
              {t.common.clear}
            </Button>
          )}
        </div>
      )}

      {/* Sort + Count bar */}
      <div className="flex items-center gap-3">
        <p className="text-xs text-slate-500">{filtered.length} {t.nav.contacts.toLowerCase()}</p>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-slate-600">{t.common.filters}:</span>
          {(['score', 'name', 'lastContacted'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                sortBy === opt
                  ? 'bg-brand-600/30 text-brand-300 font-medium'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {opt === 'score' ? t.contacts.score : opt === 'name' ? t.common.name : t.contacts.lastContacted}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <EmptyState
          icon={<Users size={28} />}
          title={t.contacts.emptyTitle}
          description={t.contacts.emptyDescription}
          action={{ label: t.contacts.newContact, onClick: () => setIsFormOpen(true) }}
        />
      )}

      {/* Table view */}
      {viewMode === 'table' && filtered.length > 0 && (
        <div className="glass overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="contacts-table-head border-b border-white/8">
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0}
                    onChange={toggleAll}
                    aria-label={t.common.selectAll}
                    title={t.common.selectAll}
                    className="rounded border-white/12 bg-white/6 text-brand-500 focus:ring-brand-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t.nav.contacts}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t.contacts.company}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t.common.status}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t.contacts.score}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t.contacts.source}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t.contacts.lastContacted}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {filtered.map(({ contact }) => (
                <tr
                  key={contact.id}
                  className="hover:bg-white/4 cursor-pointer transition-colors"
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(contact.id)}
                      onChange={() => toggleSelect(contact.id)}
                      aria-label={t.common.selectAll}
                      title={t.common.selectAll}
                      className="rounded border-white/12 bg-white/6 text-brand-500 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${contact.firstName} ${contact.lastName}`} size="sm" />
                      <div>
                        <p className="font-medium text-slate-200">{contact.firstName} {contact.lastName}</p>
                        <p className="text-xs text-slate-500">{contact.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{getCompanyName(contact.companyId)}</td>
                  <td className="px-4 py-3"><ContactStatusBadge status={contact.status} /></td>
                  <td className="px-4 py-3 text-slate-300 text-xs font-medium">
                    {getContactScore(contact.id)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {CONTACT_SOURCE_LABELS_IMPORT[contact.source]}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatRelativeDate(contact.lastContactedAt)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <PermissionGate permission="contacts:update">
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => { setEditContact(contact); setIsFormOpen(true) }}
                          leftIcon={<Edit2 size={12} />}
                        >
                          {t.common.edit}
                        </Button>
                      </PermissionGate>
                      <PermissionGate permission="contacts:delete">
                        <Button
                          variant="danger"
                          size="xs"
                          onClick={() => setDeleteId(contact.id)}
                          leftIcon={<Trash2 size={12} />}
                        >
                          {t.common.delete}
                        </Button>
                      </PermissionGate>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(({ contact }) => (
            <div
              key={contact.id}
              className="glass p-4 hover:border-white/12 cursor-pointer transition-all relative"
              onClick={() => navigate(`/contacts/${contact.id}`)}
            >
              <div className="flex items-start gap-3 mb-3">
                <Avatar name={`${contact.firstName} ${contact.lastName}`} size="md" />
                <div className="flex-1 min-w-0 pr-10">
                  <p className="font-semibold text-slate-200 text-sm truncate">
                    {contact.firstName} {contact.lastName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{contact.jobTitle || contact.email}</p>
                </div>
              </div>
              <div className="space-y-1">
                <ContactStatusBadge status={contact.status} />
                <p className="text-xs text-slate-500">{getCompanyName(contact.companyId)}</p>
                <p className="text-xs text-slate-600">{formatRelativeDate(contact.lastContactedAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-over form */}
      <SlideOver
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditContact(undefined) }}
        title={editContact ? t.contacts.editContact : t.contacts.newContact}
      >
        <ContactForm
          contact={editContact}
          onSubmit={editContact ? handleEdit : handleCreate}
          onCancel={() => { setIsFormOpen(false); setEditContact(undefined) }}
        />
      </SlideOver>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) handleDelete(deleteId) }}
        title={t.contacts.deleteConfirm}
        message={t.common.bulkDeleteConfirm}
        confirmLabel={t.common.delete}
        danger
      />
      <ConfirmDialog
        isOpen={showBulkDelete}
        onClose={() => setShowBulkDelete(false)}
        onConfirm={handleBulkDelete}
        title={`${t.common.delete} ${selectedIds.size} ${t.nav.contacts.toLowerCase()}`}
        message={t.common.bulkDeleteConfirm}
        confirmLabel={t.common.bulkDelete}
        danger
      />

      {/* Duplicate Detection Modal */}
      {showDuplicates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDuplicates(false)} />

          {/* Modal */}
          <div className="relative w-full max-w-3xl max-h-[80vh] overflow-y-auto glass border border-white/8 rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/8 bg-[#0d0e1a] rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-slate-200">{t.contacts.duplicatesFound}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {duplicates.length} {t.contacts.duplicates.toLowerCase()}
                </p>
              </div>
              <button
                onClick={() => setShowDuplicates(false)}
                title={t.common.close}
                aria-label={t.common.close}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/6 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Groups */}
            <div className="p-6 space-y-4">
              {duplicates.map((group, groupIndex) => {
                const matchLabel = group.matchType === 'email' ? t.common.email : group.matchType === 'name' ? t.common.name : t.common.phone
                const matchColor =
                  group.matchType === 'email'
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/20'
                    : group.matchType === 'name'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                      : 'bg-purple-500/15 text-purple-400 border-purple-500/20'

                return (
                  <div key={groupIndex} className="glass border border-white/8 rounded-xl p-4 space-y-3">
                    {/* Match badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${matchColor}`}>
                          {matchLabel}
                        </span>
                        <span className="text-xs text-slate-500">
                          {group.confidence}% match
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => toast.info(`${t.contacts.merge}...`)}
                      >
                        {t.contacts.merge}
                      </Button>
                    </div>

                    {/* Contact cards side by side */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {group.contacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="bg-white/4 border border-white/6 rounded-lg p-3 space-y-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar name={`${contact.firstName} ${contact.lastName}`} size="sm" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-200 truncate">
                                {contact.firstName} {contact.lastName}
                              </p>
                              <p className="text-xs text-slate-500 truncate">{contact.jobTitle}</p>
                            </div>
                          </div>
                          <div className="space-y-0.5 pl-8">
                            <p className="text-xs text-slate-400 truncate">{contact.email}</p>
                            <p className="text-xs text-slate-500 truncate">{contact.phone}</p>
                            <ContactStatusBadge status={contact.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
