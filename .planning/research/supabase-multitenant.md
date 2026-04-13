# Supabase Multi-Tenant SaaS Architecture Research
# CRM Pro — React 18 + TypeScript + Vite + Zustand + Supabase

**Researched:** 2026-03-31
**Scope:** Migration from localStorage/Zustand persist to Supabase with full multi-tenancy
**Confidence:** HIGH (Supabase JS SDK v2.x, Zustand v5, React 18 — all well within knowledge)

---

## Project Baseline (What Already Exists)

Before recommendations, the codebase state matters:

- `schema.sql` has contacts, companies, deals, activities, notifications — **no `organization_id` column on any table**
- Current RLS policies use `auth.role() = 'authenticated'` — tenant-blind, every authenticated user sees all data
- `authStore.ts` has a dual-mode architecture: localStorage simulation + a stub `initSupabaseAuth()` that maps Supabase users to the CRM user shape but does not fetch org membership from the DB
- `aiStore.ts` persists `apiKey` (Anthropic) and `openRouterKey` in localStorage — **security risk**
- `aiService.ts` calls `new Anthropic({ dangerouslyAllowBrowser: true })` — API key exposed to browser
- `gmailService.ts` uses implicit flow via Google Identity Services — access tokens stored in Zustand persist (localStorage)
- All domain stores (contacts, deals, companies, activities, notifications) use `persist` middleware with `LS_KEYS` constants, all have `// TODO: Replace localStorage persistence with Supabase client calls`

---

## 1. Multi-Tenant RLS: organization_id Pattern vs Schema-Per-Tenant

### Decision: organization_id column pattern

**Recommendation: shared schema, `organization_id` foreign key on every tenant-scoped table.**

Schema-per-tenant (one Postgres schema per org) is not viable on Supabase because:
- Supabase manages the `public` schema; schema isolation requires a self-hosted instance and custom PostgREST config
- Dynamic schema switching from the client SDK is not supported
- Connection pooling via pgBouncer (Supabase default) does not support `SET search_path` per request in transaction mode

The `organization_id` column pattern is the documented Supabase approach and scales to millions of rows with proper indexing.

### Required Schema Changes

Every tenant-scoped table needs:
```sql
organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE
```

Tables requiring the column: `contacts`, `companies`, `deals`, `activities`, `notifications`.

Tables that are user-scoped (not org-scoped): none — all CRM data belongs to an org.

New tables required:
```sql
-- Organizations
CREATE TABLE public.organizations (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  name        text NOT NULL,
  domain      text,
  logo_url    text,
  plan        text NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'enterprise'
  max_users   integer NOT NULL DEFAULT 5,
  settings    jsonb NOT NULL DEFAULT '{}'
);

-- Organization members (join table: auth.users <-> organizations)
CREATE TABLE public.organization_members (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'sales_rep',  -- 'admin' | 'manager' | 'sales_rep' | 'viewer'
  job_title       text,
  phone           text,
  avatar_url      text,
  is_active       boolean NOT NULL DEFAULT true,
  invited_by      uuid REFERENCES auth.users(id),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Invitations
CREATE TABLE public.invitations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'sales_rep',
  token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      uuid NOT NULL REFERENCES auth.users(id),
  status          text NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted' | 'expired'
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### The JWT Claim Approach for RLS Performance

Fetching `organization_id` via a JOIN on every RLS check is expensive. The correct pattern is to embed the `organization_id` into the Supabase JWT so RLS policies can read it from `auth.jwt()` — a single O(1) operation per query rather than a subquery.

**Step 1: PostgreSQL function to set the claim**
```sql
-- Uses pgaudit / supabase_functions extension
CREATE OR REPLACE FUNCTION public.set_claim(uid uuid, claim text, value jsonb)
RETURNS text AS $$
  UPDATE auth.users
  SET raw_app_meta_data =
    raw_app_meta_data ||
    json_build_object(claim, value)::jsonb
  WHERE id = uid
  RETURNING raw_app_meta_data::text;
$$ LANGUAGE sql SECURITY DEFINER;
```

**Step 2: Trigger to populate claim on member insert**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.set_claim(
    NEW.user_id,
    'organization_id',
    to_jsonb(NEW.organization_id)
  );
  PERFORM public.set_claim(
    NEW.user_id,
    'user_role',
    to_jsonb(NEW.role)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_member_created
  AFTER INSERT OR UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_member();
```

