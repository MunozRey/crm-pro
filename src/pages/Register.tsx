import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, User, Mail, Lock, Building2, Loader2, ArrowRight, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useTranslations } from '../i18n'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export function Register() {
  const t = useTranslations()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const register = useAuthStore((s) => s.register)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError(t.auth.password)
      return
    }

    setLoading(true)

    if (isSupabaseConfigured && supabase) {
      const { data, error: sbError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name, org_name: orgName } },
      })
      setLoading(false)
      if (sbError) {
        setError(sbError.message)
      } else if (data.session) {
        // Email confirmations disabled in Supabase Dashboard — user is immediately logged in
        navigate('/')
      } else {
        // Email confirmation required — show "check your email" screen
        setSuccess(true)
      }
    } else {
      setTimeout(() => {
        const result = register({ name, email, password, orgName })
        setLoading(false)
        if (result.success) {
          navigate('/')
        } else {
          setError(result.error || t.auth.register)
        }
      }, 400)
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/3 w-96 h-96 bg-emerald-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl btn-gradient flex items-center justify-center mx-auto shadow-brand-sm mb-4">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t.auth.registerButton}</h1>
          <p className="text-sm text-slate-500 mt-1">CRM Pro</p>
          {isSupabaseConfigured && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <ShieldCheck size={11} className="text-emerald-400" />
              <span className="text-[10px] font-medium text-emerald-400">Real authentication enabled</span>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl shadow-float border-white/10 p-8">
          {success ? (
            <div className="text-center py-4">
              <ShieldCheck size={40} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">Check your email</p>
              <p className="text-sm text-slate-400">We sent a confirmation link to <span className="text-brand-400">{email}</span></p>
            </div>
          ) : (
          <>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.companies.title}</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder={t.companies.title}
                  required
                  autoFocus
                  className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-brand-500/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.common.name}</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.common.name}
                  required
                  className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-brand-500/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.auth.email}</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@empresa.com"
                  required
                  className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-brand-500/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.auth.password}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.auth.password}
                  required
                  minLength={6}
                  className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-brand-500/50 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !name || !email || !password || !orgName}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl btn-gradient text-white font-semibold text-sm disabled:opacity-50 transition-all"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  {t.auth.registerButton}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/6 text-center">
            <p className="text-sm text-slate-500">
              {t.auth.hasAccount}{' '}
              <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                {t.auth.login}
              </Link>
            </p>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
