import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useSettingsStore } from '../store/settingsStore'
import { LANGUAGE_FLAGS, LANGUAGE_LABELS, useI18nStore, useTranslations } from '../i18n'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { authProviderConfig, resolveSamlDomain } from '../config/authProviders'
import type { Language } from '../i18n'

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.8 3 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.8H12z" />
      <path fill="#34A853" d="M2 12c0 2.1.8 4 2.1 5.5l3.4-2.6c-.9-.7-1.5-1.8-1.5-2.9s.6-2.2 1.5-2.9L4.1 6.5C2.8 8 2 9.9 2 12z" />
      <path fill="#FBBC05" d="M12 22c2.6 0 4.8-.9 6.4-2.5l-3.1-2.4c-.8.6-1.9 1-3.3 1-2.5 0-4.6-1.7-5.3-4L3.2 17c1.7 3.3 5.1 5 8.8 5z" />
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.2-.2-1.8H12v3.9h5.5c-.3 1.4-1.1 2.4-2.2 3.1l3.1 2.4c1.8-1.7 3.2-4.2 3.2-7.6z" />
    </svg>
  )
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <rect x="2" y="2" width="9" height="9" fill="#F25022" />
      <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
      <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
      <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
    </svg>
  )
}

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
      <path d="M16.7 12.7c0-2.1 1.7-3.1 1.8-3.2-1-.1-2.5-1.1-3.9-1.1-1.6 0-2.4.8-3.3.8-.9 0-1.8-.8-3-.8-2.3 0-4.7 1.9-4.7 5.5 0 1.2.2 2.5.7 3.8.6 1.5 1.4 3.2 2.6 3.2.7 0 1.2-.5 2.1-.5.9 0 1.3.5 2.1.5 1.2 0 2-1.5 2.6-3 .4-1 .5-1.5.8-2.6-2-.8-2.8-2.4-2.8-3.6zm-3.3-6.6c.5-.6.9-1.4.8-2.2-.8.1-1.6.5-2.1 1.1-.5.5-.9 1.3-.8 2.1.8.1 1.5-.3 2.1-1z" />
    </svg>
  )
}