**Step 3: RLS policies reading from JWT**
```sql
-- Helper functions (define once, use everywhere)
CREATE OR REPLACE FUNCTION public.get_org_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid,
    NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'user_role',
    'viewer'
  );
$$;

-- Example: contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_read_contacts" ON public.contacts
  FOR SELECT USING (organization_id = public.get_org_id());

CREATE POLICY "org_members_can_insert_contacts" ON public.contacts
  FOR INSERT WITH CHECK (organization_id = public.get_org_id());

CREATE POLICY "org_members_can_update_contacts" ON public.contacts
  FOR UPDATE USING (organization_id = public.get_org_id());

-- Delete: admin or manager only (role from JWT)
CREATE POLICY "managers_can_delete_contacts" ON public.contacts
  FOR DELETE USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'manager')
  );
```

Repeat the same four policies for `companies`, `deals`, `activities`. The `notifications` table uses user-scoped policy (already in schema.sql, keep it).

### Required Indexes

Every `organization_id` column needs a B-tree index — RLS filters run before LIMIT so a missing index causes full table scans:
```sql
CREATE INDEX idx_contacts_org_id ON public.contacts(organization_id);
CREATE INDEX idx_companies_org_id ON public.companies(organization_id);
CREATE INDEX idx_deals_org_id ON public.deals(organization_id);
CREATE INDEX idx_activities_org_id ON public.activities(organization_id);
CREATE INDEX idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org_id ON public.organization_members(organization_id);
```

### JWT Refresh Caveat

After `set_claim` changes (e.g., role upgrade), the user's current JWT is stale until the next token refresh. The access token TTL on Supabase is 1 hour by default. For immediate role propagation, call `supabase.auth.refreshSession()` after an admin changes a member's role. Alternatively, use a DB-read fallback in critical admin-only policies rather than relying solely on the JWT claim.

---

## 2. Migrating Zustand Persist Stores to Supabase Async Stores

### Core Migration Pattern

Every store currently follows: `persist(set/get => ({ ... }), { name: LS_KEYS.x })`.

The migration moves to: no persist middleware on domain stores + explicit `fetchX` actions that call Supabase. The `persist` middleware stays only for UI preferences (filters, viewMode, selectedId) and auth session — not data.

**Recommended store shape after migration:**

```typescript
// contacts store — representative example
interface ContactsState {
  contacts: Contact[]
  filters: ContactFilters
  selectedId: string | null
  isLoading: boolean
  isInitialized: boolean  // NEW: prevents double-fetch
  error: string | null    // NEW

  // Data actions (async, call Supabase)
  fetchContacts: () => Promise<void>
  addContact: (contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Contact>
  updateContact: (id: string, updates: Partial<Contact>) => Promise<void>
  deleteContact: (id: string) => Promise<void>

  // UI actions (sync, local only)
  setFilter: (key: keyof ContactFilters, value: string | string[]) => void
  clearFilters: () => void
  setSelectedId: (id: string | null) => void

  // Selectors (pure, no Supabase)
  getById: (id: string) => Contact | undefined
  getFilteredContacts: () => Contact[]
}
```

### Optimistic Update Pattern

Do not wait for Supabase to confirm before updating UI. Users notice 200–400ms latency on writes:

```typescript
addContact: async (contactData) => {
  const tempId = uuidv4()
  const now = new Date().toISOString()
  const optimistic: Contact = { ...contactData, id: tempId, createdAt: now, updatedAt: now }

  // 1. Apply optimistically
  set(state => ({ contacts: [optimistic, ...state.contacts] }))

  try {
    const { data, error } = await supabase!
      .from('contacts')
      .insert({
        first_name: contactData.firstName,
        last_name: contactData.lastName,
        email: contactData.email,
        organization_id: getOrgId(),   // from authStore
        created_by: getUserId(),
        // ... map all fields
      })
      .select()
      .single()

    if (error) throw error

    // 2. Replace temp record with real server record (has real id, created_at)
    set(state => ({
      contacts: state.contacts.map(c => c.id === tempId ? mapDbContact(data) : c)
    }))
    return mapDbContact(data)
  } catch (err) {
    // 3. Rollback on failure
    set(state => ({ contacts: state.contacts.filter(c => c.id !== tempId) }))
    useToastStore.getState().error('Error al crear contacto')
    throw err
  }
},
```

### Loading State Pattern

The `isInitialized` flag prevents double-fetch when components remount or StrictMode double-invokes effects:

```typescript
fetchContacts: async () => {
  if (get().isInitialized || get().isLoading) return
  set({ isLoading: true, error: null })
  try {
    const { data, error } = await supabase!
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    set({ contacts: data.map(mapDbContact), isInitialized: true })
  } catch (err) {
    set({ error: (err as Error).message })
  } finally {
    set({ isLoading: false })
  }
},
```

Call `fetchContacts()` once in a top-level component effect or in a dedicated data provider, not inside individual page components. A `<DataProvider>` pattern works well:

