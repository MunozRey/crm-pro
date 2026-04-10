import { useState } from 'react'
import {
  User, Mail, Phone, Briefcase, Shield, Lock, Camera,
  Check, X, Eye, EyeOff,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { ROLE_COLORS } from '../utils/permissions'
import { Avatar } from '../components/ui/Avatar'
import { toast } from '../store/toastStore'
import { useTranslations } from '../i18n'

export function UserProfile() {
  const t = useTranslations()
  const { currentUser, updateProfile, changePassword } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [changingPw, setChangingPw] = useState(false)
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)

  const [form, setForm] = useState({
    name: currentUser?.name || '',
    jobTitle: currentUser?.jobTitle || '',
    phone: currentUser?.phone || '',
  })

  const [pwForm, setPwForm] = useState({
    current: '',
    newPw: '',
    confirm: '',
  })

  if (!currentUser) return null

  const colors = ROLE_COLORS[currentUser.role]

  const handleSaveProfile = () => {
    updateProfile(form)
    setEditing(false)
    toast.success(t.auth.editProfile)
  }

  const handleChangePassword = () => {
    if (pwForm.newPw.length < 6) {
      toast.error(t.auth.password)
      return
    }
    if (pwForm.newPw !== pwForm.confirm) {
      toast.error(t.auth.confirmPassword)
      return
    }
    const result = changePassword(currentUser.id, pwForm.current, pwForm.newPw)
    if (result.success) {
      toast.success(t.auth.password)
      setChangingPw(false)
      setPwForm({ current: '', newPw: '', confirm: '' })
    } else {
      toast.error(result.error || t.auth.password)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Profile header */}
      <div className="glass rounded-2xl shadow-float border-white/10 p-8 text-center">
        <div className="relative inline-block mb-4">
          <Avatar name={currentUser.name} size="xl" />
          <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white shadow-lg hover:bg-brand-500 transition-colors">
            <Camera size={14} />
          </button>
        </div>
        <h2 className="text-xl font-bold text-white">{currentUser.name}</h2>
        <p className="text-sm text-slate-400 mt-0.5">{currentUser.jobTitle}</p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${colors.bg} ${colors.text}`}>
            {t.team.roleLabels[currentUser.role]}
          </span>
        </div>
      </div>

      {/* Profile info */}
      <div className="glass rounded-2xl border-white/8 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-white">{t.auth.profile}</h3>
          {!editing ? (
            <button onClick={() => { setForm({ name: currentUser.name, jobTitle: currentUser.jobTitle, phone: currentUser.phone || '' }); setEditing(true) }} className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors">
              {t.common.edit}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors">
                <X size={14} />
              </button>
              <button onClick={handleSaveProfile} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-gradient text-xs text-white font-medium">
                <Check size={12} /> {t.common.save}
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t.common.name}</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-brand-500/40" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t.contacts.jobTitle}</label>
              <div className="relative">
                <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-brand-500/40" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t.common.phone}</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-brand-500/40" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {[
              { icon: <User size={14} />, label: t.common.name, value: currentUser.name },
              { icon: <Mail size={14} />, label: t.auth.email, value: currentUser.email },
              { icon: <Briefcase size={14} />, label: t.contacts.jobTitle, value: currentUser.jobTitle || '—' },
              { icon: <Phone size={14} />, label: t.common.phone, value: currentUser.phone || '—' },
              { icon: <Shield size={14} />, label: t.team.role, value: t.team.roleLabels[currentUser.role] },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-slate-500">{icon}</span>
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</p>
                  <p className="text-sm text-slate-200">{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Change password */}
      <div className="glass rounded-2xl border-white/8 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Lock size={14} className="text-slate-400" />
            {t.settings.notifications}
          </h3>
          {!changingPw && (
            <button onClick={() => setChangingPw(true)} className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors">
              {t.auth.password}
            </button>
          )}
        </div>

        {changingPw ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t.auth.password}</label>
              <div className="relative">
                <input type={showCurrentPw ? 'text' : 'password'} value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl px-4 pr-10 py-2.5 text-sm text-white outline-none focus:border-brand-500/40" />
                <button type="button" onClick={() => setShowCurrentPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t.auth.confirmPassword}</label>
              <div className="relative">
                <input type={showNewPw ? 'text' : 'password'} value={pwForm.newPw} onChange={(e) => setPwForm({ ...pwForm, newPw: e.target.value })} placeholder={t.auth.password} className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl px-4 pr-10 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-brand-500/40" />
                <button type="button" onClick={() => setShowNewPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t.auth.confirmPassword}</label>
              <input type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} className="w-full bg-[#0d0e1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-500/40" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setChangingPw(false); setPwForm({ current: '', newPw: '', confirm: '' }) }} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/6 transition-colors">{t.common.cancel}</button>
              <button onClick={handleChangePassword} className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gradient text-white text-sm font-semibold">
                <Check size={14} /> {t.common.save}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">{t.auth.editProfile}</p>
        )}
      </div>

      {/* Session info */}
      <div className="glass rounded-xl border-white/8 p-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{t.auth.login}: {currentUser.lastLoginAt ? new Date(currentUser.lastLoginAt).toLocaleString() : 'N/A'}</span>
          <span>{t.common.createdAt}: {new Date(currentUser.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  )
}