export function Login() {
  const t = useTranslations()
  const { language, setLanguage } = useI18nStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [ssoDomain, setSsoDomain] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [providerLoading, setProviderLoading] = useState<'google' | 'azure' | 'apple' | 'saml' | null>(null)
  const [branding, setBranding] = useState(useSettingsStore.getState().settings.branding)
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  useEffect(() => {
    const unsub = useSettingsStore.subscribe((s) => setBranding(s.settings.branding))
    return unsub
  }, [])

  const handleOAuthLogin = async (provider: 'google' | 'azure' | 'apple') => {
    if (!isSupabaseConfigured || !supabase) return
    setError('')
    setProviderLoading(provider)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (oauthError) setError(oauthError.message)
    setProviderLoading(null)
  }

  const handleSamlLogin = async () => {
    if (!isSupabaseConfigured || !supabase) return
    if (!ssoDomain.trim()) {
      setError(t.auth.companyDomainRequired)
      return
    }
    setError('')
    setProviderLoading('saml')
    let samlDomain = ''
    try {
      samlDomain = await resolveSamlDomain(ssoDomain)
    } catch (e) {
      setError((e as Error).message)
      setProviderLoading(null)
      return
    }
    const { error: ssoError } = await supabase.auth.signInWithSSO({
      domain: samlDomain,
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (ssoError) setError(ssoError.message)
    setProviderLoading(null)
  }

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
    <div className="auth-page-bg min-h-screen bg-navy-950 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="auth-bg-blob absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="auth-bg-blob absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-end mb-3">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-[#0d0e1a] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-brand-500/50"
              aria-label={t.settings.language}
              title={t.settings.language}
            >
              {(['en', 'es', 'pt', 'fr', 'de', 'it'] as Language[]).map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_FLAGS[lang]} {LANGUAGE_LABELS[lang]}
                </option>
              ))}
            </select>
          </div>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-brand-sm mb-4 overflow-hidden" style={{ backgroundColor: branding.primaryColor }}>
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.appName} className="w-full h-full object-cover" />
            ) : (
              <Zap size={24} className="text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">{branding.appName}</h1>
          {branding.customDomain && (
            <p className="text-xs text-slate-500 mt-1">{branding.customDomain}</p>
          )}
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
                  placeholder={t.auth.password}
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

          {isSupabaseConfigured && (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] uppercase tracking-wider text-slate-500">{t.auth.sso}</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="space-y-2">
                {authProviderConfig.google && (
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('google')}
                    disabled={providerLoading !== null}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-60 transition-colors"
                  >
                    <GoogleLogo />
                    {providerLoading === 'google' ? `${t.auth.connecting} Google...` : `${t.common.continue} Google`}
                  </button>
                )}
                {authProviderConfig.azure && (
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('azure')}
                    disabled={providerLoading !== null}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-60 transition-colors"
                  >
                    <MicrosoftLogo />
                    {providerLoading === 'azure' ? `${t.auth.connecting} Azure...` : `${t.common.continue} Azure`}
                  </button>
                )}
                {authProviderConfig.apple && (
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('apple')}
                    disabled={providerLoading !== null}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-60 transition-colors"
                  >
                    <AppleLogo />
                    {providerLoading === 'apple' ? `${t.auth.connecting} Apple...` : `${t.common.continue} Apple`}
                  </button>
                )}
              </div>

              {authProviderConfig.saml && (
                <div className="mt-3 rounded-2xl border border-slate-200 p-4 bg-white shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">{t.auth.saml}</p>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={ssoDomain}
                      onChange={(e) => setSsoDomain(e.target.value)}
                      placeholder={t.auth.samlDomainPlaceholder}
                      className="flex-1 min-w-0 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-brand-500/70 focus:ring-2 focus:ring-brand-500/25 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleSamlLogin}
                      disabled={providerLoading !== null}
                      className="sm:w-auto w-full px-4 py-2.5 rounded-xl border border-brand-400 bg-brand-500 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors whitespace-nowrap"
                    >
                      {providerLoading === 'saml' ? `${t.auth.connecting}...` : t.auth.useSaml}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">{t.auth.companyDomainRequired}</p>
                </div>
              )}
            </>
          )}

          <div className="mt-6 pt-5 border-t border-white/6 text-center">
            <p className="text-sm text-slate-500">
              {t.auth.noAccount}{' '}
              <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                {t.auth.register}
              </Link>
            </p>
          </div>
        </div>

        {(branding.privacyUrl || branding.termsUrl) && (
          <div className="mt-3 text-center text-[11px] text-slate-600">
            {branding.privacyUrl && (
              <a href={branding.privacyUrl} target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors">
                {t.settings.privacyUrl}
              </a>
            )}
            {branding.privacyUrl && branding.termsUrl && <span className="mx-2">·</span>}
            {branding.termsUrl && (
              <a href={branding.termsUrl} target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors">
                {t.settings.termsUrl}
              </a>
            )}
          </div>
        )}

        {/* Demo credentials — only shown in mock mode */}
        {!isSupabaseConfigured && <div className="mt-6 glass rounded-xl border-white/8 p-4">
          <p className="text-xs font-semibold text-slate-400 mb-2">{t.auth.demoLogin}</p>
          <div className="space-y-1.5">
              {[
              { email: 'david@crmpro.es', role: t.acceptInvite.roleAdmin, color: 'text-red-400' },
              { email: 'sara@crmpro.es', role: t.acceptInvite.roleManager, color: 'text-brand-400' },
              { email: 'carlos@crmpro.es', role: t.acceptInvite.roleSalesRep, color: 'text-emerald-400' },
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