```typescript
// src/providers/DataProvider.tsx
export function DataProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated())
  const fetchContacts = useContactsStore(s => s.fetchContacts)
  const fetchDeals = useDealsStore(s => s.fetchDeals)
  // ... etc

  useEffect(() => {
    if (!isAuthenticated) return
    fetchContacts()
    fetchDeals()
    fetchCompanies()
    fetchActivities()
  }, [isAuthenticated])

  return <>{children}</>
}
```

### Field Name Mapping (snake_case DB vs camelCase TS)

The DB uses `first_name`, the TS type uses `firstName`. Create explicit mapper functions and keep them in a `src/lib/mappers.ts` file:

```typescript
export function mapDbContact(row: Database['public']['Tables']['contacts']['Row']): Contact {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email ?? '',
    phone: row.phone ?? '',
    jobTitle: row.job_title ?? '',
    companyId: row.company_id ?? undefined,
    status: row.status as ContactStatus,
    source: row.source as ContactSource,
    score: row.score,
    tags: row.tags,
    notes: row.notes ?? '',
    assignedTo: row.assigned_to ?? undefined,
    createdBy: row.created_by ?? undefined,
    lastContactedAt: row.last_contacted_at ?? undefined,
    customFields: row.custom_fields as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function contactToInsert(
  c: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>,
  orgId: string,
  userId: string
): Database['public']['Tables']['contacts']['Insert'] {
  return {
    id: uuidv4(),
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email || null,
    phone: c.phone || null,
    job_title: c.jobTitle || null,
    company_id: c.companyId ?? null,
    status: c.status,
    source: c.source,
    score: c.score,
    tags: c.tags,
    notes: c.notes || null,
    assigned_to: c.assignedTo ?? null,
    created_by: userId,
    organization_id: orgId,
    custom_fields: c.customFields ?? {},
  }
}
```

### Persist Strategy After Migration

| Store | Keep persist? | What to persist |
|-------|--------------|-----------------|
| `authStore` | YES | session, currentUser, organization (hydrate on reload) |
| `contactsStore` | Partial | filters, selectedId, viewMode only — not `contacts[]` |
| `dealsStore` | Partial | filters, selectedId, viewMode |
| `companiesStore` | Partial | filters, selectedId |
| `activitiesStore` | Partial | filters, selectedId |
| `notificationsStore` | NO | fetch from DB, realtime subscription |
| `settingsStore` | YES | org settings are user preferences, can stay local until a settings table is added |
| `aiStore` | YES (partial) | selectedModel, openRouterKey — but NOT apiKey (move to Edge Function) |
| `auditStore` | NO | fetch from DB |
| `toastStore` | NO | ephemeral by nature |

---

## 3. Supabase Auth Integration with React — Session Management

### The Correct `onAuthStateChange` Pattern

The current `initSupabaseAuth()` in `authStore.ts` has the right skeleton but two gaps:

1. It does not fetch the user's `organization_members` row after sign-in, so `organization` and `role` are derived from `user_metadata` (which is admin-only writeable) rather than the DB
2. The listener is set up without capturing the return value, so the subscription leaks if `initSupabaseAuth` is called more than once

Correct implementation:

```typescript
// src/lib/auth.ts  (separate from the store)
let authListenerSubscription: { unsubscribe: () => void } | null = null

export async function initSupabaseAuth() {
  if (!isSupabaseConfigured || !supabase) return

  // Clean up any previous listener
  authListenerSubscription?.unsubscribe()

  useAuthStore.getState().setIsLoadingAuth(true)

  // 1. Get initial session
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    await syncUserFromSession(session)
  }
  useAuthStore.getState().setIsLoadingAuth(false)

  // 2. Subscribe to future changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      useAuthStore.getState().setSupabaseSession(session)
      if (session) {
        await syncUserFromSession(session)
      } else {
        useAuthStore.getState().setCurrentUser(null)
        useAuthStore.getState().setOrganization(null)
        // Clear all domain store caches
        useContactsStore.getState().reset()
        useDealsStore.getState().reset()
      }
    }
  )
  authListenerSubscription = subscription
}

async function syncUserFromSession(session: Session) {
  const sbUser = session.user

  // Fetch membership from DB (authoritative for role/org)
  const { data: member } = await supabase!
    .from('organization_members')
    .select('*, organizations(*)')
    .eq('user_id', sbUser.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!member) {
    // New user with no org yet — send to onboarding
    useAuthStore.getState().setCurrentUser({
      id: sbUser.id,
      email: sbUser.email ?? '',
      name: sbUser.user_metadata?.full_name ?? sbUser.email?.split('@')[0] ?? 'User',
      role: 'admin',
      jobTitle: '',
      organizationId: '',
      isActive: true,
      createdAt: sbUser.created_at,
      updatedAt: sbUser.created_at,
    })
    return
  }

  useAuthStore.getState().setCurrentUser({
    id: sbUser.id,
    email: sbUser.email ?? '',
    name: sbUser.user_metadata?.full_name ?? member.job_title ?? 'User',
    role: member.role as UserRole,
    jobTitle: member.job_title ?? '',
    phone: member.phone ?? undefined,
    avatar: member.avatar_url ?? undefined,
    organizationId: member.organization_id,
    isActive: member.is_active,
    createdAt: sbUser.created_at,
    updatedAt: member.created_at,
  })

  useAuthStore.getState().setOrganization({
    id: member.organizations.id,
    name: member.organizations.name,
    domain: member.organizations.domain ?? undefined,
    plan: member.organizations.plan as 'free' | 'pro' | 'enterprise',
    maxUsers: member.organizations.max_users,
    createdAt: member.organizations.created_at,
  })
}
```

