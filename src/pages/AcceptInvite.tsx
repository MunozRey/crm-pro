import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { UserPlus, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTranslations } from '../i18n'

interface InvitationRow {
  id: string
  organization_id: string
  email: string
  role: string
  status: string
  expires_at: string
  organizations: { name: string } | null
}

type PageState = 'loading' | 'ready' | 'joining' | 'success' | 'error'

export function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const t = useTranslations()
  const token = searchParams.get('token')

  const [pageState, setPageState] = useState<PageState>('loading')
  const [invitation, setInvitation] = useState<InvitationRow | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setErrorMsg(t.invitations.invalidToken)
      setPageState('error')
      return
    }
    if (!supabase) {
      setErrorMsg(t.errors.supabaseNotConfigured)
      setPageState('error')
      return
    }

    const fetchInvitation = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase! as any)
        .from('invitations')
        .select('*, organizations(name)')
        .eq('token', token)
        .single()

      if (error || !data) {
        setErrorMsg(t.invitations.invalidOrExpired)
        setPageState('error')
        return
      }

      const inv = data as InvitationRow

      if (inv.status !== 'pending') {
        setErrorMsg(
          inv.status === 'accepted'
            ? t.invitations.alreadyAccepted
            : t.invitations.expired
        )
        setPageState('error')
        return
      }

      if (new Date(inv.expires_at) < new Date()) {
        setErrorMsg(t.invitations.expired)
        setPageState('error')
        return
      }

      setInvitation(inv)
      setPageState('ready')
    }

    fetchInvitation()
  }, [token])

  const handleAccept = async () => {
    if (!invitation || !supabase) return

    setPageState('joining')

    try {
      // Get current authenticated user
      const { data: { user }, error: userErr } = await supabase!.auth.getUser()

      if (userErr || !user) {
        // Not authenticated — redirect to login, preserve the token in returnUrl
        navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)
        return
      }

      // Insert organization_members row — DB trigger will write organization_id into JWT app_metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: memberErr } = await (supabase! as any)
        .from('organization_members')
        .insert({
          organization_id: invitation.organization_id,
          user_id: user.id,
          role: invitation.role,
        })

      if (memberErr) throw new Error(memberErr.message)

      // Mark invitation as accepted
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase! as any)
        .from('invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id)

      // Refresh session — the DB trigger has now set organization_id in app_metadata.
      // After this call, onAuthStateChange fires and updates authStore.organizationId.
      const { error: refreshErr } = await supabase!.auth.refreshSession()
      if (refreshErr) throw new Error(refreshErr.message)

      setPageState('success')
      // Small delay so user sees the success state before redirect
      setTimeout(() => navigate('/', { replace: true }), 1500)
    } catch (err) {
      setErrorMsg((err as Error).message)
      setPageState('error')
    }
  }

  const orgName = invitation?.organizations?.name ?? t.acceptInvite.organization

  // ── Render states ──────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-400" />
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <XCircle size={28} className="text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">{t.acceptInvite.invalidTitle}</h1>
          <p className="text-sm text-slate-500 mb-6">{errorMsg}</p>
          <Link
            to="/login"
            className="inline-flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t.acceptInvite.loginCta}
          </Link>
        </div>
      </div>
    )
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">{t.acceptInvite.welcomeTo} {orgName}!</h1>
          <p className="text-sm text-slate-500">{t.acceptInvite.redirecting}</p>
        </div>
      </div>
    )
  }

  // pageState === 'ready' || 'joining'
  const ROLE_LABELS: Record<string, string> = {
    admin: t.acceptInvite.roleAdmin,
    manager: t.acceptInvite.roleManager,
    sales_rep: t.acceptInvite.roleSalesRep,
    viewer: t.acceptInvite.roleViewer,
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/20 flex items-center justify-center mb-4">
            <UserPlus size={28} className="text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t.acceptInvite.joinOrg} {orgName}</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            {t.acceptInvite.invitedToTeam}
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{t.acceptInvite.organization}</span>
            <span className="text-white font-medium">{orgName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{t.auth.email}</span>
            <span className="text-white">{invitation?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{t.acceptInvite.assignedRole}</span>
            <span className="text-brand-400 font-medium">
              {ROLE_LABELS[invitation?.role ?? ''] ?? invitation?.role}
            </span>
          </div>
        </div>

        <button
          onClick={handleAccept}
          disabled={pageState === 'joining'}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {pageState === 'joining' ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <UserPlus size={18} />
              {t.acceptInvite.acceptCta}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
