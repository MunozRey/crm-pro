---
phase: 07-gmail-integration
plan: 4
type: execute
wave: 3
depends_on:
  - "07-3"
files_modified:
  - src/pages/Inbox.tsx
  - src/store/emailStore.ts
autonomous: true
requirements:
  - GMAIL-04
  - GMAIL-06

must_haves:
  truths:
    - "Inbox page loads real Gmail threads when the user is connected (accessToken in context)"
    - "Clicking 'Connect Gmail' in Inbox initiates the PKCE redirect to Google (not a popup)"
    - "After inbox loads, threads from known contacts show a contact chip/badge with the contact's name"
    - "Clicking a contact chip navigates to /contacts/:id"
    - "Threads from unknown senders show no chip"
    - "A 401 from Gmail API triggers silent token refresh then retries the failed call"
  artifacts:
    - path: "src/pages/Inbox.tsx"
      provides: "Inbox wired to useGmailToken context; loads real threads; contact matching chips"
    - path: "src/store/emailStore.ts"
      provides: "loadThreads(accessToken, query) — updated signature from Plan 07-1; refreshAndRetry helper"
  key_links:
    - from: "src/pages/Inbox.tsx"
      to: "src/contexts/GmailTokenContext.tsx"
      via: "useGmailToken().accessToken"
      pattern: "useGmailToken"
    - from: "src/pages/Inbox.tsx"
      to: "src/store/emailStore.ts"
      via: "useEmailStore().loadThreads(accessToken)"
      pattern: "loadThreads"
    - from: "src/pages/Inbox.tsx"
      to: "src/store/contactsStore.ts"
      via: "useContactsStore().contacts email matching"
      pattern: "contacts.*email\|email.*contacts"
---

<objective>
Wire the Inbox page to use real Gmail data: replace `requestGmailAccess` calls with `initiateGmailOAuth`, consume the in-memory access token from GmailTokenContext, load real threads via the updated `loadThreads`, implement 401→refresh→retry, and show contact-linked chips on matching threads.

Purpose: The authentication plumbing is complete. This plan makes the Inbox functional — users see their real Gmail inbox and can identify which emails belong to CRM contacts.

Output:
- `src/pages/Inbox.tsx` — uses useGmailToken, calls initiateGmailOAuth, matches threads to contacts, shows chips
- `src/store/emailStore.ts` — `loadThreads` already updated in Plan 07-1; this plan ensures 401 retry path works
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-gmail-integration/07-CONTEXT.md
@.planning/phases/07-gmail-integration/07-1-SUMMARY.md
@.planning/phases/07-gmail-integration/07-3-SUMMARY.md

<interfaces>
<!-- GmailTokenContext API: -->
```typescript
const { accessToken, setGmailToken, clearGmailToken, isTokenValid } = useGmailToken()
```

<!-- emailStore.loadThreads — new signature (updated in Plan 07-1): -->
```typescript
loadThreads: (accessToken: string, query?: string) => Promise<void>
// throws on error → caught in Inbox
```

<!-- gmailService.ts — PKCE initiation (from Plan 07-1): -->
```typescript
import { initiateGmailOAuth } from '../services/gmailService'
// Usage: await initiateGmailOAuth(import.meta.env.VITE_GOOGLE_CLIENT_ID)
```

<!-- contactsStore: -->
```typescript
const contacts = useContactsStore((s) => s.contacts)
// contacts[n].email: string — match against thread from address
```

<!-- supabase.functions.invoke for refresh: -->
```typescript
const { data, error } = await supabase.functions.invoke('gmail-refresh-token')
// data: { access_token, expires_in, email_address }
```

<!-- GmailThread shape (from src/types): -->
```typescript
interface GmailThread {
  id: string
  snippet: string
  historyId: string
  messages: GmailMessage[]
}
interface GmailMessage {
  id: string; threadId: string; from: string; to: string; subject: string
  snippet: string; body: string; date: string; labelIds: string[]
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor Inbox.tsx to use PKCE flow, real thread loading, and contact chips</name>
  <files>src/pages/Inbox.tsx</files>
  <read_first>
    - src/pages/Inbox.tsx (read the full file — understand all current state, imports, and rendering logic before modifying)
    - src/contexts/GmailTokenContext.tsx (useGmailToken hook — created Plan 07-1)
    - src/store/emailStore.ts (loadThreads new signature — updated Plan 07-1)
    - src/store/contactsStore.ts (contacts array with email field)
    - src/services/gmailService.ts (initiateGmailOAuth — created Plan 07-1)
    - src/lib/supabase.ts (supabase.functions.invoke for refresh retry)
  </read_first>
  <action>
Refactor `src/pages/Inbox.tsx` with these specific changes. Do NOT rebuild the file from scratch — make surgical changes to the existing code.

**1. Update imports:**
- Remove: `import { requestGmailAccess } from '../services/gmailService'`
- Add: `import { initiateGmailOAuth } from '../services/gmailService'`
- Add: `import { useGmailToken } from '../contexts/GmailTokenContext'`
- Add: `import { Link } from 'react-router-dom'` (if not already imported)
- Add: `import { useContactsStore } from '../store/contactsStore'`
- Add: `import { supabase } from '../lib/supabase'`

**2. Inside the `Inbox` component function, add:**
```typescript
const { accessToken, setGmailToken, clearGmailToken, isTokenValid } = useGmailToken()
const contacts = useContactsStore((s) => s.contacts)
```

**3. Replace the Gmail connection check:**
Old: `isGmailConnected()` from emailStore
New: Use `isTokenValid()` from GmailTokenContext AND `gmailAddress` from emailStore together:
```typescript
const gmailAddress = useEmailStore((s) => s.gmailAddress)
const isConnected = !!gmailAddress && isTokenValid()
```

**4. Replace "Connect Gmail" button handler:**
Old: called `requestGmailAccess(clientId, onSuccess, onError)`
New:
```typescript
const handleConnectGmail = async () => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    toast.error('Google Client ID not configured')
    return
  }
  await initiateGmailOAuth(clientId)
  // browser redirects — nothing after this runs
}
```

**5. Add 401 refresh+retry helper** (inside the component or as a module-level async function):
```typescript
async function refreshAndRetry<T>(
  fn: (token: string) => Promise<T>,
  accessToken: string,
  onNewToken: (token: string, expiresAt: number) => void,
): Promise<T> {
  try {
    return await fn(accessToken)
  } catch (err) {
    if (err instanceof Error && err.message.includes('401')) {
      const { data, error } = await supabase.functions.invoke('gmail-refresh-token')
      if (error || !data?.access_token) throw new Error('Token refresh failed — please reconnect Gmail')
      const newExpiry = Date.now() + (data.expires_in ?? 3600) * 1000
      onNewToken(data.access_token, newExpiry)
      return await fn(data.access_token)
    }
    throw err
  }
}
```

**6. Update thread loading call:**
Old: `emailStore.loadThreads(query)` (reads token from store)
New: call the store's `loadThreads(accessToken, query)` wrapping with refresh+retry:
```typescript
const handleLoadThreads = async (query = '') => {
  if (!accessToken) return
  try {
    await refreshAndRetry(
      (token) => useEmailStore.getState().loadThreads(token, query),
      accessToken,
      setGmailToken,
    )
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Error loading threads')
  }
}
```

**7. Add contact matching after threads load:**
After threads are fetched and in state, build a map of email address → contact:
```typescript
// Build contact email lookup map
const contactByEmail = useMemo(() => {
  const map = new Map<string, { id: string; name: string }>()
  for (const c of contacts) {
    if (c.email) map.set(c.email.toLowerCase(), { id: c.id, name: `${c.firstName} ${c.lastName}`.trim() })
  }
  return map
}, [contacts])