### Protected Routes with Loading State

The current `ProtectedRoute` checks `isAuthenticated()` synchronously which can flash the login redirect before Supabase resolves the session from storage. Add loading gate:

```typescript
export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const isLoadingAuth = useAuthStore(s => s.isLoadingAuth)
  const isAuthenticated = useAuthStore(s => s.isAuthenticated())
  const currentUser = useAuthStore(s => s.currentUser)

  if (isLoadingAuth) {
    return <AppLoadingScreen />  // Full-screen spinner
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredPermission && currentUser && !hasPermission(currentUser.role, requiredPermission)) {
    return <AccessDenied />
  }

  return <>{children}</>
}
```

`isLoadingAuth` must be set `true` at app boot before `getSession()` resolves. Currently `initSupabaseAuth()` sets it but only _after_ being called from `App.tsx` `useEffect` — there is a render cycle where it is `false`. Fix: initialize the store with `isLoadingAuth: isSupabaseConfigured` (true only when Supabase is configured) so the app shows loading on first paint.

### Login / Register Flow

Replace the localStorage `login()` and `register()` actions with:

```typescript
// Login
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
// onAuthStateChange fires automatically, no manual set needed

// Register (creates org + member in a single transaction via DB function)
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { full_name: name }  // stored in user_metadata
  }
})
// After sign-up, call a DB function or Edge Function to create org + member row

// Logout
await supabase.auth.signOut()
// onAuthStateChange fires with null session
```

### Email Confirmation

Supabase requires email confirmation by default. For a B2B SaaS demo you can disable it in the Supabase dashboard (Auth > Settings > "Enable email confirmations" off). For production, handle the `EMAIL_CONFIRMED` and `TOKEN_REFRESHED` events in `onAuthStateChange`.

---

## 4. Supabase Realtime Subscriptions with Zustand

### Wiring postgres_changes to Store Updates

Realtime subscriptions should be opened after the user is authenticated and the initial data fetch is complete. Open them in the `DataProvider` (or a dedicated `RealtimeProvider`).

```typescript
// src/providers/RealtimeProvider.tsx
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useContactsStore } from '../store/contactsStore'
import { useDealsStore } from '../store/dealsStore'
import { mapDbContact, mapDbDeal } from '../lib/mappers'

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const orgId = useAuthStore(s => s.organization?.id)

  useEffect(() => {
    if (!orgId || !supabase) return

    const channel = supabase
      .channel(`org:${orgId}`)

      // Contacts
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts', filter: `organization_id=eq.${orgId}` },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload
          const store = useContactsStore.getState()
          if (eventType === 'INSERT') {
            store.upsertContact(mapDbContact(newRow as any))
          } else if (eventType === 'UPDATE') {
            store.upsertContact(mapDbContact(newRow as any))
          } else if (eventType === 'DELETE') {
            store.removeContact((oldRow as any).id)
          }
        }
      )

      // Deals
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deals', filter: `organization_id=eq.${orgId}` },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload
          const store = useDealsStore.getState()
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            store.upsertDeal(mapDbDeal(newRow as any))
          } else if (eventType === 'DELETE') {
            store.removeDeal((oldRow as any).id)
          }
        }
      )

      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId])

  return <>{children}</>
}
```

Required store additions (`upsertContact`, `removeContact`, `upsertDeal`, `removeDeal`):

```typescript
// In contactsStore — these replace an existing record by id or append if new
upsertContact: (contact: Contact) => {
  set(state => ({
    contacts: state.contacts.some(c => c.id === contact.id)
      ? state.contacts.map(c => c.id === contact.id ? contact : c)
      : [contact, ...state.contacts]
  }))
},
removeContact: (id: string) => {
  set(state => ({ contacts: state.contacts.filter(c => c.id !== id) }))
},
```

### Realtime Conflict: Optimistic Updates vs Incoming Changes

When user A updates a contact and the realtime event arrives back at user A's own session, it creates a double-update. Solution: compare `updated_at` timestamps and skip the realtime update if the local record is newer or equal:

