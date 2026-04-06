import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Mail, Loader2, ArrowRight, ShieldCheck } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured || !supabase) {
      setSuccess(true) // Demo mode: pretend it works
      return
    }
    setError('')
    setLoading(true)
    const { error: sbError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (sbError) {
      setError(sbError.message)
    } else {
      setSuccess(true)
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl btn-gradient flex items-center justify-center mx-auto shadow-brand-sm mb-4">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">CRM Pro</h1>
          <p className="text-sm text-slate-500 mt-1">Recuperar contraseña</p>
        </div>

        <div className="glass rounded-2xl shadow-float border-white/10 p-8">
          {success ? (
            <div className="text-center py-4">
              <ShieldCheck size={40} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">Revisa tu correo</p>
              <p className="text-sm text-slate-400">
                Hemos enviado un enlace de recuperación a{' '}
                <span className="text-brand-400">{email}</span>
              </p>
              <Link to="/login" className="mt-4 inline-block text-sm text-brand-400 hover:text-brand-300 transition-colors">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-slate-400">
                Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
              </p>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@empresa.com"
                    required
                    autoFocus
                    className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-brand-500/50 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl btn-gradient text-white font-semibold text-sm disabled:opacity-50 transition-all"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Enviar enlace
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <Link to="/login" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                  Volver al inicio de sesión
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
