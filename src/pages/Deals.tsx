import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslations, useI18nStore } from '../i18n'
import { DragDropContext } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import {
  Plus, KanbanSquare, LayoutList, Filter, X,
  Trophy, XCircle, Edit2, Trash2, Loader2, Mail,
} from 'lucide-react'
import { useDealsStore } from '../store/dealsStore'
import { useContactsStore } from '../store/contactsStore'
import { useCompaniesStore } from '../store/companiesStore'
import { useActivitiesStore } from '../store/activitiesStore'
import { KanbanColumn } from '../components/deals/KanbanColumn'
import { DealForm } from '../components/deals/DealForm'
import { ActivityForm } from '../components/activities/ActivityForm'
import { ActivityItem } from '../components/activities/ActivityItem'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { SearchBar } from '../components/shared/SearchBar'
import { SmartViewBar } from '../components/shared/SmartViewBar'
import { SlideOver, ConfirmDialog } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { EmptyState } from '../components/shared/EmptyState'
import { toast } from '../store/toastStore'
import { formatCurrency, formatDate, formatDateShort, formatRelativeDate } from '../utils/formatters'
import { computeDealHealth, healthStatusColor } from '../utils/dealHealth'
import { DEAL_PRIORITY_COLORS } from '../utils/constants'

import type { Deal, DealStage, QuoteItem, SmartViewFilter } from '../types'
import { PermissionGate } from '../components/auth/PermissionGate'
import { EmailComposer } from '../components/email/EmailComposer'
import { useAuthStore } from '../store/authStore'
import { useProductsStore } from '../store/productsStore'
import { useSettingsStore } from '../store/settingsStore'
import { CustomFieldsForm } from '../components/shared/CustomFieldRenderer'

const STAGE_BADGE_MAP: Record<string, 'blue' | 'yellow' | 'purple' | 'orange' | 'emerald' | 'rose' | 'gray'> = {
  lead: 'blue',
  qualified: 'yellow',
  proposal: 'purple',
  negotiation: 'orange',
  closed_won: 'emerald',
  closed_lost: 'rose',
}

function getDealAgeDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
}

function getAgingColor(days: number): { bg: string; text: string } {
  if (days < 7) return { bg: 'bg-emerald-500/15', text: 'text-emerald-400' }
  if (days <= 30) return { bg: 'bg-amber-500/15', text: 'text-amber-400' }
  return { bg: 'bg-red-500/15', text: 'text-red-400' }
}

function getStageDurationDays(updatedAt: string): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000)
}

// ─── QuoteBuilder ─────────────────────────────────────────────────────────────

function newItem(): QuoteItem {
  return { id: crypto.randomUUID(), name: '', quantity: 1, unitPrice: 0, discount: 0, total: 0 }
}

function calcTotal(q: number, u: number, d: number) {
  return Math.round(q * u * (1 - d / 100) * 100) / 100
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '')
}

function buildSimplePdfBase64(lines: string[]): string {
  const contentLines = ['BT', '/F1 10 Tf', '40 800 Td']
  lines.slice(0, 45).forEach((line, idx) => {
    if (idx > 0) contentLines.push('0 -14 Td')
    contentLines.push(`(${escapePdfText(line)}) Tj`)
  })
  contentLines.push('ET')
  const contentStream = `${contentLines.join('\n')}\n`
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (const obj of objects) {
    offsets.push(pdf.length)
    pdf += obj
  }
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return bytesToBase64(new TextEncoder().encode(pdf))
}