```typescript
upsertContact: (incoming: Contact) => {
  set(state => ({
    contacts: state.contacts.map(c => {
      if (c.id !== incoming.id) return c
      // Skip if local is newer (optimistic update already applied)
      if (c.updatedAt >= incoming.updatedAt) return c
      return incoming
    })
  }))
},
```

### Realtime for Notifications

The `notifications` table is per-user, so filter by `user_id`:

```typescript
.on(
  'postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
  (payload) => {
    const notification = mapDbNotification(payload.new as any)
    useNotificationsStore.getState().addNotification(notification)
    // Also trigger browser notification if tab is not focused
  }
)
```

### Channel Multiplexing

Put all subscriptions on a single named channel (as above) rather than one channel per table. Supabase counts channels against connection limits. One channel with multiple `.on()` listeners is the correct pattern.

### Realtime Caveats

- `postgres_changes` only fires for rows the authenticated user can SELECT (RLS-checked). If the INSERT was done by another user and the RLS SELECT policy passes, the event is delivered.
- Realtime does not deliver the full row for DELETE events — `old` contains only the primary key unless `REPLICA IDENTITY FULL` is set on the table. Add `ALTER TABLE public.contacts REPLICA IDENTITY FULL;` if you need full old-row data on deletes.
- Free tier Supabase has 2 concurrent realtime connections. Pro tier: 500. This is per Supabase project, not per user.

---

## 5. Edge Functions for Sensitive Operations

### Why Edge Functions Are Required Here

`aiService.ts` currently calls `new Anthropic({ dangerouslyAllowBrowser: true })` and reads `apiKey` from `aiStore` (persisted in localStorage). This means:
1. The Anthropic API key is visible in browser devtools network tab
2. Any user can exfiltrate the key from localStorage
3. The key cannot be rotated without redeploying the app

Edge Functions solve this by moving the key server-side where it is injected as an environment variable.

### Anthropic Proxy Edge Function

```typescript
// supabase/functions/ai-proxy/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const OPENROUTER_KEY = Deno.env.get('OPENROUTER_API_KEY')!

serve(async (req) => {
  // 1. Verify caller is an authenticated Supabase user
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return new Response('Unauthorized', { status: 401 })

  // 2. Rate limit check (optional but recommended)
  // Query a rate_limits table or use a KV store

  // 3. Forward request to Anthropic
  const body = await req.json() as {
    model: string
    messages: unknown[]
    max_tokens: number
    system?: string
    stream?: boolean
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  // Pass streaming response through
  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
    },
  })
})
```

Client-side call replaces the direct Anthropic SDK usage:
```typescript
const response = await supabase.functions.invoke('ai-proxy', {
  body: { model, messages, max_tokens: 1024, system: systemPrompt }
})
```

For streaming, use `fetch` directly with the Supabase function URL and the user's JWT — `supabase.functions.invoke` does not support streaming responses as of v2. Use:
```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ model, messages, max_tokens: 2048, system: systemPrompt, stream: true }),
})
// Then read response.body as a ReadableStream
```

### Gmail OAuth Token Exchange Edge Function

The current `gmailService.ts` uses the implicit flow (Google Identity Services token client) which returns short-lived access tokens (1 hour) that cannot be refreshed without user interaction. For a real inbox integration you need the authorization code flow + refresh token, which requires a backend to keep `client_secret` secure.

```typescript
// supabase/functions/gmail-oauth/index.ts
serve(async (req) => {
  const { code, redirect_uri } = await req.json()

  // Exchange auth code for tokens (server-side, client_secret never leaves server)
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      redirect_uri,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenResponse.json()

  // Store encrypted refresh_token in DB, return access_token to client
  // Never return refresh_token to client
  const encryptedRefresh = await encrypt(tokens.refresh_token) // use SubtleCrypto
  await supabase.from('user_gmail_tokens').upsert({
    user_id: authenticatedUser.id,
    refresh_token_encrypted: encryptedRefresh,
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  })

  return Response.json({ access_token: tokens.access_token, expires_in: tokens.expires_in })
})
```

**Note:** For the CRM Pro demo/MVP, the existing implicit flow (GIS token client) is acceptable as it avoids needing a backend secret. The Edge Function approach is the production-grade path when you need offline access or long-lived tokens.

### Edge Function Deployment

```bash
supabase functions deploy ai-proxy --no-verify-jwt  # false: JWT check done inside function
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OPENROUTER_API_KEY=sk-or-...
```

---

## 6. Pitfalls When Migrating from localStorage to Supabase

### Pitfall 1: Race between session restore and data fetch

