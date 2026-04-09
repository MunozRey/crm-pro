import type { GmailThread, GmailMessage } from '../types'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
].join(' ')

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function base64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// ─── Auth Code + PKCE initiation ─────────────────────────────────────────────

const REDIRECT_URI =
  import.meta.env.DEV
    ? 'http://localhost:5173/auth/gmail/callback'
    : `${window.location.origin}/auth/gmail/callback`

export async function initiateGmailOAuth(clientId: string): Promise<void> {
  // 1. Generate code_verifier: 64 random bytes → base64url
  const verifierBytes = new Uint8Array(64)
  crypto.getRandomValues(verifierBytes)
  const codeVerifier = base64urlEncode(verifierBytes)

  // 2. Generate code_challenge: SHA-256(verifier) → base64url
  const encoder = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier))
  const codeChallenge = base64urlEncode(new Uint8Array(digest))

  // 3. Generate state nonce for CSRF protection
  const stateBytes = new Uint8Array(16)
  crypto.getRandomValues(stateBytes)
  const state = base64urlEncode(stateBytes)

  // 4. Store verifier + state in sessionStorage (survive the redirect, not persistent)
  sessionStorage.setItem('gmail_oauth_verifier', codeVerifier)
  sessionStorage.setItem('gmail_oauth_state', state)

  // 5. Build authorization URL manually (GIS initCodeClient does not support PKCE in redirect mode)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  })

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export function revokeGmailAccess(accessToken: string, callback: () => void): void {
  fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, { method: 'POST' })
    .catch(() => {})
    .finally(callback)
}

// ─── Gmail REST API ───────────────────────────────────────────────────────────

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

async function gmailFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error(err?.error?.message ?? `Gmail API error ${res.status}`)
  }

  return res.json() as Promise<T>
}

// ─── Send email ───────────────────────────────────────────────────────────────

function buildMimeMessage(params: {
  to: string[]
  cc?: string[]
  subject: string
  body: string
  from?: string
}): string {
  const lines = [
    `To: ${params.to.join(', ')}`,
    params.cc?.length ? `Cc: ${params.cc.join(', ')}` : null,
    params.from ? `From: ${params.from}` : null,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    params.body,
  ].filter(Boolean)

  const raw = lines.join('\r\n')
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function sendGmailEmail(
  params: { to: string[]; cc?: string[]; subject: string; body: string },
  accessToken: string,
): Promise<{ id: string; threadId: string }> {
  const raw = buildMimeMessage(params)
  return gmailFetch<{ id: string; threadId: string }>('/messages/send', accessToken, {
    method: 'POST',
    body: JSON.stringify({ raw }),
  })
}

// ─── List threads ─────────────────────────────────────────────────────────────

interface RawThreadList {
  threads?: Array<{ id: string; snippet: string; historyId: string }>
}

interface RawMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  payload: {
    headers: Array<{ name: string; value: string }>
    body?: { data?: string }
    parts?: Array<{ mimeType: string; body?: { data?: string } }>
  }
  internalDate: string
}

function decodeBase64(data: string): string {
  try {
    return decodeURIComponent(escape(atob(data.replace(/-/g, '+').replace(/_/g, '/'))))
  } catch {
    return ''
  }
}

function extractBody(msg: RawMessage): string {
  const payload = msg.payload
  if (payload.body?.data) return decodeBase64(payload.body.data)
  const textPart = payload.parts?.find((p) => p.mimeType === 'text/plain')
  if (textPart?.body?.data) return decodeBase64(textPart.body.data)
  return msg.snippet
}

function parseMessage(raw: RawMessage): GmailMessage {
  const headers = raw.payload.headers
  const get = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
  return {
    id: raw.id,
    threadId: raw.threadId,
    from: get('From'),
    to: get('To'),
    subject: get('Subject'),
    snippet: raw.snippet,
    body: extractBody(raw),
    date: new Date(Number(raw.internalDate)).toISOString(),
    labelIds: raw.labelIds ?? [],
  }
}

export async function listGmailThreads(
  accessToken: string,
  query = '',
  maxResults = 30,
): Promise<GmailThread[]> {
  const params = new URLSearchParams({ maxResults: String(maxResults) })
  if (query) params.set('q', query)

  const list = await gmailFetch<RawThreadList>(`/threads?${params}`, accessToken)
  if (!list.threads?.length) return []

  // Fetch first 10 threads in full
  const threads = await Promise.all(
    list.threads.slice(0, 10).map((t) =>
      gmailFetch<{ id: string; snippet: string; historyId: string; messages: RawMessage[] }>(
        `/threads/${t.id}?format=full`,
        accessToken,
      ).then((thread) => ({
        id: thread.id,
        snippet: thread.snippet,
        historyId: thread.historyId,
        messages: (thread.messages ?? []).map(parseMessage),
      })),
    ),
  )

  return threads
}

export async function getGmailThread(threadId: string, accessToken: string): Promise<GmailThread> {
  const thread = await gmailFetch<{
    id: string
    snippet: string
    historyId: string
    messages: RawMessage[]
  }>(`/threads/${threadId}?format=full`, accessToken)

  return {
    id: thread.id,
    snippet: thread.snippet,
    historyId: thread.historyId,
    messages: (thread.messages ?? []).map(parseMessage),
  }
}

export async function getGmailProfile(accessToken: string): Promise<{ emailAddress: string; messagesTotal: number }> {
  return gmailFetch<{ emailAddress: string; messagesTotal: number }>('/profile', accessToken)
}