function QuoteBuilder({
  dealId,
  dealTitle,
  initialItems,
  contactEmail,
  companyName,
  currency,
  onComposeQuoteDraft,
}: {
  dealId: string
  dealTitle: string
  initialItems: QuoteItem[]
  contactEmail?: string
  companyName?: string
  currency: Deal['currency']
  onComposeQuoteDraft: (draft: {
    to: string
    subject: string
    body: string
    attachments: Array<{ name: string; mimeType: string; size: number; dataBase64: string }>
  }) => void
}) {
  const t = useTranslations()
  const branding = useSettingsStore((s) => s.settings.branding)
  const language = useI18nStore((s) => s.language)
  const [allProducts, setAllProducts] = useState(() => useProductsStore.getState().products)
  useEffect(() => useProductsStore.subscribe((s) => setAllProducts(s.products)), [])
  const products = useMemo(() => allProducts.filter((p) => p.isActive), [allProducts])
  const [items, setItems] = useState<QuoteItem[]>(initialItems)
  const [saved, setSaved] = useState(false)
  const [vatPercent, setVatPercent] = useState(21)
  const [validityDays, setValidityDays] = useState(15)
  const [quoteNumber, setQuoteNumber] = useState(`Q-${dealId.toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`)

  const updateItem = (id: string, patch: Partial<QuoteItem>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const merged = { ...it, ...patch }
        return { ...merged, total: calcTotal(merged.quantity, merged.unitPrice, merged.discount) }
      })
    )
    setSaved(false)
  }

  const removeItem = (id: string) => { setItems((prev) => prev.filter((i) => i.id !== id)); setSaved(false) }

  const addFromProduct = (productId: string) => {
    const p = products.find((pr) => pr.id === productId)
    if (!p) return
    setItems((prev) => [...prev, { id: crypto.randomUUID(), productId: p.id, name: p.name, description: p.description, quantity: 1, unitPrice: p.price, discount: 0, total: p.price }])
    setSaved(false)
  }

  const addBlank = () => { setItems((prev) => [...prev, newItem()]); setSaved(false) }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const totalDiscount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.discount / 100), 0)
  const total = items.reduce((s, i) => s + i.total, 0)
  const vatAmount = Math.round(total * (vatPercent / 100) * 100) / 100
  const grandTotal = total + vatAmount

  const localeByLanguage: Record<typeof language, string> = {
    en: 'en-US',
    es: 'es-ES',
    pt: 'pt-PT',
    fr: 'fr-FR',
    de: 'de-DE',
    it: 'it-IT',
  }
  const fmt = (n: number) => new Intl.NumberFormat(localeByLanguage[language], { style: 'currency', currency }).format(n)
  const formatDateForQuote = (value: Date) => formatDateShort(value.toISOString())

  const handleSave = () => {
    useDealsStore.getState().updateQuote(dealId, items)
    setSaved(true)
    toast.success(t.deals.quoteBuilder)
  }

  const exportPdf = () => {
    if (items.length === 0) {
      toast.error(t.deals.addItem)
      return
    }
    const lines = items.map((item) => {
      const rowTotal = fmt(item.total)
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #ddd">${item.name || '-'}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${fmt(item.unitPrice)}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${item.discount}%</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${rowTotal}</td>
        </tr>
      `
    }).join('')

    const html = `
      <html>
        <head>
          <title>${quoteNumber} - ${dealTitle}</title>
        </head>
        <body style="font-family:Arial,sans-serif;padding:24px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
            <div>
              ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="logo" style="max-height:44px;max-width:200px;display:block;margin-bottom:10px" />` : ''}
              <h2 style="margin:0 0 6px">${t.deals.quoteBuilder}</h2>
              <p style="margin:0;color:#555;font-weight:600">${branding.appName || companyName || t.deals.company}</p>
              <p style="margin:2px 0 0;color:#666;font-size:12px">${companyName || ''}</p>
            </div>
            <div style="text-align:right;color:#444;font-size:12px">
              <div><strong>${quoteNumber}</strong></div>
              <div>${t.common.date}: ${formatDateForQuote(new Date())}</div>
              <div>${t.deals.expectedClose}: ${formatDateForQuote(new Date(Date.now() + validityDays * 86400000))}</div>
            </div>
          </div>
          <p style="margin:0 0 18px;color:#555">${dealTitle}</p>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr>
                <th style="padding:8px;text-align:left;border-bottom:2px solid #111">${t.common.description}</th>
                <th style="padding:8px;text-align:right;border-bottom:2px solid #111">${t.common.total}</th>
                <th style="padding:8px;text-align:right;border-bottom:2px solid #111">${t.common.value}</th>
                <th style="padding:8px;text-align:right;border-bottom:2px solid #111">${t.deals.discount}</th>
                <th style="padding:8px;text-align:right;border-bottom:2px solid #111">${t.common.total}</th>
              </tr>
            </thead>
            <tbody>${lines}</tbody>
          </table>
          <div style="margin-top:16px;text-align:right">
            <div>${t.deals.subtotal}: ${fmt(subtotal)}</div>
            <div>${t.deals.discount}: -${fmt(totalDiscount)}</div>
            <div>${t.deals.vatPercent} (${vatPercent}%): ${fmt(vatAmount)}</div>
            <div style="font-weight:700;margin-top:4px">${t.common.total}: ${fmt(grandTotal)}</div>
          </div>
        </body>
      </html>
    `

    try {
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)
      const doc = iframe.contentWindow?.document
      if (!doc || !iframe.contentWindow) throw new Error('print_unavailable')
      doc.open()
      doc.write(html)
      doc.close()
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      window.setTimeout(() => iframe.remove(), 600)
    } catch {
      toast.error(t.errors.generic)
    }
  }

  const sendQuoteByEmail = () => {
    if (items.length === 0) {
      toast.error(t.deals.addItem)
      return
    }
    const body = [
      `Hi,`,
      '',
      `Please find below the quote summary for "${dealTitle}":`,
      '',
      `Quote number: ${quoteNumber}`,
      `${t.deals.expectedClose}: ${formatDateForQuote(new Date(Date.now() + validityDays * 86400000))}`,
      '',
      ...items.map((item) => `- ${item.name || t.common.description}: ${item.quantity} x ${fmt(item.unitPrice)} (${item.discount}%) = ${fmt(item.total)}`),
      '',
      `${t.deals.subtotal}: ${fmt(subtotal)}`,
      `${t.deals.discount}: -${fmt(totalDiscount)}`,
      `${t.deals.vatPercent} (${vatPercent}%): ${fmt(vatAmount)}`,
      `${t.common.total}: ${fmt(grandTotal)}`,
      '',
      'Best regards,',
    ].join('\n')
    const pdfLines = [
      `${t.deals.quoteBuilder} - ${dealTitle}`,
      `${t.deals.quoteNumber}: ${quoteNumber}`,
      `${t.common.date}: ${formatDateForQuote(new Date())}`,
      `${t.deals.expectedClose}: ${formatDateForQuote(new Date(Date.now() + validityDays * 86400000))}`,
      `Company: ${companyName ?? '-'}`,
      '',
      ...items.map((item) => `${item.name || '-'} | ${item.quantity} x ${fmt(item.unitPrice)} | ${item.discount}% | ${fmt(item.total)}`),
      '',
      `${t.deals.subtotal}: ${fmt(subtotal)}`,
      `${t.deals.discount}: -${fmt(totalDiscount)}`,
      `${t.deals.vatPercent} (${vatPercent}%): ${fmt(vatAmount)}`,
      `${t.common.total}: ${fmt(grandTotal)}`,
    ]
    const pdfBase64 = buildSimplePdfBase64(pdfLines)
    onComposeQuoteDraft({
      to: contactEmail ?? '',
      subject: `Quote - ${dealTitle}`,
      body,
      attachments: [{
        name: `${quoteNumber}.pdf`,
        mimeType: 'application/pdf',
        size: Math.ceil((pdfBase64.length * 3) / 4),
        dataBase64: pdfBase64,
      }],
    })
  }

  return (
    <div className="space-y-3">
      {/* Add controls */}
      <div className="flex items-center gap-2">
        <select
          defaultValue=""
          onChange={(e) => { if (e.target.value) { addFromProduct(e.target.value); e.target.value = '' } }}
          aria-label={`${t.common.add} ${t.products.title.toLowerCase()} ${t.deals.quote.toLowerCase()}`}
          title={`${t.common.add} ${t.products.title.toLowerCase()} ${t.deals.quote.toLowerCase()}`}
          className="flex-1 bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500/50"
        >
          <option value="" disabled>+ {t.deals.addItem}...</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>
          ))}
        </select>
        <button
          onClick={addBlank}
          className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-400 hover:text-white hover:bg-white/4 transition-colors whitespace-nowrap"
        >
          + {t.deals.addItem}
        </button>
      </div>

      {/* Line items */}
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-white/6">
                <th className="text-left pb-2 font-medium">{t.common.description}</th>
                <th className="text-right pb-2 font-medium w-14">{t.common.total}</th>
                <th className="text-right pb-2 font-medium w-24">{t.common.value}</th>
                <th className="text-right pb-2 font-medium w-16">{t.deals.discount}%</th>
                <th className="text-right pb-2 font-medium w-24">{t.common.total}</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, { name: e.target.value })}
                      placeholder={t.common.name}
                      aria-label={t.common.name}
                      title={t.common.name}
                      className="w-full bg-transparent border-b border-white/10 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/50 py-0.5"
                    />
                  </td>
                  <td className="py-1.5 px-1">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value)) })}
                      aria-label={t.common.total}
                      title={t.common.total}
                      className="w-12 text-right bg-transparent border-b border-white/10 text-slate-200 focus:outline-none focus:border-brand-500/50 py-0.5"
                    />
                  </td>
                  <td className="py-1.5 px-1">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                      aria-label={t.products.price}
                      title={t.products.price}
                      className="w-20 text-right bg-transparent border-b border-white/10 text-slate-200 focus:outline-none focus:border-brand-500/50 py-0.5"
                    />
                  </td>
                  <td className="py-1.5 px-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={item.discount}
                      onChange={(e) => updateItem(item.id, { discount: Math.min(100, Math.max(0, Number(e.target.value))) })}
                      aria-label={t.deals.discount}
                      title={t.deals.discount}
                      className="w-14 text-right bg-transparent border-b border-white/10 text-slate-200 focus:outline-none focus:border-brand-500/50 py-0.5"
                    />
                  </td>
                  <td className="py-1.5 pl-1 text-right text-slate-200 font-medium">{fmt(item.total)}</td>
                  <td className="py-1.5 pl-1">
                    <button onClick={() => removeItem(item.id)} className="text-slate-600 hover:text-red-400 transition-colors">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {items.length > 0 && (
        <div className="border-t border-white/6 pt-3 space-y-1 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>{t.deals.subtotal}</span><span>{fmt(subtotal)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between text-amber-400">
              <span>{t.deals.discount}</span><span>-{fmt(totalDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between text-white font-bold text-sm pt-1 border-t border-white/6">
            <span>{t.common.total}</span><span>{fmt(total)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>{t.deals.vatPercent} ({vatPercent}%)</span><span>{fmt(vatAmount)}</span>
          </div>
          <div className="flex justify-between text-emerald-400 font-semibold text-sm">
            <span>{t.common.total}</span><span>{fmt(grandTotal)}</span>
          </div>
        </div>
      )}

      {/* Commercial metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="text"
          value={quoteNumber}
          onChange={(e) => setQuoteNumber(e.target.value)}
          className="bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
          aria-label={t.deals.quoteNumber}
          title={t.deals.quoteNumber}
          placeholder={t.deals.quoteNumber}
        />
        <input
          type="number"
          min={0}
          max={100}
          value={vatPercent}
          onChange={(e) => setVatPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
          className="bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
          aria-label={t.deals.vatPercent}
          title={t.deals.vatPercent}
          placeholder={t.deals.vatPercent}
        />
        <input
          type="number"
          min={1}
          value={validityDays}
          onChange={(e) => setValidityDays(Math.max(1, Number(e.target.value)))}
          className="bg-[#0d0e1a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
          aria-label={t.deals.validityDays}
          title={t.deals.validityDays}
          placeholder={t.deals.validityDays}
        />
      </div>

      {/* Save / Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={exportPdf}
          className="px-4 py-1.5 rounded-lg border border-white/10 hover:bg-white/4 text-xs text-slate-300 font-medium transition-colors"
        >
          {t.common.export} PDF
        </button>
        <button
          type="button"
          onClick={sendQuoteByEmail}
          className="px-4 py-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 text-xs text-brand-300 font-medium transition-colors"
        >
          {t.inbox.compose}
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-xs text-white font-medium transition-colors"
        >
          {saved ? `${t.deals.quoteBuilder} ✓` : t.deals.quoteBuilder}
        </button>
      </div>
    </div>
  )
}

export function Deals() {
  const t = useTranslations()
  const [searchParams, setSearchParams] = useSearchParams()
  const { deals, addDeal, updateDeal, deleteDeal, moveDeal } = useDealsStore()
  const contacts = useContactsStore((s) => s.contacts)
  const companies = useCompaniesStore((s) => s.companies)
  const { activities, addActivity, completeActivity, deleteActivity } = useActivitiesStore()
  const pipelineStages = useSettingsStore((s) => s.settings.pipelineStages)

  const currentUser = useAuthStore((s) => s.currentUser)
  const orgUsers = useAuthStore((s) => s.users)
  const isSalesRep = currentUser?.role === 'sales_rep'

  const [search, setSearch] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [myDataOnly, setMyDataOnly] = useState(isSalesRep)
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isActivityOpen, setIsActivityOpen] = useState(false)
  const [isEmailOpen, setIsEmailOpen] = useState(false)
  const [emailDraft, setEmailDraft] = useState<{
    to: string
    subject: string
    body: string
    attachments: Array<{ name: string; mimeType: string; size: number; dataBase64: string }>
  } | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set())
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [viewFilters, setViewFilters] = useState<SmartViewFilter[]>([])

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setIsFormOpen(true)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('create')
        return next
      }, { replace: true })
      return
    }

    const dealId = searchParams.get('deal')
    if (!dealId) return
    const targetDeal = deals.find((d) => d.id === dealId)
    if (!targetDeal) return
    setSelectedDeal(targetDeal)
    setIsDetailOpen(true)
    setIsEditing(false)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('deal')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams, deals])


  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false
      if (myDataOnly && currentUser) {
        if (d.assignedTo !== currentUser.name) return false
      } else if (assignedFilter && d.assignedTo !== assignedFilter) return false
      if (priorityFilter && d.priority !== priorityFilter) return false
      // Apply smart view filters
      for (const vf of viewFilters) {
        const fieldValue = (d as unknown as Record<string, unknown>)[vf.field]
        if (vf.operator === 'eq' && fieldValue !== vf.value) return false
        if (vf.operator === 'neq' && fieldValue === vf.value) return false
        if (vf.operator === 'gte' && typeof fieldValue === 'number' && fieldValue < Number(vf.value)) return false
        if (vf.operator === 'lte' && typeof fieldValue === 'number' && fieldValue > Number(vf.value)) return false
        if (vf.operator === 'gt' && typeof fieldValue === 'number' && fieldValue <= Number(vf.value)) return false
        if (vf.operator === 'lt' && typeof fieldValue === 'number' && fieldValue >= Number(vf.value)) return false
        if (vf.operator === 'contains' && typeof fieldValue === 'string' && !fieldValue.toLowerCase().includes(String(vf.value).toLowerCase())) return false
      }
      return true
    })
  }, [deals, search, assignedFilter, priorityFilter, myDataOnly, currentUser, viewFilters])

  const getContact = useCallback((id: string) => contacts.find((c) => c.id === id), [contacts])
  const getCompany = useCallback((id: string) => companies.find((c) => c.id === id), [companies])
  const stageLabelById = useMemo(
    () => Object.fromEntries(pipelineStages.map((stage) => [stage.id, stage.name])) as Record<DealStage, string>,
    [pipelineStages]
  )
  const sortedPipelineStages = useMemo(
    () => pipelineStages.slice().sort((a, b) => a.order - b.order),
    [pipelineStages]
  )
  const getStageLabel = useCallback(
    (stage: DealStage) => stageLabelById[stage] || stage,
    [stageLabelById]
  )

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const { draggableId, destination } = result
    const newStage = destination.droppableId as DealStage
    const deal = deals.find((d) => d.id === draggableId)
    if (deal && deal.stage !== newStage) {
      moveDeal(draggableId, newStage)
      toast.success(`${t.deals.title} → ${getStageLabel(newStage)}`)
    }
  }

  const handleCreate = (data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'activities'>) => {
    addDeal({ ...data, activities: [] })
    setIsFormOpen(false)
    toast.success(t.deals.created)
  }

  const handleEdit = (data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'activities'>) => {
    if (!selectedDeal) return
    updateDeal(selectedDeal.id, data)
    setIsEditing(false)
    setSelectedDeal({ ...selectedDeal, ...data })
    toast.success(t.deals.updated)
  }

  const handleDelete = (id: string) => {
    deleteDeal(id)
    setIsDetailOpen(false)
    setSelectedDeal(null)
    toast.success(t.deals.deleted)
  }

  const handleMarkWon = () => {
    if (!selectedDeal) return
    updateDeal(selectedDeal.id, { stage: 'closed_won', probability: 100 })
    setIsDetailOpen(false)
    toast.success(`${t.deals.stageLabels.closed_won}! 🎉`)
  }

  const handleMarkLost = () => {
    if (!selectedDeal) return
    updateDeal(selectedDeal.id, { stage: 'closed_lost', probability: 0 })
    setIsDetailOpen(false)
    toast.success(t.deals.stageLabels.closed_lost)
  }

  const handleDealClick = (deal: Deal) => {
    setSelectedDeal(deal)
    setIsDetailOpen(true)
    setIsEditing(false)
  }

  const toggleDealSelect = (id: string) => {
    setSelectedDealIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllDeals = () => {
    if (selectedDealIds.size === filtered.length) {
      setSelectedDealIds(new Set())
    } else {
      setSelectedDealIds(new Set(filtered.map((d) => d.id)))
    }
  }

  const handleBulkAssign = (user: string) => {
    selectedDealIds.forEach((id) => updateDeal(id, { assignedTo: user }))
    toast.success(`${selectedDealIds.size} ${t.deals.title} → ${user}`)
    setSelectedDealIds(new Set())
  }

  const handleBulkStageChange = (stage: DealStage) => {
    selectedDealIds.forEach((id) => moveDeal(id, stage))
    toast.success(`${selectedDealIds.size} ${t.deals.title} → ${getStageLabel(stage)}`)
    setSelectedDealIds(new Set())
  }

  const handleBulkDeleteDeals = () => {
    selectedDealIds.forEach((id) => deleteDeal(id))
    toast.success(`${selectedDealIds.size} ${t.deals.deleted}`)
    setSelectedDealIds(new Set())
    setShowBulkDelete(false)
  }

  const handleAddActivity = (data: Omit<typeof activities[0], 'id' | 'createdAt'>) => {
    if (!selectedDeal) return
    addActivity({ ...data, dealId: selectedDeal.id })
    setIsActivityOpen(false)
    toast.success(t.activities.newActivity)
  }


  const dealActivities = useMemo(() => {
    if (!selectedDeal) return []
    return activities
      .filter((a) => a.dealId === selectedDeal.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [activities, selectedDeal])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap p-4 border-b border-white/6">
        <SearchBar value={search} onChange={setSearch} placeholder={t.common.searchPlaceholder} className="w-64" />
        <Button
          variant={showFilters ? 'secondary' : 'ghost'}
          size="sm"
          leftIcon={<Filter size={14} />}
          onClick={() => setShowFilters((v) => !v)}
        >
          {t.common.filters}
        </Button>
        <button
          onClick={() => setMyDataOnly((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            myDataOnly
              ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
              : 'bg-white/4 border-white/10 text-slate-400 hover:text-slate-200'
          }`}
        >
          <KanbanSquare size={12} />
          {myDataOnly ? t.deals.title : t.common.all}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border border-white/8 overflow-hidden">
            <button
              onClick={() => setViewMode('kanban')}
              aria-label={t.deals.kanban}
              className={`p-1.5 ${viewMode === 'kanban' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-300'} transition-colors`}
            >
              <KanbanSquare size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              aria-label={t.deals.list}
              className={`p-1.5 ${viewMode === 'list' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-300'} transition-colors`}
            >
              <LayoutList size={16} />
            </button>
          </div>
          <PermissionGate permission="deals:create">
            <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setIsFormOpen(true)}>
              {t.deals.newDeal}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Smart Views bar */}
      <div className="px-4 py-2 border-b border-white/6">
        <SmartViewBar entityType="deal" onFiltersChange={setViewFilters} />
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex gap-3 flex-wrap items-center px-4 py-3 border-b border-white/6 bg-navy-800/30">
          <Select
            options={orgUsers.map((u) => ({ value: u.name, label: u.name }))}
            placeholder={t.common.assignedTo}
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
          />
          <Select
            options={[
              { value: 'low', label: t.deals.priorityLabels.low }, { value: 'medium', label: t.deals.priorityLabels.medium }, { value: 'high', label: t.deals.priorityLabels.high },
            ]}
            placeholder={t.common.priority}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          />
          {(assignedFilter || priorityFilter) && (
            <Button variant="ghost" size="sm" leftIcon={<X size={14} />}
              onClick={() => { setAssignedFilter(''); setPriorityFilter('') }}>
              {t.common.clear}
            </Button>
          )}
        </div>
      )}

      {/* Kanban */}
      {viewMode === 'kanban' && (
        <div className="flex-1 overflow-x-auto p-4">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 h-full min-h-[500px]" style={{ minWidth: `${sortedPipelineStages.length * 296}px` }}>
              {sortedPipelineStages.map((pipelineStage) => (
                <KanbanColumn
                  key={pipelineStage.id}
                  stage={pipelineStage.id}
                  deals={filtered.filter((d) => d.stage === pipelineStage.id)}
                  onDealClick={handleDealClick}
                  color={pipelineStage.color}
                />
              ))}
            </div>
          </DragDropContext>
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Bulk actions bar */}
          {selectedDealIds.size > 0 && (
            <div className="glass border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-slate-300">
                {selectedDealIds.size} {t.deals.title} {t.common.selected}
              </span>
              <div className="h-4 w-px bg-white/12" />
              <Select
                options={orgUsers.map((u) => ({ value: u.name, label: u.name }))}
                placeholder={t.common.assignedTo}
                value=""
                onChange={(e) => {
                  if (e.target.value) handleBulkAssign(e.target.value)
                }}
              />
              <Select
                options={sortedPipelineStages.map((s) => ({ value: s.id, label: s.name }))}
                placeholder={t.deals.stage}
                value=""
                onChange={(e) => {
                  if (e.target.value) handleBulkStageChange(e.target.value as DealStage)
                }}
              />
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 size={14} />}
                onClick={() => setShowBulkDelete(true)}
              >
                {t.common.delete}
              </Button>
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState
              icon={<KanbanSquare size={28} />}
              title={t.deals.emptyTitle}
              description={t.deals.emptyDescription}
              action={{ label: t.deals.newDeal, onClick: () => setIsFormOpen(true) }}
            />
          ) : (
            <div className="bg-[#111220] border border-white/8 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/6 bg-navy-800/30">
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={selectedDealIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleAllDeals}
                        aria-label={t.common.selectAll}
                        title={t.common.selectAll}
                        className="rounded border-white/12 bg-white/6 text-brand-500 focus:ring-brand-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t.deals.title}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t.deals.company}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t.common.value}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t.deals.stage}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t.common.priority}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t.deals.expectedClose}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t.common.assignedTo}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {filtered.map((deal) => {
                    const contact = getContact(deal.contactId)
                    const company = getCompany(deal.companyId)
                    const ageDays = getDealAgeDays(deal.createdAt)
                    const aging = getAgingColor(ageDays)
                    const health = computeDealHealth(deal, activities)
                    const showHealthDot = (health.status === 'at_risk' || health.status === 'needs_attention')
                      && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost'
                    return (
                      <tr
                        key={deal.id}
                        className="hover:bg-white/4 cursor-pointer transition-colors"
                        onClick={() => handleDealClick(deal)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedDealIds.has(deal.id)}
                            onChange={() => toggleDealSelect(deal.id)}
                            aria-label={`${t.common.select} ${deal.title}`}
                            title={`${t.common.select} ${deal.title}`}
                            className="rounded border-white/12 bg-white/6 text-brand-500 focus:ring-brand-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: DEAL_PRIORITY_COLORS[deal.priority] }} />
                            <span className="font-medium text-white">{deal.title}</span>
                            {showHealthDot && (
                              <span
                                className={`w-2 h-2 rounded-full flex-shrink-0 ${health.status === 'at_risk' ? 'bg-red-400 animate-pulse' : 'bg-amber-400'} ${healthStatusColor(health.status)}`}
                                title={health.reasons.join(' · ')}
                              />
                            )}
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${aging.bg} ${aging.text}`}>
                              {ageDays}{t.dashboard.days}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{company?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-emerald-400 font-semibold text-sm">
                          {formatCurrency(deal.value, deal.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STAGE_BADGE_MAP[deal.stage] ?? 'gray'}>{getStageLabel(deal.stage)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{t.deals.priorityLabels[deal.priority]}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDate(deal.expectedCloseDate)}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{deal.assignedTo}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <PermissionGate permission="deals:delete">
                            <Button variant="ghost" size="xs" onClick={() => setDeleteId(deal.id)}
                              className="text-red-400 hover:text-red-300">
                              <Trash2 size={13} />
                            </Button>
                          </PermissionGate>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create deal */}
      <SlideOver isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={t.deals.newDeal}>
        <DealForm onSubmit={handleCreate} onCancel={() => setIsFormOpen(false)} />
      </SlideOver>

      {/* Deal detail */}
      <SlideOver isOpen={isDetailOpen && !isEditing} onClose={() => { setIsDetailOpen(false); setSelectedDeal(null) }} title={t.deals.editDeal} width="xl">
        {selectedDeal && (
          <div className="p-6 space-y-6">
            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              {selectedDeal.stage !== 'closed_won' && selectedDeal.stage !== 'closed_lost' && (
                <PermissionGate permission="deals:move">
                  <>
                    <Button size="sm" variant="secondary" leftIcon={<Trophy size={14} />} onClick={handleMarkWon}
                      className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
                      {t.deals.won}
                    </Button>
                    <Button size="sm" variant="secondary" leftIcon={<XCircle size={14} />} onClick={handleMarkLost}
                      className="text-red-400 border-red-500/30 hover:bg-red-500/10">
                      {t.deals.lost}
                    </Button>
                  </>
                </PermissionGate>
              )}
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Mail size={14} />}
                onClick={() => {
                  setEmailDraft(null)
                  setIsEmailOpen(true)
                }}
              >
                {t.inbox.compose}
              </Button>
              <PermissionGate permission="deals:update">
                <Button size="sm" variant="secondary" leftIcon={<Edit2 size={14} />} onClick={() => setIsEditing(true)}>
                  {t.common.edit}
                </Button>
              </PermissionGate>
              <PermissionGate permission="deals:delete">
                <Button size="sm" variant="ghost" leftIcon={<Trash2 size={14} />}
                  className="text-red-400 hover:text-red-300 ml-auto"
                  onClick={() => setDeleteId(selectedDeal.id)}>
                  {t.common.delete}
                </Button>
              </PermissionGate>
            </div>

            {/* Info */}
            <div className="bg-white/4 rounded-xl p-4 space-y-1">
              <h2 className="text-lg font-bold text-white mb-3">{selectedDeal.title}</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {[
                  { label: t.common.value, value: formatCurrency(selectedDeal.value, selectedDeal.currency) },
                  { label: t.deals.stage, value: getStageLabel(selectedDeal.stage) },
                  { label: t.deals.probability, value: `${selectedDeal.probability}%` },
                  { label: t.common.priority, value: t.deals.priorityLabels[selectedDeal.priority] },
                  { label: t.deals.expectedClose, value: formatDate(selectedDeal.expectedCloseDate) },
                  { label: t.common.assignedTo, value: selectedDeal.assignedTo },
                  { label: t.deals.company, value: getCompany(selectedDeal.companyId)?.name || '—' },
                  { label: t.deals.contact, value: (() => { const c = getContact(selectedDeal.contactId); return c ? `${c.firstName} ${c.lastName}` : '—' })() },
                  { label: t.deals.daysInStage, value: `${getStageDurationDays(selectedDeal.updatedAt)} ${t.deals.aging} ${getStageLabel(selectedDeal.stage)}` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="text-sm text-slate-200 font-medium">{value}</p>
                  </div>
                ))}
              </div>
              {selectedDeal.notes && (
                <div className="pt-3 border-t border-white/6 mt-3">
                  <p className="text-xs text-slate-500 mb-1">{t.common.notes}</p>
                  <p className="text-sm text-slate-300">{selectedDeal.notes}</p>
                </div>
              )}
            </div>

            {/* Custom Fields */}
            <div className="bg-white/4 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">{t.common.details}</h3>
              <CustomFieldsForm entityId={selectedDeal.id} entityType="deal" />
            </div>

            {/* Activities */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">{t.nav.activities}</h3>
                <Button size="sm" variant="secondary" leftIcon={<Plus size={14} />}
                  onClick={() => setIsActivityOpen(true)}>
                  {t.common.add}
                </Button>
              </div>
              {dealActivities.length === 0 ? (
                <p className="text-xs text-slate-600 py-4 text-center">{t.activities.emptyTitle}</p>
              ) : (
                <div className="space-y-1">
                  {dealActivities.map((a) => (
                    <ActivityItem key={a.id} activity={a} onComplete={completeActivity} onDelete={deleteActivity} />
                  ))}
                </div>
              )}
            </div>

            {/* Quote Builder */}
            <div className="bg-white/4 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">{t.deals.quoteBuilder}</h3>
              <QuoteBuilder
                dealId={selectedDeal.id}
                dealTitle={selectedDeal.title}
                initialItems={selectedDeal.quoteItems ?? []}
                contactEmail={getContact(selectedDeal.contactId)?.email}
                companyName={getCompany(selectedDeal.companyId)?.name}
                currency={selectedDeal.currency}
                onComposeQuoteDraft={(draft) => {
                  setEmailDraft(draft)
                  setIsEmailOpen(true)
                }}
              />
            </div>

          </div>
        )}
      </SlideOver>

      {/* Edit deal */}
      <SlideOver isOpen={isEditing} onClose={() => setIsEditing(false)} title={t.deals.editDeal}>
        {selectedDeal && (
          <DealForm deal={selectedDeal} onSubmit={handleEdit} onCancel={() => setIsEditing(false)} />
        )}
      </SlideOver>

      {/* Add activity */}
      <SlideOver isOpen={isActivityOpen} onClose={() => setIsActivityOpen(false)} title={t.activities.newActivity}>
        {selectedDeal && (
          <ActivityForm
            defaultDealId={selectedDeal.id}
            defaultContactId={selectedDeal.contactId}
            onSubmit={handleAddActivity}
            onCancel={() => setIsActivityOpen(false)}
          />
        )}
      </SlideOver>

      {/* Email composer */}
      <SlideOver isOpen={isEmailOpen} onClose={() => setIsEmailOpen(false)} title={t.inbox.compose}>
        {selectedDeal && (
          <EmailComposer
            isOpen={isEmailOpen}
            onClose={() => {
              setIsEmailOpen(false)
              setEmailDraft(null)
            }}
            defaultTo={emailDraft?.to ?? ''}
            defaultSubject={emailDraft?.subject ?? ''}
            defaultBody={emailDraft?.body ?? ''}
            defaultAttachments={emailDraft?.attachments ?? []}
            dealId={selectedDeal.id}
            contactId={selectedDeal.contactId}
          />
        )}
      </SlideOver>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) handleDelete(deleteId) }}
        title={t.common.delete}
        message={t.common.bulkDeleteConfirm}
        confirmLabel={t.common.delete}
        danger
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        isOpen={showBulkDelete}
        onClose={() => setShowBulkDelete(false)}
        onConfirm={handleBulkDeleteDeals}
        title={`${t.common.delete} ${selectedDealIds.size} ${t.deals.title}`}
        message={t.common.bulkDeleteConfirm}
        confirmLabel={t.common.bulkDelete}
        danger
      />
    </div>
  )
}