**What goes wrong:** `App.tsx` calls `initSupabaseAuth()` in a `useEffect`. React renders children before the effect fires. `ProtectedRoute` reads `isAuthenticated()` which checks `session` in the store. On a refresh, `session` is in localStorage (persisted) so `isAuthenticated()` returns `true`, the protected page renders, its `useEffect` calls `fetchContacts()`, but the Supabase client has not restored its session yet — the query returns an empty result set or a 401.

**Prevention:** The `isLoadingAuth` flag must be set `true` before any data queries run. Initialize it as `true` in the store default state when `isSupabaseConfigured` is true:
```typescript
isLoadingAuth: isSupabaseConfigured,  // not false
```
Block data fetches in `DataProvider` behind `!isLoadingAuth`. Unblock after `initSupabaseAuth()` completes.

### Pitfall 2: Stale organization_id in JWT causes empty query results

**What goes wrong:** User creates a new org. JWT claim `organization_id` is set via trigger. User's current JWT was minted before the trigger ran (e.g., they were on the signup form). All subsequent queries filter by an empty or wrong `organization_id` and return zero rows.

**Prevention:** After creating the organization and member rows, force a session refresh:
```typescript
await supabase.auth.refreshSession()
// Now the new JWT includes organization_id claim
```
This must happen before the first data fetch in the onboarding flow.

### Pitfall 3: Missing organization_id on INSERT — violates NOT NULL constraint

**What goes wrong:** Migrated store actions call `supabase.from('contacts').insert(...)` but the developer forgets to include `organization_id` in the payload. DB rejects with a 400 error. Optimistic update already applied, so UI shows the record but it does not exist in DB.

**Prevention:** The `contactToInsert` mapper function (see Section 2) must always receive and include `orgId`. Add a runtime assertion:
```typescript
function getOrgId(): string {
  const id = useAuthStore.getState().organization?.id
  if (!id) throw new Error('No organization context — cannot write to DB')
  return id
}
```

### Pitfall 4: Zustand persist rehydration collides with Supabase fetch

**What goes wrong:** `contactsStore` persists `contacts[]` to localStorage. On reload, Zustand rehydrates instantly with stale cached data. A moment later, `fetchContacts()` runs and replaces the array. If the user interacts in the 200ms window they see stale data. Worse: if the fetch fails, stale data silently persists as if it's current.

**Prevention:** Remove `contacts`, `deals`, `companies`, `activities` arrays from the persist list entirely (use `partialize`). Only persist filter state and UI preferences. Display a loading skeleton until `isInitialized: true`.

### Pitfall 5: Realtime double-apply with optimistic updates

**What goes wrong:** User updates a deal. Optimistic update immediately shows new value in UI. 150ms later, Supabase realtime fires with the same record. The `upsertDeal` handler overwrites the local state — but since the server echoes the record back, this is harmless unless the server applied additional transformations (e.g., auto-computed fields). The real risk is that the realtime payload arrives _before_ the `insert().select()` returns, causing the optimistic record to be overwritten by a partial DB record.

**Prevention:** Use the `updated_at` comparison guard in `upsertContact/upsertDeal` (shown in Section 4). The optimistic record has a client-side `updated_at` timestamp that will be equal to or slightly newer than the DB's `now()` — server wins on tie, which is correct behavior.

### Pitfall 6: Passwords stored in localStorage

**What goes wrong:** `authStore.ts` stores `passwords: Record<string, string>` (hashed with a trivially reversible custom hash function) in localStorage under the key `crm_auth`. Any script running on the page can read this. XSS = immediate credential compromise.

**Prevention:** After Supabase Auth migration, delete the `passwords` field and the `simpleHash` function entirely. Supabase Auth handles password hashing (bcrypt) server-side. The custom `login()` action is replaced by `supabase.auth.signInWithPassword()`. The `users` array in the store is replaced by the `organization_members` table.

### Pitfall 7: aiStore persists API keys in localStorage

**What goes wrong:** `aiStore` persists `apiKey` (Anthropic) and `openRouterKey` to localStorage. These are production API keys billed per token. Any browser extension, third-party script, or XSS can steal them.

**Prevention:** Move Anthropic key to Edge Function env variable (never in client). OpenRouter key is less critical (user-provided) but should still not persist — read it from a session-scoped input or from a Supabase `user_settings` table row, not `persist`.

### Pitfall 8: Seed data initialization conflicts with Supabase data

**What goes wrong:** `onRehydrateStorage` in contacts/deals stores checks `if (state && state.contacts.length === 0)` and seeds demo data. After Supabase migration, the store starts empty (no persist) and this condition triggers — it fills the store with hardcoded seed contacts that do not exist in the DB. Any subsequent Supabase fetch overwrites them, but if the fetch fails, the UI shows phantom records.

**Prevention:** Remove the `onRehydrateStorage` seed logic entirely when migrating to Supabase. Provide a separate "Seed demo data" admin action that inserts to the DB if the org has zero records.

