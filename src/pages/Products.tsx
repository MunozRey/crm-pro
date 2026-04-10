import { useState } from 'react'
import { Package, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Search } from 'lucide-react'
import { useProductsStore } from '../store/productsStore'
import { PermissionGate } from '../components/auth/PermissionGate'
import { toast } from '../store/toastStore'
import { useTranslations } from '../i18n'
import type { Product, ProductCategory, DealCurrency } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

function getCategoryLabels(t: ReturnType<typeof useTranslations>): Record<ProductCategory, string> {
  return {
    software: t.products.categoryLabels.software,
    hardware: t.products.categoryLabels.hardware,
    service: t.products.categoryLabels.service,
    consulting: t.products.categoryLabels.consulting,
    support: t.products.categoryLabels.support,
    other: t.products.categoryLabels.other,
  }
}

const CATEGORY_COLORS: Record<ProductCategory, string> = {
  software: 'bg-brand-500/15 text-brand-400 border-brand-500/20',
  hardware: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  service: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  consulting: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  support: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  other: 'bg-white/8 text-slate-400 border-white/10',
}

const CURRENCY_OPTIONS: DealCurrency[] = ['EUR', 'USD', 'GBP']

function formatPrice(price: number, currency: DealCurrency) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(price)
}

// ─── Blank product ─────────────────────────────────────────────────────────────

function blankProduct(): Omit<Product, 'id' | 'createdAt' | 'updatedAt'> {
  return { name: '', description: '', sku: '', price: 0, currency: 'EUR', category: 'software', isActive: true }
}

// ─── Product modal ─────────────────────────────────────────────────────────────

function ProductModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
  onSave: (p: typeof initial) => void
  onClose: () => void
}) {
  const t = useTranslations()
  const categoryLabels = getCategoryLabels(t)
  const [form, setForm] = useState(initial)

  const handleSave = () => {
    if (!form.name.trim()) { toast.error(t.common.name); return }
    if (!form.sku.trim()) { toast.error(t.products.sku); return }
    if (form.price < 0) { toast.error(t.products.price); return }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md border border-white/10 rounded-2xl shadow-float overflow-hidden bg-[#0d0f1e]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <h2 className="text-sm font-semibold text-white">
            {initial.name ? `${t.common.edit} ${t.products.title.toLowerCase()}` : t.products.newProduct}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-white transition-colors text-lg leading-none">×</button>
        </div>

        <div className="p-5 space-y-3">
          <input
            type="text"
            placeholder={`${t.common.name} *`}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50"
          />
          <input
            type="text"
            placeholder={`${t.products.sku} *`}
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50"
          />
          <textarea
            placeholder={t.common.description}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50 resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              placeholder={t.products.price}
              min={0}
              step={0.01}
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
              className="bg-[#0d0e1a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50"
            />
            <select
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as DealCurrency }))}
              aria-label={t.settings.currency}
              title={t.settings.currency}
              className="bg-[#0d0e1a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50"
            >
              {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ProductCategory }))}
            aria-label={t.products.category}
            title={t.products.category}
            className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50"
          >
            {(Object.keys(categoryLabels) as ProductCategory[]).map((c) => (
              <option key={c} value={c}>{categoryLabels[c]}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-white/20 bg-white/4 text-brand-500 focus:ring-brand-500/30"
            />
            <span className="text-sm text-slate-300">{t.common.active} {t.products.title.toLowerCase()}</span>
          </label>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-white/10 text-xs text-slate-400 hover:text-white hover:bg-white/4 transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-xs text-white font-medium transition-colors"
          >
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Product card ──────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: Product }) {
  const t = useTranslations()
  const categoryLabels = getCategoryLabels(t)
  const { updateProduct, deleteProduct } = useProductsStore()
  const [editing, setEditing] = useState(false)

  const handleSave = (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    updateProduct(product.id, data)
    setEditing(false)
    toast.success(t.products.title)
  }

  return (
    <>
      {editing && (
        <ProductModal
          initial={{ name: product.name, description: product.description, sku: product.sku, price: product.price, currency: product.currency, category: product.category, isActive: product.isActive }}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      )}

      <div className={`glass rounded-xl p-4 border transition-colors ${product.isActive ? 'border-white/6' : 'border-white/3 opacity-60'}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white truncate">{product.name}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${product.isActive ? 'border-white/10 text-slate-500' : 'border-white/6 text-slate-600'}`}>
                {product.sku}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${CATEGORY_COLORS[product.category]}`}>
                {categoryLabels[product.category]}
              </span>
              {!product.isActive && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#0d0e1a] border border-white/8 text-slate-500">{t.common.inactive}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <PermissionGate permission="products:update">
              <button
                onClick={() => updateProduct(product.id, { isActive: !product.isActive })}
                title={product.isActive ? t.common.disabled : t.common.enabled}
              >
                {product.isActive
                  ? <ToggleRight size={18} className="text-brand-400" />
                  : <ToggleLeft size={18} className="text-slate-500" />
                }
              </button>
            </PermissionGate>
            <PermissionGate permission="products:update">
              <button
                onClick={() => setEditing(true)}
                title={t.common.edit}
                aria-label={t.common.edit}
                className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors"
              >
                <Edit2 size={13} />
              </button>
            </PermissionGate>
            <PermissionGate permission="products:delete">
              <button
                onClick={() => { deleteProduct(product.id); toast.success(t.common.delete) }}
                title={t.common.delete}
                aria-label={t.common.delete}
                className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </PermissionGate>
          </div>
        </div>

        {product.description && (
          <p className="text-xs text-slate-500 mb-2 line-clamp-2">{product.description}</p>
        )}

        <p className="text-lg font-bold text-white">
          {formatPrice(product.price, product.currency)}
        </p>
      </div>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Products() {
  const t = useTranslations()
  const categoryLabels = getCategoryLabels(t)
  const products = useProductsStore((s) => s.products)
  const addProduct = useProductsStore((s) => s.addProduct)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | ''>('')

  const filtered = products.filter((p) => {
    const q = search.toLowerCase()
    if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false
    if (categoryFilter && p.category !== categoryFilter) return false
    return true
  })

  const active = products.filter((p) => p.isActive).length
  const totalValue = products.filter((p) => p.isActive).reduce((s, p) => s + p.price, 0)

  const handleSave = (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    addProduct(data)
    setShowNew(false)
    toast.success(t.products.newProduct)
  }

  return (
    <div className="p-6 space-y-5">
      {showNew && (
        <ProductModal initial={blankProduct()} onSave={handleSave} onClose={() => setShowNew(false)} />
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 relative min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder={`${t.common.search} ${t.common.name.toLowerCase()} / ${t.products.sku}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0d0e1a] border border-white/8 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ProductCategory | '')}
          aria-label={t.products.category}
          title={t.products.category}
          className="bg-[#0d0e1a] border border-white/8 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
        >
          <option value="">{t.common.all} {t.products.category.toLowerCase()}</option>
          {(Object.keys(categoryLabels) as ProductCategory[]).map((c) => (
            <option key={c} value={c}>{categoryLabels[c]}</option>
          ))}
        </select>
        <PermissionGate permission="products:create">
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-xs text-white font-medium transition-colors"
          >
            <Plus size={13} />
            {t.products.newProduct}
          </button>
        </PermissionGate>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl p-4 border border-white/6">
          <p className="text-xs text-slate-500 mb-1">{t.common.total} {t.products.title.toLowerCase()}</p>
          <p className="text-2xl font-bold text-white">{products.length}</p>
        </div>
        <div className="glass rounded-xl p-4 border border-white/6">
          <p className="text-xs text-slate-500 mb-1">{t.common.active}</p>
          <p className="text-2xl font-bold text-emerald-400">{active}</p>
        </div>
        <div className="glass rounded-xl p-4 border border-white/6">
          <p className="text-xs text-slate-500 mb-1">{t.products.price}</p>
          <p className="text-lg font-bold text-brand-400">
            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalValue)}
          </p>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 border border-white/6 text-center">
          <Package size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-400">
            {products.length === 0 ? t.products.title : t.common.noResults}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {products.length === 0 ? t.products.newProduct : t.common.reset}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
