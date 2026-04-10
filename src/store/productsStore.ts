import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Product } from '../types'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getOrgId, sbDelete } from '../lib/supabaseHelpers'

const SEED_PRODUCTS: Product[] = (() => {
  const now = new Date().toISOString()
  return [
    { id: 'prod-001', name: 'CRM Pro License', description: 'Licencia anual CRM Pro con soporte incluido', sku: 'CRM-PRO-001', price: 1200, currency: 'EUR', category: 'software', isActive: true, createdAt: now, updatedAt: now },
    { id: 'prod-002', name: 'Implementación Básica', description: 'Servicio de implementación y migración de datos', sku: 'SRV-IMP-001', price: 3500, currency: 'EUR', category: 'consulting', isActive: true, createdAt: now, updatedAt: now },
    { id: 'prod-003', name: 'Soporte Premium 24/7', description: 'Soporte prioritario con SLA garantizado < 2h', sku: 'SUP-PREM-001', price: 800, currency: 'EUR', category: 'support', isActive: true, createdAt: now, updatedAt: now },
    { id: 'prod-004', name: 'Formación Equipos', description: 'Sesiones de formación presencial para equipos de ventas', sku: 'TRN-EQ-001', price: 1500, currency: 'EUR', category: 'service', isActive: true, createdAt: now, updatedAt: now },
    { id: 'prod-005', name: 'API Integration Pack', description: 'Pack de integraciones con sistemas externos via API REST', sku: 'API-INT-001', price: 2200, currency: 'EUR', category: 'software', isActive: true, createdAt: now, updatedAt: now },
    { id: 'prod-006', name: 'Servidor On-Premise', description: 'Hardware dedicado para instalación local del CRM', sku: 'HW-SRV-001', price: 4800, currency: 'EUR', category: 'hardware', isActive: true, createdAt: now, updatedAt: now },
  ]
})()

interface ProductsStore {
  products: Product[]
  isLoading: boolean
  error: string | null
  fetchProducts: () => Promise<void>
  addProduct: (p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateProduct: (id: string, updates: Partial<Product>) => void
  deleteProduct: (id: string) => void
  getActive: () => Product[]
}

export const useProductsStore = create<ProductsStore>()((set, get) => ({
  products: SEED_PRODUCTS,
  isLoading: false,
  error: null,

  fetchProducts: async () => {
    if (!isSupabaseConfigured || !supabase) {
      set({ products: SEED_PRODUCTS })
      return
    }
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await (supabase as any).from('products').select('*').order('created_at', { ascending: false })
      if (error) throw error
      const products: Product[] = (data ?? []).map((r: any) => ({
        id: r.id, name: r.name, description: r.description, sku: r.sku,
        price: r.price, currency: r.currency, category: r.category,
        isActive: r.is_active, createdAt: r.created_at, updatedAt: r.updated_at,
      }))
      set({ products: products.length > 0 ? products : SEED_PRODUCTS, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  addProduct: (data) => {
    const now = new Date().toISOString()
    const product: Product = { ...data, id: uuidv4(), createdAt: now, updatedAt: now }
    set((s) => ({ products: [...s.products, product] }))
    if (isSupabaseConfigured && supabase) {
      ;(supabase as any).from('products').insert({
        id: product.id, name: product.name, description: product.description,
        sku: product.sku, price: product.price, currency: product.currency,
        category: product.category, is_active: product.isActive,
        organization_id: getOrgId(),
      }).then(({ error }: any) => { if (error) console.error('[productsStore] insert error', error) })
    }
  },

  updateProduct: (id, updates) => {
    set((s) => ({
      products: s.products.map((p) => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p),
    }))
    if (isSupabaseConfigured && supabase) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (updates.name !== undefined) row.name = updates.name
      if (updates.description !== undefined) row.description = updates.description
      if (updates.sku !== undefined) row.sku = updates.sku
      if (updates.price !== undefined) row.price = updates.price
      if (updates.currency !== undefined) row.currency = updates.currency
      if (updates.category !== undefined) row.category = updates.category
      if (updates.isActive !== undefined) row.is_active = updates.isActive
      ;(supabase as any).from('products').update(row).eq('id', id)
        .then(({ error }: any) => { if (error) console.error('[productsStore] update error', error) })
    }
  },

  deleteProduct: (id) => {
    set((s) => ({ products: s.products.filter((p) => p.id !== id) }))
    if (isSupabaseConfigured && supabase) {
      sbDelete('products', id).catch((e) => console.error('[productsStore] delete error', e))
    }
  },

  getActive: () => get().products.filter((p) => p.isActive),
}))