### Pitfall 9: onAuthStateChange subscription leaking on hot-reload (development)

**What goes wrong:** Vite HMR triggers `useEffect` cleanup and re-execution. `initSupabaseAuth()` is called again but the old `onAuthStateChange` listener is still active. The store gets `setCurrentUser` called twice on every auth event.

**Prevention:** Store the subscription reference and `unsubscribe()` it before re-subscribing (shown in Section 3). In `App.tsx`, the `useEffect` cleanup should call `subscription.unsubscribe()`.

### Pitfall 10: RLS policies block service-role operations

**What goes wrong:** When writing Edge Functions that perform cross-org admin operations (e.g., billing webhook updating org plan), using the anon key with RLS will block the write. Edge Functions should use the `service_role` key for privileged operations — but only for operations explicitly requiring superuser DB access.

**Prevention:** `createClient(url, SERVICE_ROLE_KEY)` only in Edge Functions that need it. Never expose the service role key to the browser or to functions callable directly by users.

---

## 7. Organization Invitation Flow Patterns

### Full Invitation Flow (Supabase Native)

Supabase Auth provides `supabase.auth.admin.inviteUserByEmail()` which sends a magic-link email. This is available only from the service role (Edge Function), not from the browser client.

**Recommended flow for CRM Pro:**

```
Admin clicks "Invite"
    → Frontend calls Edge Function invite-user
    → Edge Function verifies caller is org admin
    → Inserts row in public.invitations (email, role, token, org_id)
    → Calls supabase.auth.admin.inviteUserByEmail(email, { data: { org_id, role, token } })
    → Supabase sends email with magic link
    → Invitee clicks link → lands on /accept-invite?token=xxx
    → Frontend reads token, calls Edge Function accept-invitation
    → Edge Function looks up invitation by token, validates not expired
    → Creates organization_members row
    → Returns to frontend with session
```

**Edge Function: invite-user**
```typescript
// supabase/functions/invite-user/index.ts
serve(async (req) => {
  // 1. Auth check
  const { user } = await getAuthenticatedUser(req)

  // 2. Verify caller is admin of the org
  const { data: member } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member || !['admin'].includes(member.role)) {
    return new Response('Forbidden', { status: 403 })
  }

  const { email, role } = await req.json()

  // 3. Check user limit
  const { count } = await supabase
    .from('organization_members')
    .select('*', { count: 'exact' })
    .eq('organization_id', member.organization_id)
    .eq('is_active', true)

  const { data: org } = await supabase
    .from('organizations')
    .select('max_users')
    .eq('id', member.organization_id)
    .single()

  if (count >= org.max_users) {
    return Response.json({ error: 'User limit reached' }, { status: 400 })
  }

  // 4. Create invitation record
  const { data: invitation } = await adminSupabase
    .from('invitations')
    .insert({ organization_id: member.organization_id, email, role, invited_by: user.id })
    .select()
    .single()

  // 5. Send invite email via Supabase Auth
  await adminSupabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${Deno.env.get('APP_URL')}/accept-invite`,
    data: {
      invitation_id: invitation.id,
      organization_id: member.organization_id,
      role,
    }
  })

  return Response.json({ success: true })
})
```

**Accept invitation: frontend**
```typescript
// src/pages/AcceptInvite.tsx
export function AcceptInvite() {
  // Supabase magic link sets the session automatically when user lands on this page
  // onAuthStateChange fires with event = 'SIGNED_IN' and user.user_metadata contains invitation data

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const invitationId = session.user.user_metadata?.invitation_id
        if (invitationId) {
          // Call Edge Function to create the organization_members row
          await supabase.functions.invoke('accept-invitation', {
            body: { invitation_id: invitationId }
          })
        }
      }
    })
  }, [])
}
```

**Edge Function: accept-invitation**
```typescript
serve(async (req) => {
  const { user } = await getAuthenticatedUser(req)
  const { invitation_id } = await req.json()

  const { data: invitation } = await adminSupabase
    .from('invitations')
    .select('*')
    .eq('id', invitation_id)
    .eq('email', user.email)
    .eq('status', 'pending')
    .single()

  if (!invitation) return new Response('Invalid invitation', { status: 400 })
  if (new Date(invitation.expires_at) < new Date()) {
    return Response.json({ error: 'Invitation expired' }, { status: 400 })
  }

  // Create member row (this triggers the JWT claim update)
  await adminSupabase.from('organization_members').insert({
    organization_id: invitation.organization_id,
    user_id: user.id,
    role: invitation.role,
    invited_by: invitation.invited_by,
  })

  // Mark invitation accepted
  await adminSupabase
    .from('invitations')
    .update({ status: 'accepted' })
    .eq('id', invitation_id)

  return Response.json({ success: true, organization_id: invitation.organization_id })
})
```

### Role-Based Access in Invitations

The existing `UserRole` type (`admin | manager | sales_rep | viewer`) and `ROLE_PERMISSIONS` map in `permissions.ts` can stay exactly as-is — they describe the application-level permission model. The DB stores the role string, the JWT claim carries it, and `hasPermission()` remains the single source of truth for UI gating.

What changes: `ProtectedRoute` reads `currentUser.role` from the store (which now comes from the DB via `syncUserFromSession`) rather than from the localStorage-persisted seed user. The runtime behavior is identical.

### Invitation RLS Policies

```sql
-- Only org admins can view/create invitations for their org
CREATE POLICY "admins_manage_invitations" ON public.invitations
  FOR ALL USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() = 'admin'
  );

