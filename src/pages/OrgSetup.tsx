import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ArrowRight, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useTranslations } from '../i18n'

export function OrgSetup() {
  const navigate = useNavigate()
  const t = useTranslations()
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser)

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
    if (!orgName.trim()) { setError(t.orgSetup.errorNameRequired); return }
    if (!slug.trim()) { setError(t.orgSetup.errorSlugRequired); return }
    if (!supabase) { setError(t.orgSetup.errorNotConfigured); return }
    const sb = supabase
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) { setError(t.orgSetup.errorNotAuthenticated); return }

    setIsLoading(true)
    setError(null)

    try {
      // Prefer RPC path to avoid edge gateway JWT parsing issues.
      const { data, error: rpcErr } = await (sb as any).rpc('create_org_self_service', {
        p_org_name: orgName.trim(),
        p_slug: slug.trim(),
      })
      if (rpcErr) throw new Error(rpcErr.message)
      if (!data || (Array.isArray(data) && data.length === 0)) throw new Error(t.errors.generic)

      // Refresh session so JWT carries new organization_id claim
      const { error: refreshErr } = await sb.auth.refreshSession()
      if (refreshErr) throw new Error(refreshErr.message)

      // Sync current user in Zustand immediately with refreshed JWT claims
      const { data: refreshedUserData, error: refreshedUserError } = await sb.auth.getUser()
      if (refreshedUserError || !refreshedUserData.user) {
        throw new Error(refreshedUserError?.message ?? t.orgSetup.errorNotAuthenticated)
      }

      const u = refreshedUserData.user
      setCurrentUser({
        id: u.id,
        name: u.user_metadata?.full_name ?? u.email?.split('@')[0] ?? t.auth.profile,
        email: u.email ?? '',
        role: (u.app_metadata?.user_role as 'admin' | 'manager' | 'sales_rep' | 'viewer') ?? 'admin',
        jobTitle: u.user_metadata?.job_title ?? '',
        organizationId: (u.app_metadata?.organization_id as string | undefined) ?? u.user_metadata?.org_id,
        isActive: true,
        createdAt: u.created_at,
        updatedAt: u.updated_at ?? u.created_at,
      })

      // onAuthStateChange will fire and update currentUser.organizationId.
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
          <h1 className="text-2xl font-bold text-white">{t.orgSetup.title}</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            {t.orgSetup.subtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              {t.orgSetup.orgNameLabel}
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={t.orgSetup.orgNamePlaceholder}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              {t.orgSetup.slugLabel}
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
            <p className="text-xs text-slate-500 mt-1">{t.orgSetup.slugHint}</p>
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
                {t.orgSetup.createButton}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
