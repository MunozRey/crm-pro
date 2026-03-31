import type { ReactNode } from 'react'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ToastContainer } from '../ui/Toast'
import { CommandPalette } from './CommandPalette'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../store/toastStore'
import { useTranslations } from '../../i18n'

interface LayoutProps {
  children: ReactNode
  title: string
}

export function Layout({ children, title }: LayoutProps) {
  const t = useTranslations()
  const [cmdOpen, setCmdOpen] = useState(false)
  const navigate = useNavigate()
  const sessionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Session expiry check every 60 seconds
  useEffect(() => {
    const checkSession = () => {
      const { session, logout, isAuthenticated } = useAuthStore.getState()
      if (!isAuthenticated()) return
      if (session && Date.now() > session.expiresAt) {
        void logout().then(() => {
          toast.error(t.auth.login)
          navigate('/login')
        })
      }
    }

    sessionCheckRef.current = setInterval(checkSession, 60_000)
    return () => {
      if (sessionCheckRef.current) clearInterval(sessionCheckRef.current)
    }
  }, [navigate])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <div className="flex h-screen bg-navy-900 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar title={title} onOpenCommandPalette={() => setCmdOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <ToastContainer />
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  )
}