// Extract sender email from "Name <email@example.com>" or "email@example.com"
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return (match ? match[1] : from).toLowerCase().trim()
}
```

**8. In ThreadItem rendering** (or wherever threads are listed), add a contact chip below the subject line for matched threads:
```tsx
const lastMsg = thread.messages[thread.messages.length - 1]
const senderEmail = extractEmail(lastMsg?.from ?? '')
const matchedContact = contactByEmail.get(senderEmail)

// In JSX for each thread item, after the snippet:
{matchedContact && (
  <Link
    to={`/contacts/${matchedContact.id}`}
    onClick={(e) => e.stopPropagation()}
    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-300 border border-brand-500/30 hover:bg-brand-600/30 transition-colors mt-1"
  >
    <User size={9} />
    {matchedContact.name}
  </Link>
)}
```

Pass `contactByEmail` and `extractEmail` into `ThreadItem` as props, or define the lookup inside `ThreadItem` directly (either approach is fine).

**9. Disconnect Gmail** — update `disconnectGmail` button handler to also call `clearGmailToken()` from context before calling `emailStore.disconnectGmail()`.
  </action>
  <verify>
    <automated>grep -n "useGmailToken\|initiateGmailOAuth\|refreshAndRetry\|contactByEmail\|extractEmail\|brand-600/20.*User\|View Contact\|loadThreads" /c/Users/david/OneDrive/Escritorio/Development/CRM/src/pages/Inbox.tsx | head -30</automated>
  </verify>
  <acceptance_criteria>
    - `grep "requestGmailAccess" src/pages/Inbox.tsx` returns NO match (old flow removed)
    - `grep "initiateGmailOAuth" src/pages/Inbox.tsx` returns a match
    - `grep "useGmailToken" src/pages/Inbox.tsx` returns a match
    - `grep "refreshAndRetry\|gmail-refresh-token" src/pages/Inbox.tsx` returns a match (401 retry path)
    - `grep "contactByEmail\|extractEmail" src/pages/Inbox.tsx` returns a match (contact matching)
    - `grep "contacts/:id" src/pages/Inbox.tsx` returns a match (View Contact link)
    - `grep "loadThreads.*accessToken\|accessToken.*loadThreads" src/pages/Inbox.tsx` returns a match (token passed to store)
    - `npx tsc --noEmit 2>&1 | grep "Inbox.tsx"` returns no errors
  </acceptance_criteria>
  <done>Inbox loads real Gmail threads using the in-memory access token. 401 responses trigger silent refresh+retry. Threads from known contacts show a chip linking to the contact detail page.</done>
</task>

</tasks>

<verification>
After completion:

1. `grep "requestGmailAccess" src/pages/Inbox.tsx` — no output
2. `grep "initiateGmailOAuth" src/pages/Inbox.tsx` — has output
3. `grep "useGmailToken" src/pages/Inbox.tsx` — has output
4. `grep "contacts/:id" src/pages/Inbox.tsx` — has output
5. `npx tsc --noEmit` — exits 0

Manual verification (requires real Google credentials):
- Connect Gmail via Settings or Inbox → click Connect Gmail → Google consent screen opens
- After consent, /inbox loads real threads
- Thread from a contact's email address shows the contact's name chip
</verification>

<success_criteria>
- Inbox.tsx no longer references requestGmailAccess or initTokenClient
- Connect Gmail button redirects to Google via PKCE flow (window.location.href redirect, not popup)
- Real Gmail threads load using in-memory access token from GmailTokenContext
- 401 from Gmail API triggers silent refresh then retries the original load
- Contact chips appear on threads where sender email matches a CRM contact
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/phases/07-gmail-integration/07-4-SUMMARY.md`
</output>
