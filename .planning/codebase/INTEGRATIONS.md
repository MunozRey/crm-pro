# External Integrations

**Analysis Date:** 2026-03-31

## APIs & External Services

**AI — Anthropic Claude:**
- Used for: contact enrichment, deal enrichment, sales assistant chat, email draft generation, daily brief, meeting prep, and natural language command parsing
- SDK: `@anthropic-ai/sdk` 0.80 (`src/services/aiService.ts`)
- Auth: API key entered by user in the Settings UI, persisted to `localStorage` via `useAIStore` (`src/store/aiStore.ts`)
- Endpoint: Anthropic Messages API (`client.messages.create`, `client.messages.stream`)
- Default model: `claude-opus-4-6`; fast model for command parsing: `claude-haiku-4-5-20251001`
- SDK is called directly from the browser (`dangerouslyAllowBrowser: true`)

**AI — OpenRouter:**
- Used for: same AI features as Anthropic, as a selectable alternative provider
- SDK/Client: Raw `fetch` to `https://openrouter.ai/api/v1/chat/completions` (`src/services/aiService.ts`)
- Auth: OpenRouter API key entered by user in Settings, persisted to `localStorage` via `useAIStore`
- HTTP headers: `Authorization: Bearer <key>`, `HTTP-Referer: https://crm-pro.app`, `X-Title: CRM Pro`
- Supports both non-streaming (JSON) and streaming (SSE) modes
- Available models (defined in `src/constants/aiModels.ts`):
  - `glm-4.6` (ZhipuAI), `gpt-oss-120b`, `qwen3-235b-instruct-2507` (Alibaba)
  - `deepseek-v3.2-exp`, `deepseek-r1-0528` (DeepSeek)
  - `apriel-1.5-15b-thinker` (ServiceNow), `kimi-k2-instruct-0905` (Moonshot)
  - `llama-3.3-nemotron-super-49b-v1.5` (NVIDIA), `mistral-small-3.2-24b-instruct-2506`

**Email — Gmail:**
- Used for: reading inbox threads and sending emails from within the CRM
- SDK/Client: Raw `fetch` to `https://gmail.googleapis.com/gmail/v1/users/me` (`src/services/gmailService.ts`)
- Auth: Google Identity Services (GIS) OAuth 2.0 implicit/token flow via `window.google.accounts.oauth2`
  - Client ID entered by user in Settings, stored at runtime
  - GIS loaded via external `<script>` tag (Google Identity Services JS library)
  - Access token stored in `gmailTokens` inside `useEmailStore` (`src/store/emailStore.ts`), persisted to `localStorage`
  - Token expiry tracked client-side via `expiresAt` timestamp
- Scopes requested:
  - `https://www.googleapis.com/auth/gmail.send`
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/gmail.compose`
- Operations: `GET /threads`, `GET /threads/{id}`, `POST /messages/send`, `GET /profile`

## Data Storage

**Databases:**
- Supabase (PostgreSQL)
  - Connection: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (env vars, optional)
  - Client: `@supabase/supabase-js` 2.100, initialized in `src/lib/supabase.ts`
  - The client is `null` when env vars are absent; all stores check `isSupabaseConfigured` before using it
  - Schema defined in `supabase/schema.sql`
  - Tables: `contacts`, `companies`, `deals`, `activities`, `notifications`
  - Row Level Security (RLS) enabled on all tables
    - All authenticated users can read/write all CRM tables (team-wide access)
    - Notifications are restricted to owner (`auth.uid() = user_id`)
  - `updated_at` auto-managed via PostgreSQL trigger `handle_updated_at()`
  - UUID primary keys via `uuid-ossp` extension
  - TypeScript types generated/maintained manually in `src/lib/database.types.ts`

**Fallback / Offline Storage:**
- When Supabase is not configured, all CRM data is persisted to `localStorage` via Zustand `persist` middleware
- This is the default mode in development without a Supabase project configured
- `localStorage` keys (defined in `src/utils/constants.ts`): `crm_auth`, `crm_ai`, `crm_emails`, and per-store keys via `LS_KEYS`

**File Storage:**
- Not detected — no S3, Supabase Storage, or other file storage integration present

**Caching:**
- None — no Redis, Memcached, or CDN cache layer

## Authentication & Identity

**Primary Auth Provider:**
- Custom localStorage-based auth (`src/store/authStore.ts`)
  - Users, sessions, and hashed passwords stored in Zustand `persist` store
  - Password hashing: simple non-cryptographic hash (explicitly noted as demo only in source)
  - Session tokens: UUID v4, 24-hour expiry
  - Roles: `admin`, `manager`, `sales_rep`, `viewer`
  - Seed demo users pre-loaded (admin: `david@crmpro.es`, password: `demo123`)

**Optional Auth Provider:**
- Supabase Auth (when `isSupabaseConfigured` is true)
  - Initialized via `initSupabaseAuth()` in `src/store/authStore.ts`
  - Listens to `supabase.auth.onAuthStateChange` and maps Supabase user to `AuthUser` type
  - Role and jobTitle read from `user_metadata`
  - When active, `supabaseSession` is stored alongside the custom session

**Gmail OAuth:**
- Handled separately via Google Identity Services (see Gmail section above)
- Not connected to the primary auth system

## Monitoring & Observability

**Error Tracking:**
- Not detected — no Sentry, Datadog, or similar integration

**Logs:**
- `src/store/auditStore.ts` provides an in-app audit log: `logAction(action, entity, entityId, title, detail)`
- Audit entries are persisted to `localStorage` via Zustand persist
- Audit log is viewable at the `/audit` route (`src/pages/AuditLog.tsx`)
- No external log shipping

## CI/CD & Deployment

**Hosting:**
- Not detected in codebase — no `vercel.json`, `netlify.toml`, or Dockerfile present
- Application builds to a static bundle (`npm run build`) suitable for any static host

**CI Pipeline:**
- Not detected — no `.github/workflows/`, `.gitlab-ci.yml`, or similar

## Environment Configuration

**Required env vars (Supabase — optional):**
- `VITE_SUPABASE_URL` — Supabase project REST/Auth URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon (public) key

**Runtime-configured secrets (entered by user in Settings UI, stored in localStorage):**
- Anthropic API key — stored in `useAIStore.apiKey`
- OpenRouter API key — stored in `useAIStore.openRouterKey`
- Google OAuth Client ID — used transiently for GIS token requests

**Secrets location:**
- `.env` file (gitignored) for Supabase URL/key
- All AI and Google credentials: user-entered at runtime, never in `.env`

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected (Gmail sending is direct API call, not webhook-based)

---

*Integration audit: 2026-03-31*
