import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useTranslations } from '../i18n'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export function Login() {
  const t = useTranslations()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isSupabaseConfigured && supabase) {
      const { error: sbError } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (sbError) {
        setError(sbError.message)
      } else {
        navigate('/')
      }
    } else {
      setTimeout(() => {
        const result = login(email, password)
        setLoading(false)
        if (result.success) {
          navigate('/')
        } else {
          setError(result.error || t.auth.login)
        }
      }, 400)
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl btn-gradient flex items-center justify-center mx-auto shadow-brand-sm mb-4">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">CRM Pro</h1>
          <p className="text-sm text-slate-500 mt-1">{t.auth.login}</p>
          {isSupabaseConfigured && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <ShieldCheck size={11} className="text-emerald-400" />
              <span className="text-[10px] font-medium text-emerald-400">{t.auth.realAuthEnabled}</span>
            </div>
          )}
        </div>

        {/* Login form */}
        <div className="glass rounded-2xl shadow-float border-white/10 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.auth.email}</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.auth.emailPlaceholder}
                  required
                  autoFocus
                  className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-brand-500/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.auth.password}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl pl-11 pr-11 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-brand-500/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="text-right -mt-2">
              <Link to="/forgot-password" className="text-xs text-slate-500 hover:text-brand-400 transition-colors">
                {t.auth.forgotPassword}
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl btn-gradient text-white font-semibold text-sm disabled:opacity-50 transition-all"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  {t.auth.loginButton}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/6 text-center">
            <p className="text-sm text-slate-500">
              {t.auth.noAccount}{' '}
              <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                {t.auth.register}
              </Link>
            </p>
          </div>
        </div>

        {/* Demo credentials — only shown in mock mode */}
        {!isSupabaseConfigured && <div className="mt-6 glass rounded-xl border-white/8 p-4">
          <p className="text-xs font-semibold text-slate-400 mb-2">{t.auth.login} demo</p>
          <div className="space-y-1.5">
            {[
              { email: 'david@crmpro.es', role: 'Admin', color: 'text-red-400' },
              { email: 'sara@crmpro.es', role: 'Manager', color: 'text-brand-400' },
              { email: 'carlos@crmpro.es', role: 'Comercial', color: 'text-emerald-400' },
            ].map((demo) => (
              <button
                key={demo.email}
                onClick={() => { setEmail(demo.email); setPassword('demo123') }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
              >
                <span className="text-xs text-slate-300">{demo.email}</span>
                <span className={`text-[10px] font-semibold ${demo.color}`}>{demo.role}</span>
              </button>
            ))}
            <p className="text-[10px] text-slate-600 pt-1">{t.auth.password}: demo123</p>
          </div>
        </div>}
      </div>
    </div>
  )
}
