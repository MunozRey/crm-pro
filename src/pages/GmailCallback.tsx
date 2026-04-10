import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useGmailToken } from '../contexts/GmailTokenContext'
import { useEmailStore } from '../store/emailStore'
import { supabase } from '../lib/supabase'
import { toast } from '../store/toastStore'
import { getGmailRedirectUri } from '../services/gmailService'

export function GmailCallback() {
  const navigate = useNavigate()
  const { setGmailToken } = useGmailToken()
  const setGmailAddress = useEmailStore((s) => s.setGmailAddress)
  const didRun = useRef(false)

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    async function exchange() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const returnedState = params.get('state')

      // CSRF check: state must match what we stored before the redirect
      const storedState = sessionStorage.getItem('gmail_oauth_state')
      const codeVerifier = sessionStorage.getItem('gmail_oauth_verifier')

      if (!code || !returnedState || !storedState || !codeVerifier) {
        toast.error('Gmail connection failed — missing OAuth parameters')
        navigate('/inbox', { replace: true })
        return
      }

      if (returnedState !== storedState) {
        toast.error('Gmail connection failed — state mismatch (possible CSRF)')
        navigate('/inbox', { replace: true })
        return
      }

      // Clear sessionStorage — verifier + state are single-use
      sessionStorage.removeItem('gmail_oauth_state')
      sessionStorage.removeItem('gmail_oauth_verifier')

      try {
        const { data, error } = await supabase!.functions.invoke('gmail-oauth-exchange', {
          body: { code, code_verifier: codeVerifier, redirect_uri: getGmailRedirectUri() },
        })

        if (error || !data?.access_token) {
          toast.error('Gmail connection failed — try again')
          navigate('/inbox', { replace: true })
          return
        }

        // Store access token in memory only (per D-08)
        const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000
        setGmailToken(data.access_token, expiresAt)

        // Persist only the email address (per D-09)
        if (data.email_address) {
          setGmailAddress(data.email_address)
        }

        navigate('/inbox', { replace: true })
      } catch {
        toast.error('Gmail connection failed — try again')
        navigate('/inbox', { replace: true })
      }
    }

    exchange()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
        <p className="text-slate-300 text-sm font-medium">Connecting Gmail...</p>
      </div>
    </div>
  )
}