-- The invited user (pre-auth, anon) can read their own invitation by token
-- This requires a separate public lookup endpoint (Edge Function) rather than a direct policy
-- because the invitee has no JWT yet at the time of acceptance
```

For the token-based accept flow, use the Edge Function with `service_role` to read the invitation — do not try to make it accessible via anon RLS, as the invitee has no JWT before accepting.

---

## Schema Migration Plan

The `schema.sql` needs these additions in dependency order:

1. Create `organizations` table
2. Create `organization_members` table
3. Create `invitations` table
4. Add `organization_id uuid NOT NULL` to `contacts`, `companies`, `deals`, `activities`
5. Add foreign key constraints `REFERENCES public.organizations(id) ON DELETE CASCADE`
6. Add indexes on all `organization_id` columns
7. Drop current tenant-blind RLS policies
8. Create `get_org_id()` and `get_user_role()` helper functions
9. Create new multi-tenant RLS policies for all tables
10. Create `handle_new_member()` trigger function and trigger
11. `ALTER TABLE contacts REPLICA IDENTITY FULL` (and other tables, for realtime DELETE payloads)

**Important migration note:** If there are existing rows from the current single-tenant usage (the seed data), they all need an `organization_id` assigned before adding the NOT NULL constraint. Use a migration script that:
1. Creates a default org row
2. Sets `organization_id` on all existing rows to that org
3. Then adds the NOT NULL constraint

---

## Summary: What Needs to Change in What Order

| Step | What | Files Affected |
|------|------|---------------|
| 1 | Update schema.sql with organizations, members, invitations tables + org_id columns | `supabase/schema.sql` |
| 2 | Regenerate database.types.ts | `src/lib/database.types.ts` |
| 3 | Create src/lib/mappers.ts (DB row → TS type converters) | NEW |
| 4 | Fix authStore: replace simpleHash/passwords with Supabase Auth, add setOrganization action, fix isLoadingAuth init | `src/store/authStore.ts` |
| 5 | Fix ProtectedRoute to handle isLoadingAuth gate | `src/components/auth/ProtectedRoute.tsx` |
| 6 | Migrate contactsStore — remove persist on data, add fetchContacts/upsertContact/removeContact, optimistic writes | `src/store/contactsStore.ts` |
| 7 | Migrate companiesStore, dealsStore, activitiesStore (same pattern) | store files |
| 8 | Migrate notificationsStore — realtime subscription, no persist | `src/store/notificationsStore.ts` |
| 9 | Create DataProvider and RealtimeProvider | NEW components |
| 10 | Create Edge Functions: ai-proxy, invite-user, accept-invitation | `supabase/functions/` |
| 11 | Remove apiKey from aiStore persist, update aiService.ts to call Edge Function | `src/store/aiStore.ts`, `src/services/aiService.ts` |
| 12 | Add AcceptInvite page and route | NEW page + route in App.tsx |
| 13 | Update TeamManagement page to use new invitation flow | `src/pages/TeamManagement.tsx` |
| 14 | Remove seed data from onRehydrateStorage hooks, add admin "seed demo data" action | store files |

---

## Confidence Assessment

| Area | Level | Basis |
|------|-------|-------|
| RLS organization_id pattern | HIGH | Well-documented Supabase pattern, stable for years |
| JWT claims via app_metadata | HIGH | Official Supabase pattern for custom claims |
| Zustand migration pattern | HIGH | Zustand v5 API stable, pattern is standard |
| onAuthStateChange behavior | HIGH | Supabase JS SDK v2.x, stable API |
| Realtime postgres_changes | HIGH | Core Supabase feature, filter syntax verified |
| Edge Functions Deno runtime | MEDIUM | Runtime is stable but Deno std imports change version; pin versions |
| Gmail authorization code flow | MEDIUM | Google OAuth2 is stable, but GCP console config required |
| REPLICA IDENTITY FULL behavior | HIGH | Standard PostgreSQL feature, works with Supabase |
