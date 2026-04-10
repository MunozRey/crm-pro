import type { GmailThread, GmailMessage, GmailAttachment } from '../types'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
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

export function getGmailRedirectUri(): string {
  // Always honor current origin (works with localhost:5173, :5174, preview, prod, etc.)
  return `${window.location.origin}/auth/gmail/callback`
}

export async function initiateGmailOAuth(clientId: string): Promise<void> {
  const redirectUri = getGmailRedirectUri()

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
    redirect_uri: redirectUri,
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

export class GmailApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'GmailApiError'
    this.status = status
    this.code = code
  }
}

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
    const err = await res.json().catch(() => ({ error: { message: res.statusText, status: String(res.status) } }))
    const message = err?.error?.message ?? `Gmail API error ${res.status}`
    const code = err?.error?.status ?? err?.error?.code
    throw new GmailApiError(message, res.status, typeof code === 'string' ? code : undefined)
  }

  return res.json() as Promise<T>
}

// ─── Send email ───────────────────────────────────────────────────────────────

function buildMimeMessage(params: {
  to: string[]
  cc?: string[]
  bcc?: string[]
  replyTo?: string
  subject: string
  body: string
  from?: string
}): string {
  const sanitizeHeader = (value: string) => value.replace(/[\r\n]+/g, ' ').trim()
  const sanitizeList = (values: string[]) => values.map(sanitizeHeader).filter(Boolean)

  const to = sanitizeList(params.to)
  const cc = params.cc ? sanitizeList(params.cc) : []
  const bcc = params.bcc ? sanitizeList(params.bcc) : []

  const lines = [
    `To: ${to.join(', ')}`,
    cc.length ? `Cc: ${cc.join(', ')}` : null,
    bcc.length ? `Bcc: ${bcc.join(', ')}` : null,
    params.replyTo ? `Reply-To: ${sanitizeHeader(params.replyTo)}` : null,
    params.from ? `From: ${sanitizeHeader(params.from)}` : null,
    `Subject: ${sanitizeHeader(params.subject)}`,
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
  params: {
    to: string[]
    cc?: string[]
    bcc?: string[]
    replyTo?: string
    subject: string
    body: string
    attachments?: Array<{
      name: string
      mimeType: string
      dataBase64: string
    }>
  },
  accessToken: string,
): Promise<{ id: string; threadId: string }> {
  const encodeBody = (value: string) => btoa(unescape(encodeURIComponent(value)))
  const formatBase64 = (value: string) => value.replace(/(.{76})/g, '$1\r\n')

  const buildMultipartMimeMessage = () => {
    const boundary = `crm-pro-${crypto.randomUUID()}`
    const sanitizeHeader = (value: string) => value.replace(/[\r\n]+/g, ' ').trim()
    const sanitizeList = (values: string[]) => values.map(sanitizeHeader).filter(Boolean)
    const to = sanitizeList(params.to)
    const cc = params.cc ? sanitizeList(params.cc) : []
    const bcc = params.bcc ? sanitizeList(params.bcc) : []
    const lines: string[] = [
      `To: ${to.join(', ')}`,
      cc.length ? `Cc: ${cc.join(', ')}` : '',
      bcc.length ? `Bcc: ${bcc.join(', ')}` : '',
      params.replyTo ? `Reply-To: ${sanitizeHeader(params.replyTo)}` : '',
      `Subject: ${sanitizeHeader(params.subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      formatBase64(encodeBody(params.body)),
    ].filter(Boolean)

    for (const attachment of params.attachments ?? []) {
      lines.push(
        `--${boundary}`,
        `Content-Type: ${attachment.mimeType || 'application/octet-stream'}; name="${attachment.name}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${attachment.name}"`,
        '',
        formatBase64(attachment.dataBase64),
      )
    }

    lines.push(`--${boundary}--`)
    const raw = lines.join('\r\n')
    return btoa(unescape(encodeURIComponent(raw)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }

  const raw = params.attachments?.length
    ? buildMultipartMimeMessage()
    : buildMimeMessage(params)
  return gmailFetch<{ id: string; threadId: string }>('/messages/send', accessToken, {
    method: 'POST',
    body: JSON.stringify({ raw }),
  })
}

// ─── List threads ─────────────────────────────────────────────────────────────

interface RawThreadList {
  threads?: Array<{ id: string; snippet: string; historyId: string }>
  nextPageToken?: string
  historyId?: string
}

interface RawMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  payload: {
    headers: Array<{ name: string; value: string }>
    body?: { data?: string }
    parts?: Array<{
      mimeType: string
      filename?: string
      body?: { data?: string; attachmentId?: string; size?: number }
      parts?: Array<{
        mimeType: string
        filename?: string
        body?: { data?: string; attachmentId?: string; size?: number }
      }>
    }>
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

function extractAttachments(msg: RawMessage): GmailAttachment[] {
  const attachments: GmailAttachment[] = []

  const walkParts = (
    parts: Array<{
      mimeType: string
      filename?: string
      body?: { data?: string; attachmentId?: string; size?: number }
      parts?: Array<{
        mimeType: string
        filename?: string
        body?: { data?: string; attachmentId?: string; size?: number }
      }>
    }> = [],
  ) => {
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          attachmentId: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size ?? 0,
        })
      }
      if (part.parts?.length) walkParts(part.parts)
    }
  }

  walkParts(msg.payload.parts ?? [])
  return attachments
}

function parseMessage(raw: RawMessage): GmailMessage {
  const headers = raw.payload.headers
  const get = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
  return {
    id: raw.id,
    threadId: raw.threadId,
    from: get('From'),
    to: get('To'),
    cc: get('Cc') || undefined,
    bcc: get('Bcc') || undefined,
    replyTo: get('Reply-To') || undefined,
    subject: get('Subject'),
    snippet: raw.snippet,
    body: extractBody(raw),
    date: new Date(Number(raw.internalDate)).toISOString(),
    labelIds: raw.labelIds ?? [],
    attachments: extractAttachments(raw),
  }
}

export async function downloadGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<{ data: string }> {
  return gmailFetch<{ data: string }>(`/messages/${messageId}/attachments/${attachmentId}`, accessToken)
}

export async function listGmailThreads(
  accessToken: string,
  query = '',
  maxResults = 30,
  pageToken?: string,
): Promise<{ threads: GmailThread[]; nextPageToken: string | null; historyId: string | null }> {
  const params = new URLSearchParams({ maxResults: String(maxResults) })
  if (query) params.set('q', query)
  if (pageToken) params.set('pageToken', pageToken)

  const list = await gmailFetch<RawThreadList>(`/threads?${params}`, accessToken)
  if (!list.threads?.length) {
    return {
      threads: [],
      nextPageToken: list.nextPageToken ?? null,
      historyId: list.historyId ?? null,
    }
  }

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

  return {
    threads,
    nextPageToken: list.nextPageToken ?? null,
    historyId: list.historyId ?? null,
  }
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

export async function modifyGmailThreadLabels(
  accessToken: string,
  threadId: string,
  payload: { addLabelIds?: string[]; removeLabelIds?: string[] },
): Promise<void> {
  await gmailFetch(`/threads/${threadId}/modify`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      addLabelIds: payload.addLabelIds ?? [],
      removeLabelIds: payload.removeLabelIds ?? [],
    }),
  })
}

export async function trashGmailThread(
  accessToken: string,
  threadId: string,
): Promise<void> {
  await gmailFetch(`/threads/${threadId}/trash`, accessToken, {
    method: 'POST',
  })
}
