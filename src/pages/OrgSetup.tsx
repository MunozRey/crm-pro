import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ArrowRight, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export function OrgSetup() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.currentUser)

  const [orgName, setOrgName] = useState('')
  const [slug, setSlug] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-generate slug from org name
  const handleNameChange = (value: string) => {
    setOrgName(value)
    setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgName.trim()) { setError('El nombre de la organización es obligatorio'); return }
    if (!slug.trim()) { setError('El slug es obligatorio'); return }
    if (!supabase) { setError('Supabase no está configurado'); return }
    if (!currentUser) { setError('No autenticado'); return }

    setIsLoading(true)
    setError(null)

    try {
      // 1. Insert organization
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: org, error: orgErr } = await (supabase as any)
        .from('organizations')
        .insert({ name: orgName.trim(), domain: slug.trim() })
        .select()
        .single()

      if (orgErr) throw new Error((orgErr as { message: string }).message)

      // 2. Insert organization_members (creator = admin)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sesión perdida')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: memberErr } = await (supabase as any)
        .from('organization_members')
        .insert({
          organization_id: (org as { id: string }).id,
          user_id: session.user.id,
          role: 'admin',
        })

      if (memberErr) throw new Error((memberErr as { message: string }).message)

      // 3. Refresh session so JWT carries new organization_id from the DB trigger
      const { error: refreshErr } = await supabase.auth.refreshSession()
      if (refreshErr) throw new Error(refreshErr.message)

      // 4. onAuthStateChange in authStore will fire and update currentUser.organizationId.
      // Navigate to dashboard — ProtectedRoute guard will now pass.
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/20 flex items-center justify-center mb-4">
            <Building2 size={28} className="text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Crea tu organización</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            Configura el espacio de trabajo para tu equipo comercial
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Nombre de la organización
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Sales Team"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Slug (identificador único)
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
              <span className="text-slate-500 text-sm select-none">crmpro.app/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="acme-sales"
                className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none text-sm"
                disabled={isLoading}
                required
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Solo letras minúsculas, números y guiones</p>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-500/15 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !orgName.trim() || !slug.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Crear organización
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
